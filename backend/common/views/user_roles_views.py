from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from common.models import UserRoles, Module, ModulePermission
from common.serializers import UserRolesSerializer, UserRolesCreateUpdateSerializer, PermissionMatrixUpdateSerializer
from common.services.firebase_service import firebase_service
import logging
 
logger = logging.getLogger(__name__)
 
class IsAdminUser:
    """
    Custom permission to only allow admin users
    """
    def has_permission(self, request, view):
        # Get Firebase token from request
        firebase_token = request.COOKIES.get('firebase_token')
        if not firebase_token:
            print("🔐 [IsAdminUser] No Firebase token found")
            return False
       
        try:
            # Verify the token to get user info
            decoded_token = firebase_service.verify_id_token(firebase_token)
            if not decoded_token:
                print("🔐 [IsAdminUser] Invalid Firebase token")
                return False
           
            # Get user UID and fetch role from Firestore
            uid = decoded_token.get('uid')
            user_data = firebase_service.get_user_data(uid) or {}
            role = user_data.get('role', 'user').lower()
           
            print(f"🔐 [IsAdminUser] User role from Firestore: '{role}'")
           
            # Check if user has admin privileges
            allowed_roles = ['admin', 'superadmin', 'super-admin', 'owner']
            has_access = role in allowed_roles
           
            print(f"🔐 [IsAdminUser] Access {'GRANTED' if has_access else 'DENIED'}")
            return has_access
           
        except Exception as e:
            print(f"🔐 [IsAdminUser] Error checking permissions: {e}")
            return False
 
