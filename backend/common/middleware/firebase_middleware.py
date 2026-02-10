from django.contrib.auth import authenticate, login
from django.utils.deprecation import MiddlewareMixin
from common.services.firebase_service import firebase_service
import logging

logger = logging.getLogger(__name__)

class FirebaseAuthMiddleware(MiddlewareMixin):
    def process_request(self, request):
        # Skip for certain paths
        skip_paths = ['/admin/', '/api/v1/auth/login/', '/api/v1/auth/refresh/']
        if any(request.path.startswith(path) for path in skip_paths):
            return None
        
        # Check if user is already authenticated
        if request.user.is_authenticated:
            return None
        
        # Get Firebase token from cookie
        firebase_token = request.COOKIES.get('firebase_token')
        if not firebase_token:
            return None
        
        # Verify token and authenticate user
        try:
            user = authenticate(request, firebase_token=firebase_token)
            if user:
                login(request, user)
        except Exception as e:
            logger.error(f"Firebase auth middleware error: {str(e)}")
        
        return None