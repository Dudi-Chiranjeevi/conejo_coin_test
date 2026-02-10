from rest_framework import permissions

class FirebaseRolePermission(permissions.BasePermission):
    """
    Permission class that checks if the user has the required Firebase role.
    
    Usage:
        class MyView(APIView):
            permission_classes = [FirebaseRolePermission]
            required_role = 'admin'  # Only 'admin' or 'user' roles are supported
    """
    
    def has_permission(self, request, view):
        # Allow any authenticated request if no required_role is specified
        if not hasattr(view, 'required_role'):
            return True
            
        # Get the role from the request (set by FirebaseDRFAuthentication)
        user_role = getattr(request, 'firebase_role', None)
        if not user_role:
            return False
            
        required_role = view.required_role
        
        # Check if the user has the required role
        # Only 'admin' or 'user' roles are supported
        return user_role == required_role


class IsAdminRole(permissions.BasePermission):
    """
    Convenience permission class that requires admin role.
    """
    def has_permission(self, request, view):
        # Get the role from the request (set by FirebaseDRFAuthentication)
        user_role = getattr(request, 'firebase_role', None)
        return user_role == 'admin'
