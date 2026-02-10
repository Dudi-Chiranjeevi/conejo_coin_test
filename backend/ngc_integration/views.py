import os
import cv2
import numpy as np
import logging
import uuid

from pyzbar import pyzbar
from django.db import connection
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.views.decorators.csrf import csrf_exempt
from rest_framework import viewsets, views
from rest_framework import status as http_status
from rest_framework.views import APIView
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
    parser_classes,
    action
)
from django.db.transaction import atomic
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django.db import connection
from PIL import Image, ExifTags
from io import BytesIO
from .models import Coin, Barcode
from .serializers import BarcodeSerializer, InventoryFromNGCSerializer
from .inventory_service import fetch_coin, get_ngc_auth_token, save_ngc_payload_to_inventory
from inventory.models import InventoryItem, Category
from client_management.models import Client

logger = logging.getLogger(__name__)

class BarcodeViewSet(viewsets.ModelViewSet):
    queryset = Barcode.objects.all().order_by('-timestamp')
    serializer_class = BarcodeSerializer
    permission_classes = [AllowAny]  # or [IsAuthenticated] if you want to secure this

    @action(
        detail=False,
        methods=['post'],
        url_path='detect_barcode',
        permission_classes=[AllowAny],
        authentication_classes=[],
        parser_classes=[MultiPartParser, FormParser],
    )
    def detect_barcode(self, request, *args, **kwargs):        

        def _read_image_normalized(django_file):
            # Read bytes
            raw = django_file.read()

            # Try PIL to honor EXIF orientation
            try:
                pil_img = Image.open(BytesIO(raw))
                # Fix orientation if present
                try:
                    orientation_key = next(k for k, v in ExifTags.TAGS.items() if v == 'Orientation')
                    exif = pil_img.getexif()
                    if exif and orientation_key in exif:
                        o = exif[orientation_key]
                        if o == 3: pil_img = pil_img.rotate(180, expand=True)
                        elif o == 6: pil_img = pil_img.rotate(270, expand=True)
                        elif o == 8: pil_img = pil_img.rotate(90, expand=True)
                except Exception:
                    pass
                pil_img = pil_img.convert("RGB")
                img = np.array(pil_img)
                img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
                return img
            except Exception:
                # Fallback: decode with OpenCV directly
                arr = np.frombuffer(raw, np.uint8)
                img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
                return img

        def _try_decode_all(img_bgr):
            candidates = []

            def add_results(decoded, label):
                for b in decoded:
                    try:
                        candidates.append({
                            "raw": b.data.decode("utf-8", errors="strict"),
                            "type": getattr(b, "type", "UNKNOWN"),
                            "label": label,
                            "rect": getattr(b, "rect", None),
                        })
                    except Exception:
                        # Skip undecodable bytes
                        continue

            # Pass 1: original
            add_results(pyzbar.decode(img_bgr), "raw")

            # Pass 2: grayscale
            gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
            add_results(pyzbar.decode(gray), "gray")

            # Pass 3: sharpen
            kernel = np.array([[0,-1,0],[-1,5,-1],[0,-1,0]])
            sharp = cv2.filter2D(gray, -1, kernel)
            add_results(pyzbar.decode(sharp), "sharp")

            # Pass 4: adaptive threshold
            thr = cv2.adaptiveThreshold(gray,255,cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                        cv2.THRESH_BINARY, 31, 10)
            add_results(pyzbar.decode(thr), "thr")

            # Pass 5: upscale if small
            h, w = gray.shape[:2]
            if max(h, w) < 800:
                scale = 800.0 / max(h, w)
                up = cv2.resize(gray, (int(w*scale), int(h*scale)), interpolation=cv2.INTER_CUBIC)
                add_results(pyzbar.decode(up), "upscaled")

            # Fallback for QR only (OpenCV)
            try:
                qrd = cv2.QRCodeDetector()
                qr_data, points, _ = qrd.detectAndDecode(gray)
                if qr_data:
                    candidates.append({"raw": qr_data, "type": "QRCODE", "label": "opencv_qr", "rect": None})
            except Exception:
                pass

            # Deduplicate by content
            seen = set()
            uniq = []
            for c in candidates:
                key = c["raw"]
                if key not in seen and key.strip():
                    seen.add(key)
                    uniq.append(c)
            return uniq

        # --- In your action ---
        if 'image' not in request.FILES:
            return Response({'error': 'No image provided'}, status=http_status.HTTP_400_BAD_REQUEST)

        image_file = request.FILES['image']
        if image_file.size > 5 * 1024 * 1024:
            return Response({'error': 'Image too large (max 5MB)'}, status=http_status.HTTP_400_BAD_REQUEST)
        if not (image_file.content_type or '').startswith('image/'):
            return Response({'error': 'Invalid file type'}, status=http_status.HTTP_400_BAD_REQUEST)

        img = _read_image_normalized(image_file)
        if img is None:
            return Response({'error': 'Could not read image file'}, status=http_status.HTTP_400_BAD_REQUEST)

        decoded = _try_decode_all(img)

        if not decoded:
            # Prefer a non-error response; let UI show a friendly message
            return Response({'results': [], 'message': 'No barcodes detected'}, status=http_status.HTTP_200_OK)

        final_results = []
        for d in decoded:
            raw_barcode = d["raw"]

            # Hit NGC API for this barcode
            api_data = fetch_coin(raw_barcode, by_barcode=True)

            # If API didn’t return a cert, skip this candidate
            cert = (api_data or {}).get("certNumber") or (api_data or {}).get("cert_number")
            if not cert:
                continue

            # Check if an InventoryItem with this cert already exists (duplicate guard)
            existing_item = InventoryItem.objects.filter(identification_number=cert).first()

            final_results.append({
                'barcode': {'data': raw_barcode, 'type': d["type"], 'source': d["label"]},
                'ngc': api_data,  # raw payload – the preview modal uses this
                'is_duplicate': existing_item is not None,
                'existing_inventory': {
                    'id': str(existing_item.id),
                    'name': existing_item.name,
                    'thumbnail': existing_item.thumbnail,
                    'status': existing_item.status,
                    'price': str(existing_item.price),
                    'identification_number': existing_item.identification_number,
                    'date_added': existing_item.date_added.strftime('%Y-%m-%d') if existing_item.date_added else None,
                    'attributes': existing_item.attributes,
                    'images': existing_item.images,
                    'description': existing_item.description or "",
                } if existing_item else None,
                'warning': f"⚠️ This certificate already exists in your inventory\nExisting item: {existing_item.name or 'Unknown'} (Added: {existing_item.date_added.strftime('%Y-%m-%d') if existing_item.date_added else 'Unknown date'})" if existing_item else None
            })

        resp = Response({'results': final_results}, status=http_status.HTTP_200_OK)
        # (Set your cookie if you need to)
        # resp.set_cookie('ngc_token', value=token, ...)

        return resp

