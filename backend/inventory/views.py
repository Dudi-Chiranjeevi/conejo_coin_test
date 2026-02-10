import uuid
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.contrib.auth import logout as dj_logout
from django.db.models import Q
import django_filters
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from common.services.firebase_service import firebase_service
from drf_spectacular.utils import extend_schema
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import AllowAny
from rest_framework import serializers
from .models import Category, Location, InventoryItem, StatusHistory
from .serializers import (
    CategorySerializer, LocationSerializer, InventoryItemSerializer,
    InventoryItemListSerializer, StatusHistorySerializer
)
import logging
from drf_spectacular.utils import extend_schema, OpenApiResponse
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
from common.auth.firebase_auth import FirebaseDRFAuthentication
from drf_spectacular.extensions import OpenApiAuthenticationExtension

logger = logging.getLogger(__name__)

def _delete_cookie_all(resp, name: str):
    # Delete with exact attributes (SameSite from settings + path=/)
    resp.delete_cookie(name, path="/", samesite=settings.SESSION_COOKIE_SAMESITE, domain=None)
    resp.delete_cookie(name, path="/", samesite=settings.SESSION_COOKIE_SAMESITE, domain="localhost")
    # Legacy variants just in case
    resp.delete_cookie(name, path="/")
    resp.delete_cookie(name)
    # Overwrite expired (belt & suspenders)
    resp.set_cookie(
        name, "",
        max_age=0, expires="Thu, 01 Jan 1970 00:00:00 GMT",
        path="/", httponly=settings.SESSION_COOKIE_HTTPONLY, secure=settings.SESSION_COOKIE_SECURE, samesite=settings.SESSION_COOKIE_SAMESITE
    )

class CsrfExemptSessionAuthentication(SessionAuthentication):
    def enforce_csrf(self, request):
        return  # Disable CSRF for APIView

class CsrfExemptSessionAuthenticationScheme(OpenApiAuthenticationExtension):
    """OpenAPI extension for CsrfExemptSessionAuthentication"""
    
    target_class = 'inventory.views.CsrfExemptSessionAuthentication'
    name = 'CsrfExemptSession'
    
    def get_security_definition(self, auto_schema):
        return {
            'type': 'apiKey',
            'in': 'cookie',
            'name': 'sessionid',
            'description': 'Django session authentication with CSRF enforcement disabled'
        }

class CategoryViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing categories with hierarchical support
    """
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    search_fields = ['name']
    filterset_fields = ['parent', 'client_id']

    def get_queryset(self):
        """Filter by client_id if provided"""
        queryset = self.queryset
        client_id = self.request.query_params.get('client_id')
        if client_id:
            queryset = queryset.filter(client_id=client_id)
        return queryset.select_related('parent')

    @action(detail=False, methods=['get'])
    def tree(self, request):
        """Return categories as a hierarchical tree"""
        client_id = request.query_params.get('client_id')
        if not client_id:
            return Response(
                {"error": "client_id parameter is required"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get root categories (no parent)
        root_categories = Category.objects.filter(
            parent__isnull=True, 
            client_id=client_id
        )
        serializer = self.get_serializer(root_categories, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def items(self, request, pk=None):
        """Get all inventory items in this category"""
        category = self.get_object()
        items = InventoryItem.objects.filter(category=category)
        
        # Apply additional filters
        status_filter = request.query_params.get('status')
        if status_filter:
            items = items.filter(status=status_filter)
        
        serializer = InventoryItemListSerializer(items, many=True)
        return Response(serializer.data)


# class LocationViewSet(viewsets.ModelViewSet):
#     """
#     ViewSet for managing hierarchical locations
#     """
#     queryset = Location.objects.all()
#     serializer_class = LocationSerializer
#     permission_classes = [IsAuthenticated]
#     filter_backends = [DjangoFilterBackend, filters.SearchFilter]
#     search_fields = ['name', 'type']
#     filterset_fields = ['type', 'parent', 'client_id']

#     def get_queryset(self):
#         """Filter by client_id if provided"""
#         queryset = self.queryset
#         client_id = self.request.query_params.get('client_id')
#         if client_id:
#             queryset = queryset.filter(client_id=client_id)
#         return queryset.select_related('parent')

