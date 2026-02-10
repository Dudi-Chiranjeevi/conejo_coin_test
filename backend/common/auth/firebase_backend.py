from django.contrib.auth.backends import BaseBackend
from django.contrib.auth.models import User
from django.contrib.auth import get_user_model
from common.services.firebase_service import firebase_service
import logging

logger = logging.getLogger(__name__)
User = get_user_model()

class FirebaseAuthenticationBackend(BaseBackend):
    def authenticate(self, request, firebase_token=None, **credentials):
        """
        Authenticate using Firebase ID token
        """
        if not firebase_token:
            return None
        
        firebase_user = firebase_service.verify_id_token(firebase_token)
        if not firebase_user:
            return None
        
        # Get or create Django user
        try:
            user = User.objects.get(username=firebase_user['email'])
        except User.DoesNotExist:
            # Create new user
            user = User.objects.create_user(
                username=firebase_user['email'],
                email=firebase_user['email'],
                first_name=firebase_user.get('name', '').split(' ')[0] if firebase_user.get('name') else '',
                is_active=firebase_user.get('email_verified', False)
            )
            logger.info(f"Created new user: {user.email}")

        # --- RBAC: Get role from Firebase ---
        uid = firebase_user.get('uid')
        role = firebase_service.get_user_role(uid) or "user"
        
        # Store role directly on the request in the view
        # This will be done in the authentication middleware
        
        # Debug log
        logger.debug(f"[DEBUG] Status: User={user.email}, Role={role}, UID={uid}")
        
        return user
    
    def get_user(self, user_id):
        try:
            return User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return None