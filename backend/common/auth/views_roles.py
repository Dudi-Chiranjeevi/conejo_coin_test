from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from common.models import Role, Permission
from common.serializers import RoleSerializer, RoleCreateUpdateSerializer, PermissionUpdateSerializer
from common.services.firebase_service import firebase_service

class IsAdminUser:
    """
    Custom permission to only allow admin users
    """
    def has_permission(self, request, view):
        return getattr(request, 'firebase_role', None) in ['admin', 'super-admin']

class RoleListCreateView(APIView):
    """
    List all roles or create a new role
    """
    def get_permissions(self):
        return [IsAdminUser()]
    
    def get(self, request):
        """Get all roles"""
        roles = Role.objects.all()
        serializer = RoleSerializer(roles, many=True)
        return Response(serializer.data)
    
    def post(self, request):
        """Create a new role"""
        serializer = RoleCreateUpdateSerializer(data=request.data)
        if serializer.is_valid():
            # Create role
            role = serializer.save()
            
            # Create default permissions for all modules and actions
            modules = [choice[0] for choice in Permission.MODULE_CHOICES]
            actions = [choice[0] for choice in Permission.ACTION_CHOICES]
            
            for module in modules:
                for action in actions:
                    Permission.objects.create(
                        role=role,
                        module=module,
                        action=action,
                        granted=False
                    )
            
            # Return the created role with permissions
            role_serializer = RoleSerializer(role)
            return Response(role_serializer.data, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class RoleDetailView(APIView):
    """
    Retrieve, update or delete a role
    """
    def get_permissions(self):
        return [IsAdminUser()]
    
    def get_object(self, pk):
        try:
            return Role.objects.get(pk=pk)
        except Role.DoesNotExist:
            return None
    
    def get(self, request, pk):
        """Get a specific role"""
        role = self.get_object(pk)
        if not role:
            return Response({'error': 'Role not found'}, status=status.HTTP_404_NOT_FOUND)
        
        serializer = RoleSerializer(role)
        return Response(serializer.data)
    
    def put(self, request, pk):
        """Update a role"""
        role = self.get_object(pk)
        if not role:
            return Response({'error': 'Role not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Check if system role and user is not super admin
        if not role.is_custom and request.firebase_role != 'super-admin':
            return Response(
                {"error": "Cannot modify system roles"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = RoleCreateUpdateSerializer(role, data=request.data)
        if serializer.is_valid():
            serializer.save()
            # Return updated role with permissions
            role_serializer = RoleSerializer(role)
            return Response(role_serializer.data)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    def delete(self, request, pk):
        """Delete a role"""
        role = self.get_object(pk)
        if not role:
            return Response({'error': 'Role not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Prevent deletion of system roles
        if not role.is_custom:
            return Response(
                {"error": "Cannot delete system roles"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Check if users are assigned to this role
        user_count = 0
        try:
            if firebase_service.firestore_client:
                users_ref = firebase_service.firestore_client.collection("users")
                query = users_ref.where("role", "==", str(role.id))
                user_count = len(list(query.stream()))
        except Exception as e:
            print(f"Error checking users for role {role.id}: {e}")
        
        if user_count > 0:
            return Response(
                {"error": "Cannot delete role with assigned users"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Delete the role
        role.delete()
        return Response({"success": True}, status=status.HTTP_200_OK)

class RolePermissionsView(APIView):
    """
    Update permissions for a role
    """
    def get_permissions(self):
        return [IsAdminUser()]
    
    def get_object(self, pk):
        try:
            return Role.objects.get(pk=pk)
        except Role.DoesNotExist:
            return None
    
    def put(self, request, pk):
        """Update role permissions"""
        role = self.get_object(pk)
        if not role:
            return Response({'error': 'Role not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Check if system role and user is not super admin
        if not role.is_custom and request.firebase_role != 'super-admin':
            return Response(
                {"error": "Cannot modify system roles"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = PermissionUpdateSerializer(role, data=request.data)
        if serializer.is_valid():
            serializer.save()
            # Return updated role with permissions
            role_serializer = RoleSerializer(role)
            return Response(role_serializer.data)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class RoleUsersView(APIView):
    """
    Get users for a role
    """
    def get_permissions(self):
        return [IsAdminUser()]
    
    def get_object(self, pk):
        try:
            return Role.objects.get(pk=pk)
        except Role.DoesNotExist:
            return None
    
    def get(self, request, pk):
        """Get users for a role"""
        role = self.get_object(pk)
        if not role:
            return Response({'error': 'Role not found'}, status=status.HTTP_404_NOT_FOUND)
        
        user_count = 0
        try:
            # Query Firestore for users with this role
            if firebase_service.firestore_client:
                users_ref = firebase_service.firestore_client.collection("users")
                query = users_ref.where("role", "==", str(role.id))
                user_count = len(list(query.stream()))
        except Exception as e:
            print(f"Error counting users for role {role.id}: {e}")
        
        return Response({"success": True, "count": user_count})
