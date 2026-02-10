# firebase_auth.py
from typing import Optional, Tuple
from django.contrib.auth import get_user_model
from rest_framework.authentication import BaseAuthentication
from rest_framework import exceptions
from common.services.firebase_service import firebase_service
from drf_spectacular.extensions import OpenApiAuthenticationExtension

User = get_user_model()

class FirebaseDRFAuthentication(BaseAuthentication):
    """
    Authenticate via:
      1) Authorization: Bearer <id_token>, or
      2) 'firebase_token' cookie (HTTP-only cookie set by your backend)
    Returns a Django user created/synced from Firebase claims.
    """

    def authenticate(self, request) -> Optional[Tuple[User, None]]:
        # 1) Try Bearer header
        id_token = None
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            id_token = auth_header.split(" ", 1)[1].strip()

        # 2) Fallback to cookie (common in browser apps)
        if not id_token:
            # Optional: respect logout sentinel
            if request.COOKIES.get("logout_sentinel") == "1":
                raise exceptions.AuthenticationFailed("Logged out")

            id_token = request.COOKIES.get("firebase_token")

        if not id_token:
            return None  # let other authenticators try

        claims = firebase_service.verify_id_token(id_token)
        if not claims:
            raise exceptions.AuthenticationFailed("Invalid or expired Firebase token")

        uid = claims.get("uid")
        if not uid:
            raise exceptions.AuthenticationFailed("Malformed Firebase token")

        email = claims.get("email") or f"{uid}@firebase.local"
        full_name = claims.get("name") or ""
        parts = full_name.split()
        first = parts[0] if parts else ""
        last = parts[-1] if len(parts) > 1 else ""

        # Use uid as canonical username
        user, created = User.objects.get_or_create(
            username=uid,
            defaults={"email": email, "first_name": first, "last_name": last, "is_active": True},
        )

        # Keep user fields in sync (optional)
        changed = False
        if user.email != email:
            user.email = email; changed = True
        if first and user.first_name != first:
            user.first_name = first; changed = True
        if last and user.last_name != last:
            user.last_name = last; changed = True
        if changed:
            user.save(update_fields=["email", "first_name", "last_name"])

        # --- RBAC: Get role from Firebase and attach directly to request ---
        role = firebase_service.get_user_role(uid) or "user"
        
        # Attach role and claims to request for use in permission classes
        request.firebase_claims = claims
        request.firebase_role = role
        
        # Debug log
        print(f"[DEBUG] Status: User={user.email}, Role={role}, UID={uid}")
        return (user, None)


class FirebaseAuthenticationScheme(OpenApiAuthenticationExtension):
    """OpenAPI extension for FirebaseDRFAuthentication"""
    
    target_class = 'common.auth.firebase_auth.FirebaseDRFAuthentication'
    name = 'FirebaseAuth'
    
    def get_security_definition(self, auto_schema):
        return {
            'type': 'http',
            'scheme': 'bearer',
            'bearerFormat': 'JWT',
            'description': 'Firebase ID token authentication. Provide a valid Firebase ID token as a Bearer token in the Authorization header or in the firebase_token cookie.'
        }