#     @action(detail=False, methods=['get'])
#     def tree(self, request):
#         """Return locations as a hierarchical tree"""
#         client_id = request.query_params.get('client_id')
#         if not client_id:
#             return Response(
#                 {"error": "client_id parameter is required"}, 
#                 status=status.HTTP_400_BAD_REQUEST
#             )
        
#         root_locations = Location.objects.filter(
#             parent__isnull=True, 
#             client_id=client_id
#         )
#         serializer = self.get_serializer(root_locations, many=True)
#         return Response(serializer.data)

#     @action(detail=True, methods=['get'])
#     def items(self, request, pk=None):
#         """Get all inventory items at this location"""
#         location = self.get_object()
#         items = InventoryItem.objects.filter(location=location)
        
#         # Apply additional filters
#         status_filter = request.query_params.get('status')
#         if status_filter:
#             items = items.filter(status=status_filter)
        
#         serializer = InventoryItemListSerializer(items, many=True)
#         return Response(serializer.data)


class InventoryItemFilter(django_filters.FilterSet):
    """Custom filter set for inventory items"""
    min_price = django_filters.NumberFilter(field_name="price", lookup_expr='gte')
    max_price = django_filters.NumberFilter(field_name="price", lookup_expr='lte')
    date_added_after = django_filters.DateFilter(field_name="date_added", lookup_expr='gte')
    date_added_before = django_filters.DateFilter(field_name="date_added", lookup_expr='lte')
    has_images = django_filters.BooleanFilter(method='filter_has_images')
    search_attributes = django_filters.CharFilter(method='filter_search_attributes')
    name__istartswith = django_filters.CharFilter(field_name='name', lookup_expr='istartswith')
    category__name = django_filters.CharFilter(field_name='category__name', lookup_expr='iexact')
    category__name__istartswith = django_filters.CharFilter(field_name='category__name', lookup_expr='istartswith')
    category = django_filters.UUIDFilter(field_name="category_id")
    location = django_filters.UUIDFilter(field_name="location_id")
    client_id = django_filters.UUIDFilter(field_name="client_id")
    location_in = django_filters.CharFilter(method='filter_location_in')
    identification_number = django_filters.CharFilter(field_name='identification_number', lookup_expr='icontains')

    class Meta:
        model = InventoryItem
        fields = [
            'status', 'category', 'location', 'is_consigned', 
            'weight_unit', 'client_id', 'is_listed', 
            'identification_number'
        ]

    def filter_has_images(self, queryset, name, value):
        """Filter items that have images"""
        if value:
            return queryset.exclude(images__exact=[])
        return queryset.filter(images__exact=[])

    def filter_search_attributes(self, queryset, name, value):
        """Search within JSONB attributes field"""
        return queryset.filter(
            Q(attributes__icontains=value) |
            Q(name__icontains=value) |
            Q(description__icontains=value)
        )

    def filter_location_in(self, queryset, name, value):
        """Filter by multiple location IDs (comma-separated)"""
        if not value:
            return queryset
        try:
            # Split comma-separated location IDs
            location_ids = [loc_id.strip() for loc_id in value.split(',') if loc_id.strip()]
            # Validate UUIDs

            valid_location_ids = []

            for loc_id in location_ids:
                try:
                    uuid.UUID(loc_id)
                    valid_location_ids.append(loc_id)
                except ValueError:
                    continue            

            if valid_location_ids:
                return queryset.filter(location_id__in=valid_location_ids)
            return queryset

        except Exception as e:
            logger.error(f"Error in location__in filter: {e}")
            return queryset    


class InventoryItemViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing inventory items with advanced filtering
    """
    queryset = InventoryItem.objects.all()
    authentication_classes = [FirebaseDRFAuthentication]
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = InventoryItemFilter
    search_fields = ['name', 'description', 'notes','identification_number']
    ordering_fields = ['name', 'price', 'date_added', 'status', 'updated_at']
    ordering = ['-updated_at', '-date_added']
    
    def _is_uuid(self, value):
        """
        Check if a value is a valid UUID
        """
        try:
            uuid.UUID(str(value))
            return True
        except (ValueError, TypeError):
            return False
    
    def _get_category_by_name_or_id(self, name_or_id, client_id):
        """
        Helper method to get category by name or ID
        """
        try:
            # First try to parse as UUID
            category_id = uuid.UUID(str(name_or_id))
            return Category.objects.get(id=category_id, client_id=client_id)
        except (ValueError, TypeError, Category.DoesNotExist):
            # If not a valid UUID, try to find by name
            try:
                return Category.objects.get(name=name_or_id, client_id=client_id)
            except Category.DoesNotExist:
                raise serializers.ValidationError(f"Category '{name_or_id}' not found")
    
    def _get_location_by_path_or_id(self, path_or_id, client_id):
        """
        Helper method to get location by path or ID
        """
        try:
            # First try to parse as UUID
            location_id = uuid.UUID(str(path_or_id))
            return Location.objects.get(id=location_id, client_id=client_id)
        except (ValueError, TypeError, Location.DoesNotExist):
            # If not a valid UUID, try to find by path
            try:
                return Location.objects.get(path=path_or_id, client_id=client_id)
            except Location.DoesNotExist:
                raise serializers.ValidationError(f"Location with path '{path_or_id}' not found")

    def get_serializer_class(self):
        """Use lightweight serializer for list view"""
        if self.action == 'list':
            return InventoryItemListSerializer
        return InventoryItemSerializer

    def get_queryset(self):
        """Optimize queries with select_related"""
        queryset = self.queryset.select_related(
            'category', 'location'
        ).prefetch_related('status_history')
        
        client_id = self.request.query_params.get('client_id')
        identification_number = self.request.query_params.get('identification_number')

        if identification_number:

            logger.info(f"Searching for identification_number: {identification_number}")

            queryset = queryset.filter(

                Q(identification_number__icontains=identification_number) |

                Q(attributes__identification_number__icontains=identification_number)

            )


        if client_id:
            queryset = queryset.filter(client_id=client_id)
        
        location_in = self.request.query_params.get('location__in')

        if location_in:

            logger.info(f"📍 [BACKEND] location__in filter received: {location_in}")

        return queryset
        
    def update(self, request, *args, **kwargs):
        """Override update to handle updated_by field"""
        logger.info(f"UPDATE API CALL - Request data: {request.data}")
        
        # Get the updated_by value from request data
        updated_by = request.data.get('updated_by')
        
        # Get the object to update
        partial = kwargs.pop('partial', False)
        instance = self.get_object()

        # ✅ CHECK: If price changed and item is listed on eBay
        new_price = request.data.get('price')
        price_changed = False
        
        if (new_price and 
            instance.is_listed and 
            float(new_price) != float(instance.price)):
            
            # Auto-set is_listed to false when price changes
            request.data['is_listed'] = False
            price_changed = True
            logger.info(f"Price changed from {instance.price} to {new_price} - setting is_listed=False")
        
        # Use the serializer to validate the data
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        
        # Save the instance
        self.perform_update(serializer)
        
        # ✅ FORCE SAVE is_listed if price changed
        if price_changed:
            instance.refresh_from_db()  # Refresh to get latest data
            instance.is_listed = False
            # Save with both updated_by and is_listed
            update_fields = ['is_listed']
            if updated_by:
                instance.updated_by = updated_by
                update_fields.append('updated_by')
            instance.save(update_fields=update_fields)
            logger.info(f"✅ Successfully set is_listed=False for item {instance.id}")
        else:
            # Only set updated_by if no price change
            if updated_by:
                logger.info(f"Setting updated_by to: {updated_by}")
                instance.updated_by = updated_by
                instance.save(update_fields=['updated_by'])
        
        if getattr(instance, '_prefetched_objects_cache', None):
            # If 'prefetch_related' has been applied to a queryset, we need to
            # forcibly invalidate the prefetch cache on the instance.
            instance._prefetched_objects_cache = {}

        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        """Override create to handle category and location as either name/path or UUID"""
        import logging
        logger = logging.getLogger(__name__)
        
        # Log the incoming request data for debugging
        logger.info(f"CREATE API CALL - Request data: {request.data}")
        
        data = request.data.copy()
        client_id = data.get('client_id')
        logger.info(f"Processing create with client_id: {client_id}")
        
        # Get the created_by value from request data
        created_by = data.get('created_by')
        
        # Handle category by name or ID
        if 'category' in data and not self._is_uuid(data['category']):
            logger.info(f"Resolving category name: {data['category']}")
            category = self._get_category_by_name_or_id(data['category'], client_id)
            data['category'] = category.id
            logger.info(f"Resolved category to UUID: {category.id}")
            
        # Handle location by path or ID
        if 'location' in data and not self._is_uuid(data['location']):
            logger.info(f"Resolving location path: {data['location']}")
            location = self._get_location_by_path_or_id(data['location'], client_id)
            data['location'] = location.id
            logger.info(f"Resolved location to UUID: {location.id}")
            
        # Update request data with resolved IDs
        request._full_data = data
        logger.info(f"Final processed data for create: {data}")
        
        # Call the parent create method and log the result
        response = super().create(request, *args, **kwargs)
        logger.info(f"Created inventory item with ID: {response.data.get('id')}")
        
        # Set created_by field if provided
        if created_by:
            logger.info(f"Setting created_by to: {created_by}")
            # Get the newly created instance
            instance_id = response.data.get('id')
            if instance_id:
                instance = InventoryItem.objects.get(id=instance_id)
                instance.created_by = created_by
                instance.updated_by = created_by  # Also set updated_by on creation
                instance.save(update_fields=['created_by', 'updated_by'])
                
                # Update the response data
                serializer = self.get_serializer(instance)
                response.data = serializer.data
        
        return response

    @action(detail=True, methods=['patch'])
    def update_status(self, request, pk=None):
        """Update only the status of an item"""
        item = self.get_object()
        new_status = request.data.get('status')
        notes = request.data.get('notes', '')
        
        if new_status not in dict(InventoryItem.STATUS_CHOICES):
            return Response(
                {"error": "Invalid status"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        old_status = item.status
        item.status = new_status
        item.save(update_fields=['status', 'updated_at'])
        
        # Create status history entry
        StatusHistory.objects.create(
            item=item,
            old_status=old_status,
            new_status=new_status,
            user=request.user,
            notes=notes
        )
        
        serializer = self.get_serializer(item)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def by_status(self, request):
        """Get items grouped by status"""
        client_id = request.query_params.get('client_id')
        if not client_id:
            return Response(
                {"error": "client_id parameter is required"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        result = {}
        for status_code, status_label in InventoryItem.STATUS_CHOICES:
            items = InventoryItem.objects.filter(
                status=status_code, 
                client_id=client_id
            ).select_related('category', 'location')
            
            serializer = InventoryItemListSerializer(items, many=True)
            result[status_code] = {
                'label': status_label,
                'count': items.count(),
                'items': serializer.data
            }
        
        return Response(result)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get inventory statistics"""
        client_id = request.query_params.get('client_id')
        if not client_id:
            return Response(
                {"error": "client_id parameter is required"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        queryset = InventoryItem.objects.filter(client_id=client_id)
        
        stats = {
            'total_items': queryset.count(),
            'total_value': sum(item.price for item in queryset),
            'by_status': {},
            'by_category': {},
            'consigned_items': queryset.filter(is_consigned=True).count(),
        }
        
        # Count by status
        for status_code, status_label in InventoryItem.STATUS_CHOICES:
            count = queryset.filter(status=status_code).count()
            stats['by_status'][status_code] = {
                'label': status_label,
                'count': count
            }
        
        # Count by category
        categories = Category.objects.filter(client_id=client_id)
        for category in categories:
            count = queryset.filter(category=category).count()
            if count > 0:
                stats['by_category'][str(category.id)] = {
                    'name': category.name,
                    'count': count
                }
        
        return Response(stats)

    @action(detail=False, methods=['post'])
    def bulk_update_status(self, request):
        """Bulk update status for multiple items"""
        item_ids = request.data.get('item_ids', [])
        new_status = request.data.get('status')
        notes = request.data.get('notes', '')
        
        if not item_ids or not new_status:
            return Response(
                {"error": "item_ids and status are required"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if new_status not in dict(InventoryItem.STATUS_CHOICES):
            return Response(
                {"error": "Invalid status"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        items = InventoryItem.objects.filter(id__in=item_ids)
        updated_count = 0
        
        for item in items:
            old_status = item.status
            if old_status != new_status:
                item.status = new_status
                item.save(update_fields=['status', 'updated_at'])
                
                # Create status history entry
                StatusHistory.objects.create(
                    item=item,
                    old_status=old_status,
                    new_status=new_status,
                    user=request.user,
                    notes=notes
                )
                updated_count += 1
        
        return Response({
            'message': f'Updated {updated_count} items',
            'updated_count': updated_count
        })

    @action(detail=False, methods=["post"])
    def get_upload_url(self, request):
        file_name = request.data.get("filename")
        content_type = request.data.get("content_type")

        if not file_name or not content_type:
            return Response({"error": "Missing filename or content type"}, status=400)

        bucket_name = settings.GOOGLE_CLOUD_STORAGE_BUCKET
        destination_blob_name = f"inventory/{uuid.uuid4()}_{file_name}"

        storage_client = storage.Client()
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(destination_blob_name)

        url = blob.generate_signed_url(
            version="v4",
            expiration=timedelta(minutes=10),
            method="PUT",
            content_type=content_type,
        )

        return Response({
            "upload_url": url,
            "public_url": f"{settings.GCS_PUBLIC_URL}/{bucket_name}/{destination_blob_name}"
        })

class StatusHistoryViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only ViewSet for status history
    """
    queryset = StatusHistory.objects.all()
    serializer_class = StatusHistorySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['item', 'old_status', 'new_status', 'user']
    ordering = ['-timestamp']

    def get_queryset(self):
        """Optimize queries"""
        return self.queryset.select_related('item', 'user')

# Authentication functionality has been moved to common/auth/views.py
# Keeping this code commented for reference

'''
class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()

# @method_decorator(csrf_exempt, name='dispatch')
class AuthViewSet(viewsets.ViewSet):
    """
    A ViewSet for Firebase-based login, logout, and token refresh.
    """
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [AllowAny]

    @extend_schema(
        request=LoginSerializer,
        responses={
            200: OpenApiResponse(description="Login successful"),
            400: OpenApiResponse(description="Validation error"),
            401: OpenApiResponse(description="Authentication failed"),
            500: OpenApiResponse(description="Internal server error"),
        },
    )
    @action(detail=False, methods=["post"], url_path="login")
    def login(self, request):
        try:
            logger.info("[AUTH] Login attempt")
            serializer = LoginSerializer(data=request.data)
            if not serializer.is_valid():
                logger.warning(f"[AUTH] Login validation failed: {serializer.errors}")
                return Response(
                    {"success": False, "errors": serializer.errors},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            email = serializer.validated_data.get("email")
            password = serializer.validated_data.get("password")
            if not email or not password:
                logger.warning("[AUTH] Login attempt with missing email or password")
                return Response(
                    {"success": False, "error": "Email and password required"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Authenticate with Firebase (custom service should return (bool, dict))
            logger.info(f"[AUTH] Authenticating user {email} with Firebase")
            success, auth_data = firebase_service.authenticate_user(email, password)
            if not success:
                error_msg = (auth_data or {}).get("error", "Authentication failed")
                logger.warning(f"[AUTH] Firebase authentication failed: {error_msg}")
                return Response(
                    {
                        "success": False,
                        "error": error_msg,
                    },
                    status=status.HTTP_401_UNAUTHORIZED,
                )

            # Verify ID token returned by Firebase
            id_token = auth_data.get("id_token")
            if not id_token:
                logger.error("[AUTH] Firebase authentication succeeded but no id_token returned")
                return Response(
                    {"success": False, "error": "Missing id_token"},
                    status=status.HTTP_401_UNAUTHORIZED,
                )

            logger.info("[AUTH] Verifying Firebase ID token")
            firebase_user = firebase_service.verify_id_token(id_token)
            if not firebase_user:
                logger.error("[AUTH] Firebase token verification failed")
                return Response(
                    {"success": False, "error": "Invalid Firebase token"},
                    status=status.HTTP_401_UNAUTHORIZED,
                )

            # Optionally grab a refresh token if your service returns it
            refresh_token = auth_data.get("refresh_token")
            expires_in = auth_data.get("expires_in")  # seconds, as provided by Firebase
            
            logger.info(f"[AUTH] Login successful for user {firebase_user.get('email')} (uid: {firebase_user.get('uid')})")

            # Build response with user info from Firebase (no Django user creation)
            user_name = firebase_user.get("name") or ""
            name_parts = user_name.split()
            first_name = name_parts[0] if name_parts else ""
            last_name = name_parts[-1] if len(name_parts) > 1 else ""

            response = Response(
                {
                    "success": True,
                    "user": {
                        "id": firebase_user.get("uid"),
                        "email": firebase_user.get("email"),
                        "firstName": first_name,
                        "lastName": last_name,
                    },
                },
                status=status.HTTP_200_OK,
            )

            try:
                response.delete_cookie("logout_sentinel", path="/", samesite="Lax")
            except TypeError:
                # older Django fallback
                response.delete_cookie("logout_sentinel", path="/")

            # Set auth cookies using Django session settings
            # Fallbacks if expires_in is missing: use Django's SESSION_COOKIE_AGE
            max_age = int(expires_in) if expires_in is not None else settings.SESSION_COOKIE_AGE
            
            logger.info(f"[AUTH] Setting firebase_token cookie (max_age: {max_age}, secure: {settings.SESSION_COOKIE_SECURE}, httponly: {settings.SESSION_COOKIE_HTTPONLY}, samesite: {settings.SESSION_COOKIE_SAMESITE})")

            response.set_cookie(
                "firebase_token",
                id_token,
                max_age=max_age,
                httponly=settings.SESSION_COOKIE_HTTPONLY,
                secure=settings.SESSION_COOKIE_SECURE,
                samesite=settings.SESSION_COOKIE_SAMESITE,
                path="/",
            )

            if refresh_token:
                logger.info("[AUTH] Setting firebase_refresh cookie (30 days)")
                # 30 days
                response.set_cookie(
                    "firebase_refresh",
                    refresh_token,
                    # For refresh token, we use a longer expiry (30 days) than regular session
                    max_age=30*24*3600,
                    httponly=settings.SESSION_COOKIE_HTTPONLY,
                    secure=settings.SESSION_COOKIE_SECURE,
                    samesite=settings.SESSION_COOKIE_SAMESITE,
                    path="/",
                )

            return response

        except Exception as e:
            logger.exception(f"[AUTH] Login error: {str(e)}")
            return Response(
                {"success": False, "error": "Internal server error"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @extend_schema(
        request=None,
        responses={200: OpenApiResponse(description="Logout successful")},
    )
    @action(detail=False, methods=["post"], url_path="logout")
    def logout_view(self, request):
        logger.info("[AUTH] Logout request received")
        dj_logout(request)
        resp = Response({"success": True})

        for c in ["firebase_token", "firebase_refresh", "sessionid"]:
            _delete_cookie_all(resp, c)
            logger.info(f"[AUTH] Deleted cookie: {c}")

        # Set a sentinel to prevent refresh right after logout (5 minutes)
        logger.info("[AUTH] Setting logout sentinel cookie (5 minutes)")
        resp.set_cookie(
            "logout_sentinel", "1",
            max_age=300, path="/", httponly=False, secure=False, samesite="Lax"
        )
        return resp


    @extend_schema(
        request=None,
        responses={
            200: OpenApiResponse(description="Refresh successful"),
            401: OpenApiResponse(description="Token refresh failed"),
        },
    )
    @action(detail=False, methods=["post"], url_path="refresh")
    def refresh(self, request):
        logger.info("[AUTH] Token refresh request received")
        # Block refresh if user just logged out
        if request.COOKIES.get("logout_sentinel") == "1":
            logger.warning("[AUTH] Token refresh blocked by logout sentinel")
            return Response({"success": False, "error": "Logged out"}, status=401)

        refresh_token = request.COOKIES.get("firebase_refresh")
        if not refresh_token:
            logger.warning("[AUTH] Token refresh failed - no refresh token in cookies")
            return Response({"success": False, "error": "No refresh token"}, status=401)

        logger.info("[AUTH] Attempting to refresh Firebase token")
        success, token_data = firebase_service.refresh_token(refresh_token)
        if not success or not token_data:
            logger.error("[AUTH] Firebase token refresh failed")
            return Response({"success": False, "error": "Token refresh failed"}, status=401)

        id_token = token_data.get("id_token")
        expires_in = int(token_data.get("expires_in", 3600))
        new_refresh = token_data.get("refresh_token", refresh_token)
        
        logger.info(f"[AUTH] Token refresh successful (expires_in: {expires_in}s)")

        resp = Response({"success": True, "expires_in": expires_in})
        # Set cookies for cross-site
        logger.info("[AUTH] Setting new firebase_token cookie")
        resp.set_cookie("firebase_token", id_token, max_age=expires_in,
                        httponly=settings.SESSION_COOKIE_HTTPONLY, secure=settings.SESSION_COOKIE_SECURE, 
                        samesite=settings.SESSION_COOKIE_SAMESITE, path="/")
        logger.info("[AUTH] Setting new firebase_refresh cookie")
        resp.set_cookie("firebase_refresh", new_refresh, max_age=30*24*3600,
                        httponly=settings.SESSION_COOKIE_HTTPONLY, secure=settings.SESSION_COOKIE_SECURE, 
                        samesite=settings.SESSION_COOKIE_SAMESITE, path="/")
        # Clear sentinel on successful refresh (user is actively renewing)
        resp.delete_cookie("logout_sentinel", path="/", samesite=settings.SESSION_COOKIE_SAMESITE)
        return resp

    @extend_schema(request=None, responses={200: OpenApiResponse(description="Auth status returned")})
    @action(detail=False, methods=["get"], url_path="status")
    def status(self, request):
        logger.info("[AUTH] Status check request received")
        # If sentinel exists, treat as logged out regardless of stray cookies
        if request.COOKIES.get("logout_sentinel") == "1":
            logger.info("[AUTH] Status check - logout sentinel found, returning unauthenticated")
            return Response({"authenticated": False}, status=200)

        token = request.COOKIES.get("firebase_token")
        if not token:
            logger.info("[AUTH] Status check - no firebase_token cookie, returning unauthenticated")
            return Response({"authenticated": False}, status=200)

        logger.info("[AUTH] Status check - verifying firebase_token")
        user = firebase_service.verify_id_token(token)
        if not user:
            logger.warning("[AUTH] Status check - invalid or expired token")
            return Response({"authenticated": False}, status=200)

        logger.info(f"[AUTH] Status check - authenticated user: {user.get('email')} (uid: {user.get('uid')})")
        name = (user.get("name") or "").split()
        return Response({
            "authenticated": True,
            "user": {
                "id": user.get("uid"),
                "email": user.get("email"),
                "firstName": name[0] if name else "",
                "lastName": name[-1] if len(name) > 1 else "",
            }
        })

    #password reset
    @extend_schema(
        request=None,
        responses={200: OpenApiResponse(description="Password reset email sent"),
                   400: OpenApiResponse(description="Invalid request")},
    )
    @action(detail=False, methods=["post"], url_path="forgot-password")
    def forgot_password(self, request):
        """
        Sends a Firebase password reset email.
        """
        email = request.data.get("email")
        if not email:
            return Response(
                {"success": False, "error": "Email is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
 
        success = firebase_service.send_password_reset_email(email)
        if success:
            return Response(
                {"success": True, "message": f"Password reset email sent to {email}"},
                status=status.HTTP_200_OK,
            )
        else:
            return Response(
                {"success": False, "error": "Failed to send reset email"},
                status=status.HTTP_400_BAD_REQUEST,
            )
'''
        
class TestAuthView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [FirebaseDRFAuthentication]
    
    class OutputSerializer(serializers.Serializer):
        user = serializers.CharField()
        authenticated = serializers.BooleanField()
    
    @extend_schema(
        responses={200: OutputSerializer},
        description="Test endpoint to verify authentication status"
    )
    def get(self, request):
        return Response({
            "user": str(request.user),
            "authenticated": request.user.is_authenticated,
    })