class UserRolesListView(APIView):
    """
    List all UserRoles or create a new UserRole
    """
    def get_permissions(self):
        return [IsAdminUser()]
   
    def get(self, request):
        """Get all UserRoles"""
        try:
            user_roles = UserRoles.objects.all().order_by('role_name')
            serializer = UserRolesSerializer(user_roles, many=True)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Error fetching UserRoles: {str(e)}")
            return Response(
                {'error': 'Failed to fetch roles'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
   
    def post(self, request):
        """Create a new UserRole"""
        logger.info(f"📨 [UserRoles API] Received POST request with data: {request.data}")
       
        serializer = UserRolesCreateUpdateSerializer(data=request.data)
        if serializer.is_valid():
            try:
                # Get Firebase token from request
                firebase_token = request.COOKIES.get('firebase_token')
                firebase_uid = None
                firebase_email = None
               
                logger.info(f"🔐 [UserRoles API] Firebase token present: {firebase_token is not None}")
               
                if firebase_token:
                    # Verify the token to get user info
                    decoded_token = firebase_service.verify_id_token(firebase_token)
                    if decoded_token:
                        firebase_uid = decoded_token.get('uid')
                        firebase_email = decoded_token.get('email')
                        logger.info(f"👤 [UserRoles API] Creating as Firebase user: {firebase_email} ({firebase_uid})")
                    else:
                        logger.warning("❌ [UserRoles API] Firebase token verification failed")
                else:
                    logger.warning("❌ [UserRoles API] No Firebase token found in cookies")
               
                # CHANGED: No need to manually convert to lowercase - serializer handles it now
                role_name = serializer.validated_data['role_name']
                description = serializer.validated_data.get('description', '')
               
                logger.info(f"🔤 [UserRoles API] Using lowercase data - role_name: '{role_name}', description: '{description}'")
               
                # Create the UserRole with Firebase user information
                user_role_data = {
                    'role_name': role_name,  # Already lowercase from serializer
                    'description': description,  # Already lowercase from serializer
                    'created_by_uid': firebase_uid,  # Keep as-is (UID)
                    'created_by_email': firebase_email,  # Keep as-is (email)
                    'updated_by_uid': firebase_uid,  # Keep as-is (UID)
                    'updated_by_email': firebase_email,  # Keep as-is (email)
                }
               
                logger.info(f"💾 [UserRoles API] Creating UserRole with data: {user_role_data}")
               
                user_role = UserRoles.objects.create(**user_role_data)
               
                logger.info(f"✅ [UserRoles API] UserRole created successfully: {user_role.role_name} (ID: {user_role.id})")
               
                # Return the created role
                response_serializer = UserRolesSerializer(user_role)
                return Response(response_serializer.data, status=status.HTTP_201_CREATED)
               
            except Exception as e:
                logger.error(f"💥 [UserRoles API] Error creating UserRole: {str(e)}", exc_info=True)
                return Response(
                    {'error': f'Failed to create role: {str(e)}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
       
        logger.error(f"❌ [UserRoles API] Serializer validation failed: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
 
class UserRolesDetailView(APIView):
    """
    Retrieve, update or delete a UserRole
    """
    def get_permissions(self):
        return [IsAdminUser()]
   
    def get_object(self, pk):
        try:
            return UserRoles.objects.get(pk=pk)
        except UserRoles.DoesNotExist:
            return None
   
    def get(self, request, pk):
        """Get a specific UserRole"""
        user_role = self.get_object(pk)
        if not user_role:
            return Response(
                {'error': 'Role not found'},
                status=status.HTTP_404_NOT_FOUND
            )
       
        serializer = UserRolesSerializer(user_role)
        return Response(serializer.data)
   
    def put(self, request, pk):
        """Update a UserRole"""
        user_role = self.get_object(pk)
        if not user_role:
            return Response(
                {'error': 'Role not found'},
                status=status.HTTP_404_NOT_FOUND
            )
       
        serializer = UserRolesCreateUpdateSerializer(user_role, data=request.data)
        if serializer.is_valid():
            try:
                # Get Firebase token from request for updated_by
                firebase_token = request.COOKIES.get('firebase_token')
                firebase_uid = None
                firebase_email = None
               
                if firebase_token:
                    decoded_token = firebase_service.verify_id_token(firebase_token)
                    if decoded_token:
                        firebase_uid = decoded_token.get('uid')
                        firebase_email = decoded_token.get('email')
                        logger.info(f"👤 [UserRoles API] Updating as Firebase user: {firebase_email} ({firebase_uid})")
               
                # CHANGED: No need to manually convert to lowercase - serializer handles it now
                logger.info(f"🔤 [UserRoles API] Using lowercase data from serializer")
               
                # Save the role and update user fields
                updated_role = serializer.save()
                if firebase_uid or firebase_email:
                    updated_role.updated_by_uid = firebase_uid
                    updated_role.updated_by_email = firebase_email
                    updated_role.save()
               
                # Return updated role
                response_serializer = UserRolesSerializer(updated_role)
                return Response(response_serializer.data)
            except Exception as e:
                logger.error(f"💥 [UserRoles API] Error updating UserRole: {str(e)}", exc_info=True)
                return Response(
                    {'error': f'Failed to update role: {str(e)}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
       
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
   
    def delete(self, request, pk):
        """Delete a UserRole"""
        user_role = self.get_object(pk)
        if not user_role:
            return Response(
                {'error': 'Role not found'},
                status=status.HTTP_404_NOT_FOUND
            )
       
        try:
            user_role.delete()
            return Response(
                {'success': True, 'message': 'Role deleted successfully'},
                status=status.HTTP_200_OK
            )
        except Exception as e:
            logger.error(f"💥 [UserRoles API] Error deleting UserRole: {str(e)}", exc_info=True)
            return Response(
                {'error': f'Failed to delete role: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
 
class PermissionMatrixView(APIView):
    """
    Handle permission matrix updates for ModulePermissions
    """
    def get_permissions(self):
        return [IsAdminUser()]
   
    def get(self, request):
        """Get all module permissions for the matrix"""
        try:
            roles = UserRoles.objects.all()
            modules = Module.objects.filter(is_active=True)
           
            matrix_data = {}
           
            for role in roles:
                matrix_data[str(role.id)] = {}
                for module in modules:
                    try:
                        perm = ModulePermission.objects.get(user_role=role, module=module)
                        matrix_data[str(role.id)][str(module.module_id)] = {
                            'can_view': perm.can_view,
                            'can_create': perm.can_create,
                            'can_edit': perm.can_edit,
                            'can_delete': perm.can_delete,
                            'module_name': perm.module_name  # ADDED: Include module_name in response (already lowercase)
                        }
                    except ModulePermission.DoesNotExist:
                        matrix_data[str(role.id)][str(module.module_id)] = {
                            'can_view': False,
                            'can_create': False,
                            'can_edit': False,
                            'can_delete': False,
                            'module_name': module.module_name  # ADDED: Include module_name even for non-existent permissions (already lowercase)
                        }
           
            logger.info(f"📊 [PermissionMatrix] Returning matrix data for {len(roles)} roles and {len(modules)} modules")
            return Response(matrix_data)
           
        except Exception as e:
            logger.error(f"💥 [PermissionMatrix] Error fetching permissions: {str(e)}", exc_info=True)
            return Response(
                {'error': f'Failed to fetch permissions: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
   
    def post(self, request):
        """Save permission matrix changes"""
        try:
            # Use the serializer for validation
            serializer = PermissionMatrixUpdateSerializer(data=request.data)
            if not serializer.is_valid():
                logger.error(f"❌ [PermissionMatrix] Validation failed: {serializer.errors}")
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
           
            permission_data = serializer.validated_data.get('permissions', {})
           
            logger.info(f"📊 [PermissionMatrix] Received permission data for {len(permission_data)} roles")
           
            # Update Firebase user info
            firebase_uid = None
            firebase_email = None
            firebase_token = request.COOKIES.get('firebase_token')
            if firebase_token:
                decoded_token = firebase_service.verify_id_token(firebase_token)
                if decoded_token:
                    firebase_uid = decoded_token.get('uid')
                    firebase_email = decoded_token.get('email')
                    logger.info(f"👤 [PermissionMatrix] Saving as Firebase user: {firebase_email} ({firebase_uid})")
           
            # Use the serializer's create method which now handles module_name and lowercase conversion
            serializer.create(serializer.validated_data)
           
            # Update user role's updated_by fields
            for role_id in permission_data.keys():
                try:
                    user_role = UserRoles.objects.get(id=role_id)
                    if firebase_uid or firebase_email:
                        user_role.updated_by_uid = firebase_uid
                        user_role.updated_by_email = firebase_email
                        user_role.save()
                    logger.info(f"✅ [PermissionMatrix] Updated user info for {user_role.role_name}")
                except UserRoles.DoesNotExist:
                    logger.warning(f"⚠️ [PermissionMatrix] Role with ID {role_id} not found for user info update")
                    continue
           
            return Response(
                {'success': True, 'message': 'Module permissions updated successfully'},
                status=status.HTTP_200_OK
            )
           
        except Exception as e:
            logger.error(f"💥 [PermissionMatrix] Error saving permissions: {str(e)}", exc_info=True)
            return Response(
                {'error': f'Failed to save permissions: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
 
# NEW: View to populate module_name in existing ModulePermission records
class PopulateModuleNamesView(APIView):
    """
    One-time view to populate module_name in existing ModulePermission records
    """
    def get_permissions(self):
        return [IsAdminUser()]
   
    def post(self, request):
        """Populate module_name for all existing ModulePermission records"""
        try:
            from django.db import connection
           
            logger.info("🔄 [PopulateModuleNames] Starting module_name population...")
           
            # Count before
            total_count = ModulePermission.objects.count()
            null_count = ModulePermission.objects.filter(module_name__isnull=True).count()
            empty_count = ModulePermission.objects.filter(module_name='').count()
           
            logger.info(f"📊 [PopulateModuleNames] Before: {total_count} total, {null_count} null, {empty_count} empty module_names")
           
            # Use raw SQL for efficient bulk update with lowercase conversion
            with connection.cursor() as cursor:
                cursor.execute("""
                    UPDATE ModulePermissions
                    SET module_name = LOWER((
                        SELECT module_name
                        FROM Modules
                        WHERE Modules.module_id = ModulePermissions.module_id
                    ))
                    WHERE module_name IS NULL OR module_name = ''
                """)
                updated_count = cursor.rowcount
           
            # Count after
            remaining_null = ModulePermission.objects.filter(module_name__isnull=True).count()
            remaining_empty = ModulePermission.objects.filter(module_name='').count()
           
            logger.info(f"✅ [PopulateModuleNames] After: Updated {updated_count} records, {remaining_null} null remaining, {remaining_empty} empty remaining")
           
            return Response({
                'success': True,
                'message': f'Successfully populated module_name for {updated_count} records',
                'stats': {
                    'total_records': total_count,
                    'updated_records': updated_count,
                    'remaining_null': remaining_null,
                    'remaining_empty': remaining_empty
                }
            })
           
        except Exception as e:
            logger.error(f" [PopulateModuleNames] Error populating module names: {str(e)}", exc_info=True)
            return Response(
                {'error': f'Failed to populate module names: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
 