@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
@csrf_exempt
def lookup_cert(request):
    cert_number = request.data.get("cert_number")
    if not cert_number:
        return Response({"error": "cert_number is required"}, status=http_status.HTTP_400_BAD_REQUEST)

    try:
        # Force a fresh database connection to avoid caching issues
        from django.db import connection
        connection.close()
        
        # 1) Is it already in inventory?
        # Use select_for_update() to get the latest data and avoid race conditions
        from django.db.transaction import atomic
        with atomic():
            # Check for existing item using identification_number field
            existing_item = InventoryItem.objects.select_for_update().filter(
                identification_number=cert_number
            ).first()
                
            # Log the result for debugging
            if existing_item:
                logger.info(f"Found existing item with cert number {cert_number}: {existing_item.id} - {existing_item.name}")
            else:
                logger.info(f"No existing item found with cert number {cert_number}")

        if existing_item:
            # Duplicate
            warning_message = (
                f"⚠️ This certificate already exists in your inventory\n"
                f"Existing item: {existing_item.name or 'Unknown'}"
            )
            if existing_item.date_added:
                warning_message += f" (Added: {existing_item.date_added.strftime('%Y-%m-%d')})"

            response = Response({
                "ngc": None,
                "is_duplicate": True,
                "existing_inventory": {
                    "id": str(existing_item.id),
                    "name": existing_item.name,
                    "thumbnail": existing_item.thumbnail,
                    "status": existing_item.status,
                    "price": str(existing_item.price),
                    "identification_number": existing_item.identification_number,
                    "date_added": existing_item.date_added.strftime('%Y-%m-%d') if existing_item.date_added else None,
                    "attributes": existing_item.attributes,
                    "images": existing_item.images,
                },
                "warning": warning_message
            }, status=http_status.HTTP_200_OK)

        else:
            # 2) Fetch from NGC
            try:
                token = get_ngc_auth_token(request)
            except Exception as e:
                logger.error(f"Token authentication failed: {str(e)}")
                return Response({"error": str(e)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)

            api_data = fetch_coin(cert_number, by_barcode=False)
            if not api_data or not (api_data.get("certNumber") or api_data.get("cert_number")):
                return Response({"error": "Certificate not found"}, status=http_status.HTTP_404_NOT_FOUND)

            response = Response({
                "ngc": api_data,          # raw payload for the preview modal
                "is_duplicate": False,
                "existing_inventory": None
            }, status=http_status.HTTP_200_OK)

            # Keep your cookie if you want the client to reuse token
            response.set_cookie(
                'ngc_token',
                value=token,
                max_age=settings.SESSION_COOKIE_AGE,
                secure=settings.SESSION_COOKIE_SECURE,
                httponly=settings.SESSION_COOKIE_HTTPONLY,
                samesite=settings.SESSION_COOKIE_SAMESITE
            )

        return response

    except Exception as e:
        logger.error(f"Error in cert lookup: {e}", exc_info=True)

        return Response({"error": str(e)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def invalidate_cache(request):
  """Force cache invalidation for inventory items"""
  # This is a no-op endpoint that just forces Django to refresh connections
  return Response({"status": "ok"})

@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def check_certificate_exists(request):
    """
    Check if a certificate number already exists in the inventory.
    
    Query parameter:
    - cert_number: The NGC certificate number to check
    
    Returns:
    - exists: Boolean indicating if the certificate exists
    - item: Details of the existing item (if exists=True)
    """
    cert_number = request.query_params.get('cert_number')
    if not cert_number:
        return Response({"error": "cert_number is required"}, status=http_status.HTTP_400_BAD_REQUEST)
    
    # Force a fresh database connection to avoid caching issues
    connection.close()
    
    # First check by identification_number (exact match)
    existing_item = InventoryItem.objects.filter(identification_number=cert_number).first()
    
    # If not found by identification_number, check in attributes.cert_number
    if not existing_item:
        try:
            # Use raw SQL for more efficient querying of JSONB fields
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id FROM inventory_inventoryitem 
                    WHERE (
                        attributes->>'cert_number' = %s OR 
                        attributes->'metadata'->>'cert_number' = %s OR
                        attributes->'coin'->>'cert_number' = %s OR
                        attributes->'grade'->>'cert_number' = %s
                    )
                    """, 
                    [cert_number, cert_number, cert_number, cert_number]
                )
                row = cursor.fetchone()
                if row:
                    existing_item = InventoryItem.objects.get(id=row[0])
        except Exception as e:
            logger.error(f"Error checking for certificate in attributes: {str(e)}", exc_info=True)
    
    if existing_item:
        return Response({
            "exists": True,
            "item": {
                "id": str(existing_item.id),
                "name": existing_item.name,
                "thumbnail": existing_item.thumbnail,
                "status": existing_item.status,
                "price": str(existing_item.price),
                "identification_number": existing_item.identification_number,
                "date_added": existing_item.date_added.strftime('%Y-%m-%d') if existing_item.date_added else None,
                "description": existing_item.description or "",
                "attributes": existing_item.attributes
            }
        })
    else:
        return Response({"exists": False})

@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
@csrf_exempt
def lookup_and_save_cert(request):
    """
    Lookup a certificate number from NGC and save it to inventory.
    This endpoint is used for bulk uploads of NGC certificates.
    
    Request data:
    - cert_number: The NGC certificate number to lookup
    - client_id: The client ID to associate with the inventory item
    - category_id: The category ID to associate with the inventory item
    - status: The status of the inventory item (default: 'in_store')
    - price: The price of the inventory item (optional)
    - location_id: The location ID to associate with the inventory item (optional)
    - notes: Additional notes for the inventory item (optional)
    - created_by: The user who created the inventory item (optional)
    - name: The name of the inventory item (optional)
    - description: The description of the inventory item (optional)
    
    Returns:
    - success: Boolean indicating if the operation was successful
    - saved_item: Details of the saved inventory item
    - is_duplicate: Boolean indicating if the certificate already exists
    - existing_inventory: Details of the existing item (if is_duplicate=True)
    - error: Error message if the operation failed
    """
    cert_number = request.data.get("cert_number")
    client_id = request.data.get("client_id")
    category_id = request.data.get("category_id")
    status = request.data.get("status", "in_store")
    
    # Handle price parameter - convert to Decimal if provided
    price = request.data.get("price", 0)
    try:
        if price is not None:
            # Convert to float first, then to string for Decimal to handle properly
            price = float(price)
    except (ValueError, TypeError):
        # If conversion fails, default to 0
        price = 0
        
    location_id = request.data.get("location_id")
    notes = request.data.get("notes", "")
    # Optional fields for auditing and presentation
    created_by = request.data.get("created_by")
    name = request.data.get("name")
    description = request.data.get("description")
    
    if not cert_number:
        return Response({"error": "cert_number is required"}, status=http_status.HTTP_400_BAD_REQUEST)
    
    if not client_id:
        return Response({"error": "client_id is required"}, status=http_status.HTTP_400_BAD_REQUEST)
    
    if not category_id:
        return Response({"error": "category_id is required"}, status=http_status.HTTP_400_BAD_REQUEST)
    
    try:
        # Force a fresh database connection to avoid caching issues
        connection.close()
        
        # STEP 1: Check for duplicates before any database operations
        # This is the first check to avoid unnecessary API calls if the cert already exists
        try:
            # Check if the certificate already exists in inventory
            existing_item = None
            
            # First check by identification_number (exact match)
            existing_item = InventoryItem.objects.filter(identification_number=cert_number).first()
            
            # If not found by identification_number, check in attributes.cert_number
            if not existing_item:
                # Use raw SQL for more efficient querying of JSONB fields
                with connection.cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT id FROM inventory_inventoryitem 
                        WHERE client_id = %s AND (
                            attributes->>'cert_number' = %s OR 
                            attributes->'metadata'->>'cert_number' = %s OR
                            attributes->'coin'->>'cert_number' = %s OR
                            attributes->'grade'->>'cert_number' = %s
                        )
                        """, 
                        [client_id, cert_number, cert_number, cert_number, cert_number]
                    )
                    row = cursor.fetchone()
                    if row:
                        existing_item = InventoryItem.objects.get(id=row[0])
            
            # If a duplicate is found, return early with duplicate information
            if existing_item:
                logger.info(f"Certificate {cert_number} already exists in inventory with ID: {existing_item.id}")
                return Response({
                    "success": False,
                    "is_duplicate": True,
                    "existing_inventory": {
                        "id": str(existing_item.id),
                        "name": existing_item.name,
                        "thumbnail": existing_item.thumbnail,
                        "status": existing_item.status,
                        "price": str(existing_item.price),
                        "identification_number": existing_item.identification_number,
                        "date_added": existing_item.date_added.strftime('%Y-%m-%d') if existing_item.date_added else None,
                        "description": existing_item.description or "",
                        "attributes": existing_item.attributes
                    },
                    "warning": f"Certificate {cert_number} already exists in inventory"
                }, status=http_status.HTTP_200_OK)
        except Exception as check_error:
            logger.error(f"Error checking for duplicate certificate: {str(check_error)}", exc_info=True)
            # Continue with the process even if the duplicate check fails
            # We'll rely on the database constraint as a fallback
        
        # STEP 2: Fetch the certificate data from NGC
        ngc_data = fetch_coin(cert_number, by_barcode=False)
        if not ngc_data or not (ngc_data.get("certNumber") or ngc_data.get("cert_number")):
            return Response({"error": "Certificate not found"}, status=http_status.HTTP_404_NOT_FOUND)
        
        # STEP 3: Validate client and category before attempting to save
        try:
            client = Client.objects.get(id=client_id)
        except Client.DoesNotExist:
            return Response({"error": f"Client with ID {client_id} not found"}, status=http_status.HTTP_400_BAD_REQUEST)
        
        try:
            category = Category.objects.get(id=category_id)
        except Category.DoesNotExist:
            return Response({"error": f"Category with ID {category_id} not found"}, status=http_status.HTTP_400_BAD_REQUEST)
        
        # STEP 4: Save the item with proper error handling
        try:
            # Use atomic transaction to ensure database consistency
            with atomic():
                # One final check for duplicates right before saving
                existing_item = InventoryItem.objects.filter(identification_number=cert_number).first()
                if existing_item:
                    return Response({
                        "success": False,
                        "is_duplicate": True,
                        "existing_inventory": {
                            "id": str(existing_item.id),
                            "name": existing_item.name,
                            "thumbnail": existing_item.thumbnail,
                            "status": existing_item.status,
                            "price": str(existing_item.price),
                            "identification_number": existing_item.identification_number,
                            "date_added": existing_item.date_added.strftime('%Y-%m-%d') if existing_item.date_added else None,
                            "description": existing_item.description or "",
                            "attributes": existing_item.attributes
                        },
                        "warning": f"Certificate {cert_number} already exists in inventory",
                        "error": f"Certificate {cert_number} already exists in inventory"
                    }, status=http_status.HTTP_409_CONFLICT)  # Use 409 Conflict for duplicates
                
                # Save the item if no duplicate was found
                saved_item = save_ngc_payload_to_inventory(
                    ngc_payload=ngc_data,
                    client_id=client_id,
                    category_id=category_id,
                    price=price,  # Pass the price parameter
                    status=status,
                    location_id=location_id,
                    notes=notes,
                    created_by=created_by,
                    name=name,
                    description=description,
                )
            
            # Return success response
            return Response({
                "success": True,
                "ngc": ngc_data,
                "saved_item": {
                    "id": str(saved_item.id),
                    "name": saved_item.name,
                    "thumbnail": saved_item.thumbnail,
                    "status": saved_item.status,
                    "price": str(saved_item.price),
                    "identification_number": saved_item.identification_number,
                    "date_added": saved_item.date_added.strftime('%Y-%m-%d') if saved_item.date_added else None,
                    "attributes": saved_item.attributes
                }
            }, status=http_status.HTTP_201_CREATED)
            
        except Exception as save_error:
            # Check if this is a duplicate key error
            error_str = str(save_error).lower()
            if "duplicate" in error_str or "unique constraint" in error_str or "uniq_client_identification_number_per_client" in error_str:
                # This is a duplicate that was missed by our earlier checks
                # Try to fetch the existing item
                try:
                    existing_item = InventoryItem.objects.filter(identification_number=cert_number).first()
                    if existing_item:
                        return Response({
                            "success": False,
                            "is_duplicate": True,
                            "existing_inventory": {
                                "id": str(existing_item.id),
                                "name": existing_item.name,
                                "thumbnail": existing_item.thumbnail,
                                "status": existing_item.status,
                                "price": str(existing_item.price),
                                "identification_number": existing_item.identification_number,
                                "date_added": existing_item.date_added.strftime('%Y-%m-%d') if existing_item.date_added else None,
                                "description": existing_item.description or "",
                                "attributes": existing_item.attributes
                            },
                            "warning": f"Certificate {cert_number} already exists in inventory"
                        }, status=http_status.HTTP_200_OK)
                except Exception:
                    pass  # If we can't fetch the existing item, fall through to the general error
            
            # General error case
            logger.error(f"Error saving NGC data to inventory: {str(save_error)}", exc_info=True)
            return Response({"error": f"Error saving NGC data to inventory: {str(save_error)}"}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)
            
    except Exception as e:
        logger.error(f"Error in lookup_and_save_cert: {str(e)}", exc_info=True)
        return Response({"error": str(e)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)


class InventoryFromNGCView(APIView):
    permission_classes = [AllowAny]  # Ensure no authentication is required
    authentication_classes = []      # Ensure no authentication is required
    
    def post(self, request):
        print("InventoryFromNGCView.post called with data:", request.data)
        try:
            # Force a fresh database connection to avoid caching issues
            connection.close()
            
            # Check for duplicate certificate before proceeding
            ngc_data = request.data.get('ngc_data', {})
            cert_number = ngc_data.get('certNumber')
            
            if cert_number:
                # Use atomic transaction to prevent race conditions
                with atomic():
                    existing_item = InventoryItem.objects.filter(identification_number=cert_number).first()
                    
                    if existing_item:
                        print(f"Certificate {cert_number} already exists in inventory with ID: {existing_item.id}")
                        return Response({
                            "error": "This certificate already exists in your inventory",
                            "existing_item": {
                                "id": str(existing_item.id),
                                "name": existing_item.name,
                                "identification_number": existing_item.identification_number
                            }
                        }, status=http_status.HTTP_409_CONFLICT)
            
            # Proceed with serialization and saving
            ser = InventoryFromNGCSerializer(data=request.data)
            if ser.is_valid():
                print("Serializer is valid with data:", ser.validated_data)
                item = ser.save()
                # Optionally set created_by if provided in the request payload
                created_by = request.data.get('created_by')
                if created_by:
                    try:
                        item.created_by = created_by
                        item.save(update_fields=['created_by'])
                    except Exception as e:
                        logger.error(f"Failed to set created_by on item {item.id}: {str(e)}", exc_info=True)
                print(f"Item saved successfully with ID: {item.id}")
                return Response(ser.to_representation(item), status=http_status.HTTP_201_CREATED)
            
            else:
                print("Serializer validation errors:", ser.errors)
                return Response(ser.errors, status=http_status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            print(f"Exception in InventoryFromNGCView.post: {str(e)}")
            logger.error(f"Exception in InventoryFromNGCView.post: {str(e)}", exc_info=True)
            return Response({"error": str(e)}, status= http_status.HTTP_500_INTERNAL_SERVER_ERROR)