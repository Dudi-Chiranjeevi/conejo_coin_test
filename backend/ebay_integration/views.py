# ebay_integration/views.py
import logging
from django.db import connection
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status as http_status
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
    parser_classes
)
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.parsers import JSONParser

from .models import EbayItem, EbayItemStatus, EbaySettings
from .ebay_service import EbayService
from inventory.models import InventoryItem  # ✅ ADD THIS IMPORT
from django.utils import timezone

logger = logging.getLogger(__name__)

@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
@parser_classes([JSONParser])
@csrf_exempt
def get_listing(request):
    """
    Get basic eBay listing information including availability
    POST /api/v1/ebay/get-listing/
    """
    try:
        item_id = request.data.get('item_id')
        
        if not item_id:
            return Response({
                'success': False,
                'error': 'Item ID is required',
                'data': None
            }, status=http_status.HTTP_400_BAD_REQUEST)
        
        logger.info(f"Fetching eBay listing for item: {item_id}")
        
        # Initialize eBay service WITH REQUEST
        ebay_service = EbayService(sandbox=True, request=request)  # 🆕 UPDATED
        
        # Fetch listing data from eBay API
        listing_data = ebay_service.get_item_listing(item_id)
        
        if not listing_data:
            return Response({
                'success': False,
                'error': 'No data received from eBay API',
                'data': None
            }, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        if 'error' in listing_data:
            return Response({
                'success': False,
                'error': listing_data['error'],
                'data': None
            }, status=http_status.HTTP_404_NOT_FOUND)
        
        # Log the raw data for debugging
        logger.info(f"Raw eBay data received: {listing_data}")
        
        # Determine status
        status = _parse_listing_status(listing_data)
        
        try:
            # Extract availability data
            availability = listing_data.get('availability', {})
            
            # Save or update in database
            defaults = {
                'title': listing_data.get('title', '')[:1000],
                'status': status,
                'current_price': listing_data.get('current_price'),
                'currency': listing_data.get('currency', 'USD'),
                'listing_type': (listing_data.get('listing_type') or '')[:95],
                'condition': (listing_data.get('condition') or '')[:195],
                'seller_username': (listing_data.get('seller_username') or '')[:495],
                'view_item_url': (listing_data.get('view_item_url') or '')[:995],
                'image_url': (listing_data.get('image_url') or '')[:995],
                'start_time': _parse_ebay_date(listing_data.get('start_time')),
                'end_time': _parse_ebay_date(listing_data.get('end_time')),
                # Availability fields
                'estimated_availability_status': availability.get('estimated_availability_status'),
                'estimated_available_quantity': availability.get('estimated_available_quantity'),
                'estimated_sold_quantity': availability.get('estimated_sold_quantity'),
                'estimated_remaining_quantity': availability.get('estimated_remaining_quantity'),
                'buying_options': listing_data.get('buying_options', []),
                'shipping_options': listing_data.get('shipping_options', []),
            }
            
            ebay_item, created = EbayItem.objects.update_or_create(
                item_id=item_id[:95],
                defaults=defaults
            )
            
        except Exception as db_error:
            logger.error(f"Database error: {str(db_error)}")
            logger.error(f"Problematic data: {listing_data}")
            return Response({
                'success': False,
                'error': f'Database error: {str(db_error)}',
                'data': None
            }, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        # Prepare response with availability data
        response_data = {
            'success': True,
            'error': None,
            'data': {
                'item_id': item_id,
                'status': status,
                'is_new': created,
                'listing': {
                    'title': ebay_item.title,
                    'current_price': str(ebay_item.current_price) if ebay_item.current_price else None,
                    'currency': ebay_item.currency,
                    'listing_type': ebay_item.listing_type,
                    'condition': ebay_item.condition,
                    'seller_username': ebay_item.seller_username,
                    'view_item_url': ebay_item.view_item_url,
                    'image_url': ebay_item.image_url,
                    'start_time': ebay_item.start_time.isoformat() if ebay_item.start_time else None,
                    'end_time': ebay_item.end_time.isoformat() if ebay_item.end_time else None,
                    # Availability information (NEW)
                    'availability': {
                        'estimated_availability_status': ebay_item.estimated_availability_status,
                        'estimated_available_quantity': ebay_item.estimated_available_quantity,
                        'estimated_sold_quantity': ebay_item.estimated_sold_quantity,
                        'estimated_remaining_quantity': ebay_item.estimated_remaining_quantity,
                    },
                    'buying_options': ebay_item.buying_options,
                    'shipping_options': ebay_item.shipping_options,
                }
            }
        }
        
        return Response(response_data, status=http_status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error fetching eBay listing: {str(e)}", exc_info=True)
        return Response({
            'success': False,
            'error': str(e),
            'data': None
        }, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def get_all_listings(request):
    """
    Get all eBay listings from database
    GET /api/v1/ebay/listings/
    """
    try:
        # Force a fresh database connection to avoid caching issues
        connection.close()
        
        items = EbayItem.objects.all().order_by('-created_at')
        listings_data = []
        
        for item in items:
            listings_data.append({
                'item_id': item.item_id,
                'title': item.title,
                'status': item.status,
                'current_price': str(item.current_price) if item.current_price else None,
                'currency': item.currency,
                'condition': item.condition,
                'seller_username': item.seller_username,
                'view_item_url': item.view_item_url,
                'image_url': item.image_url,
                'created_at': item.created_at.isoformat(),
            })
        
        return Response({
            'success': True,
            'error': None,
            'data': {
                'listings': listings_data, 
                'total_count': len(listings_data)
            }
        }, status=http_status.HTTP_200_OK)
    
    except Exception as e:
        logger.error(f"Error fetching eBay listings: {str(e)}", exc_info=True)
        return Response({
            'success': False,
            'error': str(e),
            'data': None
        }, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
@parser_classes([JSONParser])
@csrf_exempt
def step1_create_inventory_item(request):
    """
    STEP 1: Create Inventory Item with images
    POST /api/v1/ebay/step1-inventory-item/
    """
    try:
        inventory_data = request.data
        
        if not inventory_data.get('sku'):
            return Response({
                'success': False,
                'error': 'SKU is required',
                'data': None
            }, status=http_status.HTTP_400_BAD_REQUEST)
        
        ebay_service = EbayService(sandbox=True, request=request)  # 🆕 UPDATED
        result = ebay_service.create_inventory_item(inventory_data)
        
        if 'error' in result:
            return Response({
                'success': False,
                'error': result['error'],
                'data': None
            }, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        return Response({
            'success': True,
            'error': None,
            'data': result
        }, status=http_status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Step 1 error: {str(e)}", exc_info=True)
        return Response({
            'success': False,
            'error': str(e),
            'data': None
        }, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
@parser_classes([JSONParser])
@csrf_exempt
def step2_create_offer(request):
    """
    STEP 2: Create Offer
    POST /api/v1/ebay/step2-create-offer/
    """
    try:
        offer_data = request.data
        
        required_fields = ['sku', 'price']
        for field in required_fields:
            if not offer_data.get(field):
                return Response({
                    'success': False,
                    'error': f'Missing required field: {field}',
                    'data': None
                }, status=http_status.HTTP_400_BAD_REQUEST)
        
        ebay_service = EbayService(sandbox=True, request=request)  # 🆕 UPDATED
        result = ebay_service.create_offer(offer_data)
        
        if 'error' in result:
            return Response({
                'success': False,
                'error': result['error'],
                'data': None
            }, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        return Response({
            'success': True,
            'error': None,
            'data': result
        }, status=http_status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Step 2 error: {str(e)}", exc_info=True)
        return Response({
            'success': False,
            'error': str(e),
            'data': None
        }, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
@parser_classes([JSONParser])
@csrf_exempt
def step3_publish_offer(request):
    """
    STEP 3: Publish Offer
    POST /api/v1/ebay/step3-publish-offer/
    """
    try:
        offer_id = request.data.get('offer_id')
        
        if not offer_id:
            return Response({
                'success': False,
                'error': 'offer_id is required',
                'data': None
            }, status=http_status.HTTP_400_BAD_REQUEST)
        
        ebay_service = EbayService(sandbox=True, request=request)  # 🆕 UPDATED
        result = ebay_service.publish_offer(offer_id)
        
        if 'error' in result:
            return Response({
                'success': False,
                'error': result['error'],
                'data': None
            }, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        return Response({
            'success': True,
            'error': None,
            'data': result
        }, status=http_status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Step 3 error: {str(e)}", exc_info=True)
        return Response({
            'success': False,
            'error': str(e),
            'data': None
        }, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
@parser_classes([JSONParser])
@csrf_exempt
def create_listing(request):
    """
    COMPLETE FLOW: All 3 steps in one call
    POST /api/v1/ebay/create-listing/
    """
    try:
        listing_data = request.data
        
        required_fields = ['sku', 'title', 'price', 'category_id', 'inventory_item_id']  # ✅ ADD inventory_item_id
        for field in required_fields:
            if not listing_data.get(field):
                return Response({
                    'success': False,
                    'error': f'Missing required field: {field}',
                    'data': None
                }, status=http_status.HTTP_400_BAD_REQUEST)
        
        ebay_service = EbayService(sandbox=True, request=request)  # 🆕 UPDATED
        result = ebay_service.create_complete_listing(listing_data)
        
        if 'error' in result:
            return Response({
                'success': False,
                'error': result['error'],
                'data': None
            }, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        # ✅ NEW: Update the inventory item as listed using the actual UUID
        try:
            inventory_item_id = listing_data.get('inventory_item_id')
            inventory_item = InventoryItem.objects.get(id=inventory_item_id)
            inventory_item.is_listed = True
            inventory_item.save()
            logger.info(f"✅ Updated inventory item {inventory_item_id} as listed on eBay")
        except InventoryItem.DoesNotExist:
            logger.warning(f"⚠️ Inventory item with ID {inventory_item_id} not found")
        except Exception as e:
            logger.error(f"❌ Failed to update inventory item listing status: {e}")
        
        return Response({
            'success': True,
            'error': None,
            'data': result
        }, status=http_status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error creating complete listing: {str(e)}", exc_info=True)
        return Response({
            'success': False,
            'error': str(e),
            'data': None
        }, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def check_listing_exists(request):
    """
    Check if an eBay listing already exists in the database
    GET /api/v1/ebay/check-listing/?item_id=123
    """
    item_id = request.query_params.get('item_id')
    if not item_id:
        return Response({
            "success": False,
            "error": "item_id is required",
            "data": None
        }, status=http_status.HTTP_400_BAD_REQUEST)
    
    # Force a fresh database connection to avoid caching issues
    connection.close()
    
    existing_item = EbayItem.objects.filter(item_id=item_id).first()
    
    if existing_item:
        return Response({
            "success": True,
            "error": None,
            "data": {
                "exists": True,
                "listing": {
                    "id": str(existing_item.id),
                    "item_id": existing_item.item_id,
                    "title": existing_item.title,
                    "status": existing_item.status,
                    "current_price": str(existing_item.current_price) if existing_item.current_price else None,
                    "currency": existing_item.currency,
                    "condition": existing_item.condition,
                    "seller_username": existing_item.seller_username,
                    "view_item_url": existing_item.view_item_url,
                    "image_url": existing_item.image_url,
                    "created_at": existing_item.created_at.isoformat() if existing_item.created_at else None,
                }
            }
        })
    else:
        return Response({
            "success": True,
            "error": None,
            "data": {
                "exists": False
            }
        })

# Helper functions
def _parse_listing_status(listing_data: dict) -> str:
    """
    Parse listing status from eBay response
    """
    from datetime import datetime
    
    end_time = listing_data.get('end_time')
    if end_time:
        end_datetime = _parse_ebay_date(end_time)
        if end_datetime and end_datetime < datetime.now(end_datetime.tzinfo):
            return EbayItemStatus.ENDED
    
    # If we have a view URL and no end time has passed, consider it active
    if listing_data.get('view_item_url'):
        return EbayItemStatus.ACTIVE
    
    return EbayItemStatus.UNKNOWN

def _parse_ebay_date(date_string: str):
    """
    Parse eBay date string to Django DateTime
    """
    from datetime import datetime
    
    if not date_string:
        return None
    try:
        if 'T' in date_string:
            return datetime.fromisoformat(date_string.replace('Z', '+00:00'))
        else:
            return datetime.strptime(date_string, '%Y-%m-%d')
    except Exception as e:
        logger.error(f"Date parsing error: {e} for date: {date_string}")
        return None


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def get_all_listings_with_availability(request):
    """
    SINGLE API CALL: Get all listings with availability status
    GET /api/v1/ebay/get-all-listings-with-availability/
    """
    try:
        ebay_service = EbayService(sandbox=True, request=request)  # 🆕 UPDATED
        result = ebay_service.get_all_listings_with_availability()
        
        if 'error' in result:
            return Response({
                'success': False,
                'error': result['error'],
                'data': None
            }, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        return Response({
            'success': True,
            'error': None,
            'data': result
        }, status=http_status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error getting all listings with availability: {str(e)}", exc_info=True)
        return Response({
            'success': False,
            'error': str(e),
            'data': None
        }, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET', 'POST'])
@authentication_classes([])
@permission_classes([AllowAny])
@parser_classes([JSONParser])
@csrf_exempt
def ebay_settings(request):
    """
    Get or update eBay settings (global settings for all users)
    """
    try:
        # Get or create single settings object (ID=1)
        settings_obj, created = EbaySettings.objects.get_or_create(
            id=1,
            defaults={
                'dashboard_refresh_enabled': True,
                'dashboard_refresh_interval': 30,
                'auto_sync_enabled': True,
                'sync_interval': 15
            }
        )

        if request.method == 'GET':
            return Response({
                'success': True,
                'data': {
                    'dashboard': {
                        'refresh_enabled': settings_obj.dashboard_refresh_enabled,
                        'refresh_interval': settings_obj.dashboard_refresh_interval,
                    },
                    'sync': {
                        'auto_sync_enabled': settings_obj.auto_sync_enabled,
                        'sync_interval': settings_obj.sync_interval,
                    }
                }
            })
        
        elif request.method == 'POST':
            # Update settings
            dashboard_settings = request.data.get('dashboard', {})
            sync_settings = request.data.get('sync', {})
            
            if 'refresh_enabled' in dashboard_settings:
                settings_obj.dashboard_refresh_enabled = dashboard_settings['refresh_enabled']
            if 'refresh_interval' in dashboard_settings:
                settings_obj.dashboard_refresh_interval = max(5, dashboard_settings['refresh_interval'])
            
            if 'auto_sync_enabled' in sync_settings:
                settings_obj.auto_sync_enabled = sync_settings['auto_sync_enabled']
            if 'sync_interval' in sync_settings:
                settings_obj.sync_interval = max(1, sync_settings['sync_interval'])
            
            settings_obj.save()
            
            return Response({
                'success': True,
                'data': {
                    'dashboard': {
                        'refresh_enabled': settings_obj.dashboard_refresh_enabled,
                        'refresh_interval': settings_obj.dashboard_refresh_interval,
                    },
                    'sync': {
                        'auto_sync_enabled': settings_obj.auto_sync_enabled,
                        'sync_interval': settings_obj.sync_interval,
                    }
                }
            })
            
    except Exception as e:
        logger.error(f"Error in ebay_settings: {str(e)}")
        return Response({
            'success': False,
            'error': 'Failed to process eBay settings'
        }, status=500)


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def get_listing_by_sku(request, sku):
    """
    SIMPLE: Get eBay listing directly by SKU
    GET /api/v1/ebay/listing-by-sku/{sku}/
    """
    try:
        print(f"🔍 Direct eBay lookup for SKU: {sku}")
        
        ebay_service = EbayService(sandbox=True, request=request)  # 🆕 UPDATED
        
        # Get all listings and find matching SKU
        listings_result = ebay_service.get_all_listings_with_availability()
        
        if 'error' in listings_result:
            return Response({
                "success": False,
                "error": listings_result['error'],
                "data": None
            }, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        # Find listing with matching SKU
        matching_listing = None
        for listing in listings_result.get('listings', []):
            if listing.get('sku') == sku:
                matching_listing = listing
                break
        
        if matching_listing:
            print(f"✅ Found eBay listing for SKU: {sku}")
            return Response({
                "success": True,
                "error": None,
                "data": {
                    "exists": True,
                    "listing": {
                        "offer_id": matching_listing.get('offer_id'),
                        "listing_id": matching_listing.get('listing_id'),
                        "sku": matching_listing.get('sku'),
                        "price": matching_listing.get('price'),
                        "currency": matching_listing.get('currency', 'USD'),
                        "quantity": matching_listing.get('available_quantity', 0),
                        "listing_status": matching_listing.get('listing_status'),
                        "offer_status": matching_listing.get('offer_status'),
                        "title": matching_listing.get('inventory_details', {}).get('title'),
                        "listing_url": f"https://www.ebay.com/itm/{matching_listing.get('listing_id')}" if matching_listing.get('listing_id') else None
                    }
                }
            })
        else:
            print(f"❌ No eBay listing found for SKU: {sku}")
            return Response({
                "success": True,
                "error": None,
                "data": {
                    "exists": False,
                    "reason": "No eBay listing found with this SKU"
                }
            })
            
    except Exception as e:
        logger.error(f"Error getting listing by SKU: {str(e)}", exc_info=True)
        return Response({
            'success': False,
            'error': str(e),
            'data': None
        }, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
@parser_classes([JSONParser])
@csrf_exempt
def update_listing(request):
    """
    SIMPLIFIED: Update existing eBay listing (price, quantity)
    POST /api/v1/ebay/update-listing/
    """
    try:
        update_data = request.data
        
        # ✅ ONLY need these fields for eBay update
        required_fields = ['offer_id', 'new_price', 'new_quantity']
        for field in required_fields:
            if not update_data.get(field):
                return Response({
                    'success': False,
                    'error': f'Missing required field: {field}',
                    'data': None
                }, status=http_status.HTTP_400_BAD_REQUEST)
        
        # Initialize eBay service WITH REQUEST
        ebay_service = EbayService(sandbox=True, request=request)  # 🆕 UPDATED
        
        # Update the listing using eBay service
        result = ebay_service.update_listing(
            offer_id=update_data['offer_id'],
            new_price=update_data['new_price'],
            new_quantity=update_data['new_quantity']
        )
        
        if 'error' in result:
            return Response({
                'success': False,
                'error': result['error'],
                'data': None
            }, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        # ✅ NEW: Update the inventory item's is_listed status and timestamp
        try:
            # Get the SKU from the eBay offer to find the inventory item
            offer_id = update_data['offer_id']
            offer_details = ebay_service.debug_listing_state(offer_id)
            
            if offer_details and offer_details.get('sku'):
                sku = offer_details.get('sku')
                
                # Find inventory item by SKU/cert_number
                inventory_item = InventoryItem.objects.filter(
                    attributes__cert_number=sku
                ).first()
                
                if inventory_item:
                    # Update is_listed to True and timestamp
                    inventory_item.is_listed = True
                    inventory_item.last_updated = timezone.now()
                    inventory_item.save()
                    logger.info(f"✅ Updated inventory item {inventory_item.id} - is_listed=True")
                else:
                    logger.warning(f"⚠️ Inventory item with SKU {sku} not found")
                    
        except Exception as e:
            logger.error(f"❌ Failed to update inventory item is_listed status: {e}")
        
        return Response({
            'success': True,
            'error': None,
            'data': result
        }, status=http_status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error updating eBay listing: {str(e)}", exc_info=True)
        return Response({
            'success': False,
            'error': str(e),
            'data': None
        }, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
@parser_classes([JSONParser])
@csrf_exempt
def trigger_auto_sync(request):
    """
    MANUAL TRIGGER: Start auto sync process for unlisted items
    POST /api/v1/ebay/trigger-auto-sync/
    """
    try:
        print("=" * 50)
        print("🚀 MANUAL AUTO SYNC TRIGGERED")
        print("=" * 50)
        
        # Check if auto sync is enabled in settings
        settings_obj, _ = EbaySettings.objects.get_or_create(id=1)
        if not settings_obj.auto_sync_enabled:
            return Response({
                'success': False,
                'error': 'Auto sync is disabled in settings. Enable it first.',
                'data': None
            }, status=http_status.HTTP_400_BAD_REQUEST)
        
        # Initialize eBay service
        ebay_service = EbayService(sandbox=True, request=request)
        
        # Run auto sync
        result = ebay_service.auto_sync_listings()
        
        # Update last sync run time
        from django.utils import timezone
        settings_obj.last_sync_run = timezone.now()
        settings_obj.save()
        
        # Log the result
        logger.info(f"Auto sync completed: {result.get('processed', 0)} items processed")
        
        if result['success']:
            return Response({
                'success': True,
                'data': result,
                'error': None
            }, status=http_status.HTTP_200_OK)
        else:
            return Response({
                'success': False,
                'error': result.get('error', 'Auto sync failed'),
                'data': result
            }, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)
            
    except Exception as e:
        logger.error(f"Error in trigger_auto_sync: {str(e)}", exc_info=True)
        return Response({
            'success': False,
            'error': str(e),
            'data': None
        }, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def get_auto_sync_status(request):
    """
    GET current auto sync status and statistics
    GET /api/v1/ebay/auto-sync-status/
    """
    try:
        settings_obj, _ = EbaySettings.objects.get_or_create(id=1)
        
        # Get inventory statistics
        from inventory.models import InventoryItem
        total_items = InventoryItem.objects.count()
        listed_items = InventoryItem.objects.filter(is_listed=True).count()
        unlisted_items = InventoryItem.objects.filter(is_listed=False).count()
        
        # Get items that can be auto-listed (have cert_number)
        auto_listable_items = InventoryItem.objects.filter(
            is_listed=False,
            attributes__cert_number__isnull=False
        ).exclude(
            attributes__cert_number=''
        ).count()
        
        status_data = {
            'settings': {
                'auto_sync_enabled': settings_obj.auto_sync_enabled,
                'sync_interval': settings_obj.sync_interval,
                'last_sync_run': settings_obj.last_sync_run.isoformat() if settings_obj.last_sync_run else None,
            },
            'inventory_stats': {
                'total_items': total_items,
                'listed_items': listed_items,
                'unlisted_items': unlisted_items,
                'auto_listable_items': auto_listable_items,  # Items ready for auto-listing
            },
            'next_sync_estimate': None
        }
        
        # Calculate next sync time if auto sync is enabled
        if settings_obj.auto_sync_enabled and settings_obj.last_sync_run:
            from django.utils import timezone
            from datetime import timedelta
            next_sync = settings_obj.last_sync_run + timedelta(minutes=settings_obj.sync_interval)
            status_data['next_sync_estimate'] = next_sync.isoformat()
        
        return Response({
            'success': True,
            'data': status_data,
            'error': None
        }, status=http_status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error getting auto sync status: {str(e)}")
        return Response({
            'success': False,
            'error': str(e),
            'data': None
        }, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)