from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, serializers
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate, logout as dj_logout
from django.conf import settings
from common.services.firebase_service import firebase_service
from drf_spectacular.utils import extend_schema, OpenApiResponse, OpenApiParameter
from rest_framework.authentication import SessionAuthentication
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
import logging
from inventory.serializers import ResendVerificationSerializer

logger = logging.getLogger(__name__)

# CSRF exempt session authentication for API views
class CsrfExemptSessionAuthentication(SessionAuthentication):
    def enforce_csrf(self, request):
        return  # Disable CSRF enforcement

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

def _get_cookie_token(request):
    # Support both plain and __Host- prefixed cookie names
    return (
        request.COOKIES.get("__Host-firebase_token")
        or request.COOKIES.get("firebase_token")
    )

def _get_cookie_refresh(request):
    return (
        request.COOKIES.get("__Host-firebase_refresh")
        or request.COOKIES.get("firebase_refresh")
    )

@method_decorator(csrf_exempt, name='dispatch')
class AuthStatusView(APIView):
    """
    View to check authentication status.
    Returns user information if authenticated, or an appropriate status message if not.
    """
    permission_classes = [AllowAny]  # Allow anyone to check auth status
    authentication_classes = [CsrfExemptSessionAuthentication]  # Disable CSRF for status check
    
    @extend_schema(
        responses={
            200: OpenApiResponse(description="Authentication status retrieved successfully"),
        },
    )
    def get(self, request):
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
        
        # Get COMPLETE user data from Firestore
        uid = user.get("uid")
        logger.info(f"[PROFILE_DEBUG] Fetching complete user data for UID: {uid}")
        user_data = firebase_service.get_user_data(uid) or {}
        
        # Extract user information directly from Firestore without fallbacks
        role = user_data.get("role", "user")
        first_name = user_data.get("firstname", "")
        last_name = user_data.get("lastname", "")
        phone_number=user_data.get("phone","")
        description=user_data.get("description","")
        
        logger.info(f"[PROFILE_DEBUG] User profile fields extracted - Role: '{role}', FirstName: '{first_name}', LastName: '{last_name}'")
        logger.info(f"[PROFILE_DEBUG] Available keys in user_data: {list(user_data.keys())}")
        
        # Create response data
        response_data = {
            "authenticated": True,
            "user": {
                "id": uid,
                "email": user.get("email"),
                "firstName": first_name,
                "lastName": last_name,
                "role": role,
                "phone":phone_number,
                "description":description
            }
        }
        
        logger.info(f"[PROFILE_DEBUG] Returning user data to frontend: {response_data['user']}")
        return Response(response_data)


@method_decorator(csrf_exempt, name='dispatch')
class LoginView(APIView):
    """
    View to handle user login with either email/password or Firebase ID token.
    Supports both traditional authentication and Firebase authentication.
    """
    permission_classes = [AllowAny]  # Allow anyone to attempt login
    authentication_classes = [CsrfExemptSessionAuthentication]  # Disable CSRF for login
    
    @extend_schema(
        request=None,  # We'll define a proper serializer later if needed
        responses={
            200: OpenApiResponse(description="Login successful"),
            400: OpenApiResponse(description="Validation error"),
            401: OpenApiResponse(description="Authentication failed"),
            403: OpenApiResponse(description="Email not verified"),
            500: OpenApiResponse(description="Internal server error"),
        },
    )
    def post(self, request):
        logger.info("[AUTH] Login request received")
        try:
            # Get data from request body
            data = request.data
            
            # Check if this is a Firebase token login or email/password login
            if 'idToken' in data:
                return self._handle_firebase_token_login(data)
            elif 'email' in data and 'password' in data:
                return self._handle_email_password_login(data)
            else:
                logger.warning("[AUTH] Login failed - invalid request format")
                return Response({
                    "success": False, 
                    "error": "Invalid request format. Provide either idToken or email/password."
                }, status=400)
                
        except Exception as e:
            logger.error(f"[AUTH] Login error: {str(e)}")
            return Response({"success": False, "error": str(e)}, status=500)
    
    def _handle_firebase_token_login(self, data):
        """Handle login with Firebase ID token"""
        id_token = data.get('idToken')
        
        # Verify the Firebase ID token
        logger.info("[AUTH] Verifying Firebase ID token")
        user = firebase_service.verify_id_token(id_token)
        if not user:
            logger.warning("[AUTH] Login failed - invalid token")
            return Response({"success": False, "error": "Invalid token"}, status=401)
        
        # Check email verification before proceeding
        logger.info(f"[AUTH] Checking email verification for user {user.get('email')}")
        verification_success, verification_data = firebase_service.check_email_verified(id_token)
           
        if not verification_success:
            logger.warning(f"[AUTH] Failed to check email verification: {verification_data.get('error')}")
            # Continue with login but log the warning
        elif not verification_data.get('email_verified', False):
            logger.warning(f"[AUTH] Login blocked - email not verified for user {user.get('email')}")
            return Response(
                {
                    "success": False,
                    "error": "Please verify your email before logging in. Check your inbox for the verification link."
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        
        # Get refresh token if provided
        refresh_token = data.get('refreshToken')
        expires_in = int(data.get('expiresIn', 3600))
        
        logger.info(f"[AUTH] Firebase login successful for {user.get('email')} (uid: {user.get('uid')})")
        
        # Get COMPLETE user data from Firestore
        uid = user.get("uid")
        logger.info(f"[PROFILE_DEBUG] Token login: Fetching complete user data for UID: {uid}")
        user_data = firebase_service.get_user_data(uid) or {}
        
        # Extract user information directly from Firestore without fallbacks
        role = user_data.get("role", "user")
        first_name = user_data.get("firstname", "")
        last_name = user_data.get("lastname", "")
        phone_number=user_data.get("phone","")
        description=user_data.get("description","")
        
        logger.info(f"[PROFILE_DEBUG] Token login: User data fields - firstname: '{first_name}', lastname: '{last_name}', role: '{role}', phone: ''{phone_number}")
        logger.info(f"[PROFILE_DEBUG] Token login: Available keys in user_data: {list(user_data.keys())}")
        logger.info(f"[PROFILE_DEBUG] Token login: User data retrieved - Role: {role}, Name: {first_name} {last_name}")
        
        # Create response with complete user data
        resp = Response({
            "success": True,
            "user": {
                "id": uid,
                "email": user.get("email"),
                "firstName": first_name,
                "lastName": last_name,
                "role": role,
                "phone":phone_number,
                "description":description,
                "twoFactorEnabled": user_data.get("two_factor_enabled", False),
                "lastLogin": user_data.get("last_login_formatted", "Never"),
            }
        })
        
        # Set cookies for session management
        logger.info("[AUTH] Setting firebase_token cookie")
        resp.set_cookie(
            "firebase_token", id_token, 
            max_age=expires_in,
            httponly=settings.SESSION_COOKIE_HTTPONLY, 
            secure=settings.SESSION_COOKIE_SECURE, 
            samesite=settings.SESSION_COOKIE_SAMESITE, 
            path="/"
        )
        
        if refresh_token:
            logger.info("[AUTH] Setting firebase_refresh cookie")
            resp.set_cookie(
                "firebase_refresh", refresh_token, 
                max_age=30*24*3600,  # 30 days
                httponly=settings.SESSION_COOKIE_HTTPONLY, 
                secure=settings.SESSION_COOKIE_SECURE, 
                samesite=settings.SESSION_COOKIE_SAMESITE, 
                path="/"
            )
        
        # Clear logout sentinel if it exists
        resp.delete_cookie("logout_sentinel", path="/", samesite=settings.SESSION_COOKIE_SAMESITE)
        
        return resp
    
    def _handle_email_password_login(self, data):
        """Handle login with email/password"""
        email = data.get('email')
        password = data.get('password')
        
        logger.info(f"[AUTH] Email/password login attempt for {email}")
        
        # Automatically detect and handle base64 encoded passwords
        if password and isinstance(password, str):
            try:
                # Check if the password looks like base64
                import base64
                import re
                
                # Base64 strings typically only contain these characters
                if re.match(r'^[A-Za-z0-9+/]+={0,2}$', password):
                    # Try to decode it
                    decoded = base64.b64decode(password).decode('utf-8')
                    # If we got here without exception, it was valid base64
                    password = decoded
                    logger.info(f"[AUTH] Automatically decoded base64 password")
            except Exception:
                # If decoding fails, just use the original password
                pass
        
        # Try to authenticate with Firebase
        try:
            # Use Firebase to sign in with email/password
            success, auth_result = firebase_service.authenticate_user(email, password)
            
            if not success or not auth_result or 'error' in auth_result:
                logger.warning(f"[AUTH] Email/password login failed for {email}")
                error_msg = auth_result.get('error', 'Invalid credentials') if auth_result else 'Authentication failed'
                return Response({"success": False, "error": error_msg}, status=401)
            
            # Extract token data
            id_token = auth_result.get('id_token')
            refresh_token = auth_result.get('refresh_token')
            expires_in = int(auth_result.get('expires_in', 3600))
            
            if not id_token:
                logger.error("[AUTH] Firebase authentication succeeded but no id_token returned")
                return Response(
                    {"success": False, "error": "Missing id_token"},
                    status=status.HTTP_401_UNAUTHORIZED,
                )
            
            # Check email verification before proceeding
            logger.info(f"[AUTH] Checking email verification for user {email}")
            verification_success, verification_data = firebase_service.check_email_verified(id_token)
           
            if not verification_success:
                logger.warning(f"[AUTH] Failed to check email verification: {verification_data.get('error')}")
                # Continue with login but log the warning
            elif not verification_data.get('email_verified', False):
                logger.warning(f"[AUTH] Login blocked - email not verified for user {email}")
                return Response(
                    {
                        "success": False,
                        "error": "Please verify your email before logging in. Check your inbox for the verification link."
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )
            
            # Get user info from token
            user = firebase_service.verify_id_token(id_token)
            if not user:
                logger.warning(f"[AUTH] Token verification failed after email/password login for {email}")
                return Response({"success": False, "error": "Authentication error"}, status=401)
            
            logger.info(f"[AUTH] Email/password login successful for {email}")
            
            # Get COMPLETE user data from Firestore (including firstname, lastname, role)
            uid = user.get("uid")
            logger.info(f"[PROFILE_DEBUG] Login: Fetching complete user data for UID: {uid}")
            user_data = firebase_service.get_user_data(uid) or {}
            
            # Extract user information directly from Firestore without fallbacks
            role = user_data.get("role", "user")
            first_name = user_data.get("firstname", "")
            last_name = user_data.get("lastname", "")
            
            # Log the retrieved data for debugging
            logger.info(f"[PROFILE_DEBUG] Login: User data fields - firstname: '{first_name}', lastname: '{last_name}', role: '{role}'")
            logger.info(f"[PROFILE_DEBUG] Login: Available keys in user_data: {list(user_data.keys())}")
            
            logger.info(f"[PROFILE_DEBUG] Login: User data retrieved - Role: {role}, Name: {first_name} {last_name}")
            
            # Create response with complete user data
            resp = Response({
                "success": True,
                "user": {
                    "id": uid,
                    "email": user.get("email"),
                    "firstName": first_name,
                    "lastName": last_name,
                    "role": role,
                    "twoFactorEnabled": user_data.get("two_factor_enabled", False),
                    "lastLogin": user_data.get("last_login_formatted", "Never"),
                }
            })
            
            # Set cookies for session management
            logger.info("[AUTH] Setting firebase_token cookie")
            resp.set_cookie(
                "firebase_token", id_token, 
                max_age=expires_in,
                httponly=settings.SESSION_COOKIE_HTTPONLY, 
                secure=settings.SESSION_COOKIE_SECURE, 
                samesite=settings.SESSION_COOKIE_SAMESITE, 
                path="/"
            )
            
            if refresh_token:
                logger.info("[AUTH] Setting firebase_refresh cookie")
                resp.set_cookie(
                    "firebase_refresh", refresh_token, 
                    max_age=30*24*3600,  # 30 days
                    httponly=settings.SESSION_COOKIE_HTTPONLY, 
                    secure=settings.SESSION_COOKIE_SECURE, 
                    samesite=settings.SESSION_COOKIE_SAMESITE, 
                    path="/"
                )
            
            # Clear logout sentinel if it exists
            resp.delete_cookie("logout_sentinel", path="/", samesite=settings.SESSION_COOKIE_SAMESITE)
            
            return resp
            
        except Exception as e:
            logger.error(f"[AUTH] Email/password login error: {str(e)}")
            return Response({"success": False, "error": "Authentication failed"}, status=401)



@method_decorator(csrf_exempt, name='dispatch')
class LogoutView(APIView):
    """
    View to handle user logout.
    Clears authentication cookies and sets a logout sentinel.
    """
    permission_classes = [AllowAny]  # Allow anyone to logout
    authentication_classes = [CsrfExemptSessionAuthentication]  # Disable CSRF for logout
    
    def post(self, request):
        logger.info("[AUTH] Logout request received")
        
        # Create response
        resp = Response({"success": True})
        
        # Clear all auth cookies
        logger.info("[AUTH] Clearing authentication cookies")
        _delete_cookie_all(resp, "firebase_token")
        _delete_cookie_all(resp, "firebase_refresh")
        
        # Set logout sentinel to prevent auto-login attempts
        logger.info("[AUTH] Setting logout sentinel cookie")
        resp.set_cookie(
            "logout_sentinel", "1",
            max_age=3600,  # 1 hour
            httponly=settings.SESSION_COOKIE_HTTPONLY,
            secure=settings.SESSION_COOKIE_SECURE,
            samesite=settings.SESSION_COOKIE_SAMESITE,
            path="/"
        )
        
        # Also clear Django session if it exists
        if hasattr(request, 'session'):
            logger.info("[AUTH] Clearing Django session")
            dj_logout(request)
        
        return resp


@method_decorator(csrf_exempt, name='dispatch')
class TokenRefreshView(APIView):
    """
    View to refresh Firebase tokens.
    Uses the refresh token to get a new ID token.
    """
    permission_classes = [AllowAny]  # Allow anyone to refresh tokens
    authentication_classes = [CsrfExemptSessionAuthentication]  # Disable CSRF for token refresh
    
    def post(self, request):
        logger.info("[AUTH] Token refresh request received")
        
        # Check for logout sentinel
        if request.COOKIES.get("logout_sentinel") == "1":
            logger.warning("[AUTH] Token refresh failed - logout sentinel found")
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
        if not id_token:
            logger.error("[AUTH] Firebase token refresh returned no id_token")
            return Response({"success": False, "error": "Token refresh failed"}, status=401)

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


@method_decorator(csrf_exempt, name='dispatch')
class ForgotPasswordView(APIView):
    """
    View to handle password reset requests.
    Uses Firebase to send password reset emails.
    """
    permission_classes = [AllowAny]  # Allow anyone to request password reset
    authentication_classes = [CsrfExemptSessionAuthentication]  # Disable CSRF for password reset
    
    def post(self, request):
        logger.info("[AUTH] Password reset request received")
        
        email = request.data.get('email')
        if not email:
            logger.warning("[AUTH] Password reset failed - no email provided")
            return Response({"success": False, "error": "Email is required"}, status=400)
        
        try:
            # Use Firebase to send password reset email
            success = firebase_service.send_password_reset_email(email)
            
            if success:
                logger.info(f"[AUTH] Password reset email sent to {email}")
                return Response({"success": True, "message": "Password reset email sent"})
            else:
                logger.warning(f"[AUTH] Password reset failed for {email}")
                return Response({"success": False, "error": "Failed to send password reset email"}, status=400)
                
        except Exception as e:
            logger.error(f"[AUTH] Password reset error: {str(e)}")
            return Response({"success": False, "error": "Failed to process password reset request"}, status=500)

# ... keep your existing imports, but remove this one:
# from rest_framework.decorators import action

# --- keep everything above as-is ---

class SignupSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()
    firstName = serializers.CharField()
    lastName = serializers.CharField()

@method_decorator(csrf_exempt, name='dispatch')
class SignUpView(APIView):
    authentication_classes = [CsrfExemptSessionAuthentication]  # Disable CSRF for signup

    @extend_schema(
        request=SignupSerializer,
        responses={
            200: OpenApiResponse(description="Signup successful"),
            400: OpenApiResponse(description="Validation error"),
            409: OpenApiResponse(description="User already exists"),
            500: OpenApiResponse(description="Internal server error"),
        },
    )
    def post(self, request):
        try:
            logger.info("[AUTH] Signup attempt")
            serializer = SignupSerializer(data=request.data)
            if not serializer.is_valid():
                logger.warning(f"[AUTH] Signup validation failed: {serializer.errors}")
                return Response(
                    {"success": False, "errors": serializer.errors},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            email = serializer.validated_data.get("email")
            password = serializer.validated_data.get("password")
            first_name = serializer.validated_data.get("firstName")
            last_name = serializer.validated_data.get("lastName")

            if not email or not password:
                logger.warning("[AUTH] Signup attempt with missing email or password")
                return Response(
                    {"success": False, "error": "Email and password required"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Create user in Firebase
            logger.info(f"[AUTH] Creating user {email} in Firebase")
            success, auth_data = firebase_service.create_user_with_email_and_password(
                email, password, f"{first_name} {last_name}"
            )

            if not success:
                error_msg = (auth_data or {}).get("error", "Signup failed")
                logger.warning(f"[AUTH] Firebase signup failed: {error_msg}")
                if "EMAIL_EXISTS" in error_msg:
                    return Response(
                        {
                            "success": False,
                            "error": "This email is already registered. Please use a different email or try logging in."
                        },
                        status=status.HTTP_409_CONFLICT,
                    )
                return Response({"success": False, "error": error_msg},
                                status=status.HTTP_400_BAD_REQUEST)

            # Send verification email
            id_token = auth_data.get("id_token")
            if not id_token:
                logger.error("[AUTH] Firebase signup succeeded but no id_token returned")
                return Response(
                    {"success": False, "error": "Missing id_token"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

            logger.info("[AUTH] Verifying Firebase ID token after signup")
            firebase_user = firebase_service.verify_id_token(id_token)
            if not firebase_user:
                logger.error("[AUTH] Firebase token verification failed after signup")
                return Response(
                    {"success": False, "error": "Invalid Firebase token"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

            logger.info(f"[AUTH] Sending verification email to {email}")
            verification_success, verification_data = firebase_service.send_email_verification(id_token)
            if not verification_success:
                logger.warning(f"[AUTH] Failed to send verification email: {verification_data.get('error')}")

            logger.info(f"[AUTH] Signup successful for user {email} - verification email sent")
            return Response(
                {
                    "success": True,
                    "message": "Account created successfully. Please check your email for verification before logging in."
                },
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            logger.exception(f"[AUTH] Signup error: {str(e)}")
            return Response(
                {"success": False, "error": "Internal server error"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

@method_decorator(csrf_exempt, name='dispatch')
class CheckVerificationView(APIView):
    """GET /auth/check-verification/ -> { verified: bool, email?: str }"""
    permission_classes = [AllowAny]
    authentication_classes = [CsrfExemptSessionAuthentication]

    def get(self, request):
        token = request.COOKIES.get("firebase_token")
        if not token:
            return Response({"verified": False}, status=200)
        firebase_user = firebase_service.verify_id_token(token)
        if not firebase_user:
            return Response({"verified": False}, status=200)
        return Response({
            "verified": firebase_user.get("email_verified", False),
            "email": firebase_user.get("email")
        }, status=200)

@method_decorator(csrf_exempt, name='dispatch')
class ResendVerificationView(APIView):
    """
    POST /auth/resend-verification/
    Body: { email: str, password?: str } (password optional if valid session cookie exists)
    """
    permission_classes = [AllowAny]
    authentication_classes = [CsrfExemptSessionAuthentication]

    @extend_schema(
        request=ResendVerificationSerializer,
        responses={
            200: OpenApiResponse(description="Verification email sent"),
            400: OpenApiResponse(description="Validation error"),
            401: OpenApiResponse(description="Authentication required/failed"),
            500: OpenApiResponse(description="Internal server error"),
        },
    )
    def post(self, request):
        try:
            logger.info("[AUTH] Resend verification attempt")
            serializer = ResendVerificationSerializer(data=request.data)
            if not serializer.is_valid():
                logger.warning(f"[AUTH] Resend verification validation failed: {serializer.errors}")
                return Response(
                    {"success": False, "errors": serializer.errors},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            email = serializer.validated_data.get("email")
            password = serializer.validated_data.get("password")

            if not email:
                logger.warning("[AUTH] Resend verification attempt with missing email")
                return Response(
                    {"success": False, "error": "Email is required"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Acquire an id_token via password OR existing cookie
            id_token = None
            if password:
                logger.info(f"[AUTH] Authenticating user {email} for verification resend")
                success, auth_data = firebase_service.authenticate_user(email, password)
                if not success:
                    error_msg = (auth_data or {}).get("error", "Authentication failed")
                    logger.warning(f"[AUTH] Authentication failed for verification resend: {error_msg}")
                    return Response(
                        {
                            "success": False,
                            "error": "Invalid credentials. Please provide correct password.",
                        },
                        status=status.HTTP_401_UNAUTHORIZED,
                    )
                id_token = auth_data.get("id_token")
            else:
                id_token = request.COOKIES.get("firebase_token")

            if not id_token:
                logger.error("[AUTH] Firebase token refresh returned no id_token")
                return Response(
                    {"success": False, "error": "Password required or valid session needed"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            logger.info(f"[AUTH] Sending verification email to {email}")
            verification_success, verification_data = firebase_service.send_email_verification(id_token)
            if verification_success:
                logger.info(f"[AUTH] Verification email sent successfully to {email}")
                return Response(
                    {"success": True, "message": "Verification email sent successfully. Please check your inbox."},
                    status=status.HTTP_200_OK,
                )

            error_msg = (verification_data or {}).get('error', 'Failed to send verification email')
            logger.warning(f"[AUTH] Failed to send verification email: {error_msg}")
            return Response({"success": False, "error": error_msg},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        except Exception as e:
            logger.exception(f"[AUTH] Resend verification error: {str(e)}")
            return Response(
                {"success": False, "error": "Internal server error"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

@method_decorator(csrf_exempt, name="dispatch")
class AllUsersView(APIView):
    """
    GET /auth/all-users/?q=<search>&page=1&page_size=25
    Returns users from Firestore/Firebase; admin-only.
    """
    permission_classes = [AllowAny]
    authentication_classes = [CsrfExemptSessionAuthentication]

    @extend_schema(
        parameters=[
            OpenApiParameter(name="q", description="Search by name/email (contains, case-insensitive)", required=False, type=str),
            OpenApiParameter(name="page", description="Page number (1-based)", required=False, type=int),
            OpenApiParameter(name="page_size", description="Items per page (max 100)", required=False, type=int),
        ],
        responses={
            200: OpenApiResponse(description="Users list retrieved successfully"),
            401: OpenApiResponse(description="Unauthorized"),
            403: OpenApiResponse(description="Forbidden"),
            500: OpenApiResponse(description="Internal server error"),
        },
    )
    def get(self, request):
        logger.info("[AUTH] get_all_users called")

        # --- Auth: must have a valid Firebase ID token cookie ---
        id_token = _get_cookie_token(request)
        if not id_token:
            return Response({"success": False, "error": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)

        me = firebase_service.verify_id_token(id_token)
        if not me:
            return Response({"success": False, "error": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)

        # --- Role check (admin/superadmin/owner only) ---
        uid = me.get("uid")
        # Prefer Firestore profile if you keep role there
        profile = {}
        try:
            profile = firebase_service.get_user_data(uid) or {}
        except Exception as e:
            logger.warning(f"[AUTH] get_user_data failed for {uid}: {e}")

        role = (profile.get("role") or me.get("role") or "").lower()
        if role not in {"admin", "superadmin", "owner"}:
            return Response({"success": False, "error": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        # --- Fetch users from Firebase/Firestore ---
        try:
            users = firebase_service.get_all_users() or []
        except Exception as e:
            logger.exception(f"[AUTH] get_all_users: firebase_service.get_all_users() failed: {e}")
            return Response({"success": False, "error": "Internal server error"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # --- Optional search filter ---
        q = (request.query_params.get("q") or "").strip().lower()
        if q:
            def _match(u: dict) -> bool:
                # Try common keys safely
                fields = [
                    str(u.get("email", "")),
                    str(u.get("firstname", "")),
                    str(u.get("lastname", "")),
                    str(u.get("displayName", "")),
                    str(u.get("name", "")),
                ]
                return any(q in s.lower() for s in fields if s)
            users = [u for u in users if _match(u)]

        # --- Pagination ---
        try:
            page = max(1, int(request.query_params.get("page", 1)))
        except ValueError:
            page = 1
        try:
            page_size = int(request.query_params.get("page_size", 25))
        except ValueError:
            page_size = 25
        page_size = max(1, min(page_size, 100))

        total = len(users)
        start = (page - 1) * page_size
        end = start + page_size
        page_items = users[start:end]

        logger.info(f"[AUTH] get_all_users success: total={total} page={page} page_size={page_size} returned={len(page_items)}")
        # Avoid caching user lists
        resp = Response(
            {
                "success": True,
                "users": page_items,
                "count": len(page_items),
                "total": total,
                "page": page,
                "pageSize": page_size,
            },
            status=status.HTTP_200_OK,
        )
        resp["Cache-Control"] = "no-store"
        return resp

# delete user 
@method_decorator(csrf_exempt, name="dispatch")
class DeleteUserView(APIView):
    """
    DELETE /auth/users/<uid>/
    Admin-only: deletes a Firebase user (and, if your service does it, their Firestore doc).
    """
    permission_classes = [AllowAny]
    authentication_classes = [CsrfExemptSessionAuthentication]

    @extend_schema(
        parameters=[
            OpenApiParameter(
                name="uid",
                description="Target Firebase UID to delete",
                required=True,
                type=str,
                location=OpenApiParameter.PATH,
            ),
        ],
        responses={
            200: OpenApiResponse(description="User deleted successfully"),
            400: OpenApiResponse(description="Bad request"),
            401: OpenApiResponse(description="Unauthorized"),
            403: OpenApiResponse(description="Forbidden"),
            404: OpenApiResponse(description="User not found"),
            500: OpenApiResponse(description="Internal server error"),
        },
    )
    def delete(self, request, uid: str):
        logger.info(f"[AUTH] delete_user called for uid={uid}")

        # --- Auth via Firebase ID token cookie ---
        id_token = _get_cookie_token(request)
        if not id_token:
            return Response({"success": False, "error": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)

        me = firebase_service.verify_id_token(id_token)
        if not me:
            return Response({"success": False, "error": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)

        me_uid = me.get("uid")

        # --- Role check (admin/superadmin/owner only) ---
        try:
            profile = firebase_service.get_user_data(me_uid) or {}
        except Exception as e:
            logger.warning(f"[AUTH] get_user_data failed for {me_uid}: {e}")
            profile = {}

        role = (profile.get("role") or me.get("role") or "").lower()
        if role not in {"admin", "superadmin", "owner"}:
            return Response({"success": False, "error": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        # --- Prevent self-delete ---
        if uid == me_uid:
            return Response({"success": False, "error": "You cannot delete your own account."},
                            status=status.HTTP_400_BAD_REQUEST)

        # --- (Optional) confirm the target exists, for better 404s ---
        try:
            target = firebase_service.get_user_data(uid)
        except Exception:
            target = None

        if not target:
            # If your firebase_service.delete_user returns False on not found,
            # you can skip this pre-check. Keeping it for clearer 404s.
            return Response({"success": False, "error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        # --- Delete via service ---
        try:
            ok = firebase_service.delete_user(uid)
        except Exception as e:
            logger.exception(f"[AUTH] delete_user failed for {uid}: {e}")
            return Response({"success": False, "error": "Internal server error"},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        if not ok:
            return Response({"success": False, "error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        resp = Response({"success": True, "message": "User deleted successfully"}, status=status.HTTP_200_OK)
        resp["Cache-Control"] = "no-store"
        return resp

# update user status
class UpdateUserStatusSerializer(serializers.Serializer):
    disabled = serializers.BooleanField(required=True)

@method_decorator(csrf_exempt, name="dispatch")
class UpdateUserStatusView(APIView):
    """
    PATCH /auth/users/<uid>/status/
    Body: { "disabled": true|false }
    Admin-only. Prevents self-disable to avoid accidental lockout.
    """
    permission_classes = [AllowAny]
    authentication_classes = [CsrfExemptSessionAuthentication]

    @extend_schema(
        request=UpdateUserStatusSerializer,
        responses={
            200: OpenApiResponse(description="User status updated successfully"),
            400: OpenApiResponse(description="Invalid request"),
            401: OpenApiResponse(description="Unauthorized"),
            403: OpenApiResponse(description="Forbidden"),
            404: OpenApiResponse(description="User not found"),
            500: OpenApiResponse(description="Internal server error"),
        },
    )
    def patch(self, request, uid: str):
        logger.info(f"[AUTH] update_user_status called for uid={uid}")

        # --- Auth via Firebase ID token cookie ---
        id_token = _get_cookie_token(request)
        if not id_token:
            return Response({"success": False, "error": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)

        me = firebase_service.verify_id_token(id_token)
        if not me:
            return Response({"success": False, "error": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)

        me_uid = me.get("uid")

        # --- Role check (admin/superadmin/owner only) ---
        try:
            profile = firebase_service.get_user_data(me_uid) or {}
        except Exception as e:
            logger.warning(f"[AUTH] get_user_data failed for {me_uid}: {e}")
            profile = {}

        role = (profile.get("role") or me.get("role") or "").lower()
        if role not in {"admin", "superadmin", "owner"}:
            return Response({"success": False, "error": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        # --- Validate payload ---
        serializer = UpdateUserStatusSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
        disabled = serializer.validated_data["disabled"]

        # --- Prevent self-disable to avoid lockout ---
        if uid == me_uid and disabled:
            return Response(
                {"success": False, "error": "You cannot disable your own account."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # --- Update via service ---
        try:
            ok = firebase_service.update_user_status(uid, disabled)  # returns bool
        except Exception as e:
            logger.exception(f"[AUTH] update_user_status failed for {uid}: {e}")
            return Response({"success": False, "error": "Internal server error"},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        if not ok:
            return Response({"success": False, "error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        status_text = "inactive" if disabled else "active"
        resp = Response(
            {"success": True, "message": f"User status updated to {status_text}", "disabled": disabled},
            status=status.HTTP_200_OK,
        )
        resp["Cache-Control"] = "no-store"
        return resp

ALLOWED_ROLES = {"user", "admin", "superadmin", "owner"}

class CreateUserSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    password = serializers.CharField(required=False, allow_blank=True)
    firstname = serializers.CharField(required=True)
    lastname = serializers.CharField(required=True)
    role = serializers.CharField(required=False, default="user")
    phone = serializers.CharField(required=False, allow_blank=True)
    description = serializers.CharField(required=False, max_length=500, allow_blank=True)
    disabled = serializers.BooleanField(required=False)
    client_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    def validate_email(self, v: str) -> str:
        return v.strip().lower()

    def validate_role(self, v: str) -> str:
        # ✅ REMOVE the restriction - allow any role
        return (v or "user").strip().lower()

    def validate_client_id(self, v: str) -> str:
        # Allow empty string or null for no client association
        if v == "" or v is None:
            return ""
        return v.strip()

@method_decorator(csrf_exempt, name="dispatch")
class CreateUserView(APIView):
    """
    POST /auth/users/
    Body: { email, password?, firstname, lastname, role?='user', client_id? }
    Admin-only endpoint to create a Firebase Auth user and Firestore profile.
    """
    permission_classes = [AllowAny]
    authentication_classes = [CsrfExemptSessionAuthentication]

    @extend_schema(
        request=CreateUserSerializer,
        responses={
            201: OpenApiResponse(description="User created successfully"),
            400: OpenApiResponse(description="Invalid request data"),
            401: OpenApiResponse(description="Unauthorized"),
            403: OpenApiResponse(description="Forbidden"),
            409: OpenApiResponse(description="Email already exists"),
            500: OpenApiResponse(description="Internal server error"),
        },
    )
    def post(self, request):
        logger.info("[AUTH] create_user called")

        # --- Auth via Firebase ID token cookie ---
        id_token = _get_cookie_token(request)
        if not id_token:
            return Response({"success": False, "error": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)

        me = firebase_service.verify_id_token(id_token)
        if not me:
            return Response({"success": False, "error": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)

        me_uid = me.get("uid")
        # --- Role check (admin/superadmin/owner only) ---
        try:
            profile = firebase_service.get_user_data(me_uid) or {}
        except Exception as e:
            logger.warning(f"[AUTH] get_user_data failed for {me_uid}: {e}")
            profile = {}

        role = (profile.get("role") or me.get("role") or "").lower()
        if role not in {"admin", "superadmin", "owner"}:
            return Response({"success": False, "error": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        # --- Validate payload ---
        ser = CreateUserSerializer(data=request.data)
        if not ser.is_valid():
            return Response({"success": False, "errors": ser.errors}, status=status.HTTP_400_BAD_REQUEST)

        payload = ser.validated_data  # {email, password?, firstname, lastname, role, client_id?}

        # Log the client_id for debugging
        client_id = payload.get('client_id')
        logger.info(f"[AUTH] Creating user with client_id: {client_id}")

        # --- Create via service ---
        try:
            result = firebase_service.create_user(payload)  # expected -> {"success": bool, "user": {...}} or {"error": "..."}
        except Exception as e:
            logger.exception(f"[AUTH] create_user service error: {e}")
            return Response({"success": False, "error": "Internal server error"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        if result and result.get("success"):
            user_obj = result.get("user", {})
            logger.info(f"[AUTH] user created uid={user_obj.get('id')} with client_id={client_id}")
            resp = Response(
                {"success": True, "message": "User created successfully", "user": user_obj},
                status=status.HTTP_201_CREATED,
            )
            resp["Cache-Control"] = "no-store"
            return resp

        # Normalize conflict detection
        err = (result or {}).get("error", "Failed to create user")
        if "already exists" in err.lower() or "email_exists" in err.lower() or "email exists" in err.lower():
            return Response({"success": False, "error": err}, status=status.HTTP_409_CONFLICT)

        return Response({"success": False, "error": err}, status=status.HTTP_400_BAD_REQUEST)

class UpdateUserSerializer(serializers.Serializer):
    email = serializers.EmailField(required=False)
    firstname = serializers.CharField(required=False)
    lastname = serializers.CharField(required=False)
    role = serializers.CharField(required=False)
    department = serializers.CharField(required=False, allow_blank=True)
    phone = serializers.CharField(required=False, allow_blank=True)
    description = serializers.CharField(required=False, max_length=500, allow_blank=True)
    disabled = serializers.BooleanField(required=False)
    client_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    def validate(self, data):
        if not data:
            raise serializers.ValidationError("At least one field is required.")
        return data

    def validate_email(self, v: str) -> str:
        return v.strip().lower()

    def validate_role(self, v: str) -> str:
        # ✅ REMOVE the restriction - allow any role
        return v.strip().lower() if v else v

    def validate_client_id(self, v: str) -> str:
        # Allow empty string or null for no client association
        if v == "" or v is None:
            return ""
        return v.strip()

@method_decorator(csrf_exempt, name="dispatch")
class UpdateUserView(APIView):
    """
    PATCH /auth/users/<uid>/
    Body: any subset of { email, firstname, lastname, role, department, phone, disabled, client_id }
    Admin-only (admin/superadmin/owner). Prevents self-disable to avoid lockout.
    """
    permission_classes = [AllowAny]
    authentication_classes = [CsrfExemptSessionAuthentication]

    @extend_schema(
        request=UpdateUserSerializer,
        responses={
            200: OpenApiResponse(description="User updated successfully"),
            400: OpenApiResponse(description="Invalid request data"),
            401: OpenApiResponse(description="Unauthorized"),
            403: OpenApiResponse(description="Forbidden"),
            404: OpenApiResponse(description="User not found"),
            409: OpenApiResponse(description="Email already exists"),
            500: OpenApiResponse(description="Internal server error"),
        },
    )
    def patch(self, request, uid: str):
        logger.info(f"[AUTH] update_user called for uid={uid}")

        # --- Auth via Firebase cookie ---
        id_token = _get_cookie_token(request)
        if not id_token:
            return Response({"success": False, "error": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)

        me = firebase_service.verify_id_token(id_token)
        if not me:
            return Response({"success": False, "error": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)
        me_uid = me.get("uid")

        # --- Role check (admin/superadmin/owner only) ---
        try:
            me_profile = firebase_service.get_user_data(me_uid) or {}
        except Exception as e:
            logger.warning(f"[AUTH] get_user_data failed for {me_uid}: {e}")
            me_profile = {}
        me_role = (me_profile.get("role") or me.get("role") or "user").lower()
        if me_role not in {"admin", "superadmin", "owner"}:
            return Response({"success": False, "error": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        # --- Validate payload ---
        ser = UpdateUserSerializer(data=request.data)
        if not ser.is_valid():
            return Response({"success": False, "errors": ser.errors}, status=status.HTTP_400_BAD_REQUEST)
        payload = ser.validated_data

        # Log the client_id for debugging
        client_id = payload.get('client_id')
        logger.info(f"[AUTH] Updating user {uid} with client_id: {client_id}")

        # --- Prevent self-disable (optional safety) ---
        if uid == me_uid and payload.get("disabled") is True:
            return Response(
                {"success": False, "error": "You cannot disable your own account."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # --- Update via service ---
        try:
            result = firebase_service.update_user(uid, payload)
        except Exception as e:
            logger.exception(f"[AUTH] update_user service error for {uid}: {e}")
            return Response({"success": False, "error": "Internal server error"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        if not result or not result.get("success"):
            err = (result or {}).get("error", "Failed to update user")
            low = err.lower()
            if "not found" in low:
                return Response({"success": False, "error": "User not found"}, status=status.HTTP_404_NOT_FOUND)
            if "already exists" in low or "email exists" in low:
                return Response({"success": False, "error": err}, status=status.HTTP_409_CONFLICT)
            return Response({"success": False, "error": err}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {"success": True, "message": "User updated successfully", "user": result.get("user", {})},
            status=status.HTTP_200_OK,
        )

#added by uday to edit user details in myprofile tab
@method_decorator(csrf_exempt, name="dispatch")
class EditUserProfileView(APIView):
    """
    PATCH /auth/users/<uid>/
    Body: any subset of { email, firstname, lastname, role, department, phone, disabled }
    Any authenticated user (via Firebase) can update a user's profile.
    """

    permission_classes = [AllowAny]
    authentication_classes = [CsrfExemptSessionAuthentication]

    @extend_schema(
        request=UpdateUserSerializer,
        responses={
            200: OpenApiResponse(description="User updated successfully"),
            400: OpenApiResponse(description="Invalid request data"),
            401: OpenApiResponse(description="Unauthorized"),
            404: OpenApiResponse(description="User not found"),
            409: OpenApiResponse(description="Email already exists"),
            500: OpenApiResponse(description="Internal server error"),
        },
    )
    def patch(self, request, uid: str):
        logger.info(f"[AUTH] edit_user_profile called for uid={uid}")

        # --- Auth via Firebase token in cookie ---
        id_token = _get_cookie_token(request)
        if not id_token:
            return Response({"success": False, "error": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)

        me = firebase_service.verify_id_token(id_token)
        if not me:
            return Response({"success": False, "error": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)

        me_uid = me.get("uid")

        # --- Validate payload ---
        ser = UpdateUserSerializer(data=request.data)
        if not ser.is_valid():
            return Response({"success": False, "errors": ser.errors}, status=status.HTTP_400_BAD_REQUEST)

        payload = ser.validated_data

        # --- Prevent self-disable (optional safety) ---
        if uid == me_uid and payload.get("disabled") is True:
            return Response(
                {"success": False, "error": "You cannot disable your own account."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # --- Update via service ---
        try:
            result = firebase_service.update_user(uid, payload)
        except Exception as e:
            logger.exception(f"[AUTH] update_user service error for {uid}: {e}")
            return Response({"success": False, "error": "Internal server error"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        if not result or not result.get("success"):
            err = (result or {}).get("error", "Failed to update user")
            low = err.lower()
            if "not found" in low:
                return Response({"success": False, "error": "User not found"}, status=status.HTTP_404_NOT_FOUND)
            if "already exists" in low or "email exists" in low:
                return Response({"success": False, "error": err}, status=status.HTTP_409_CONFLICT)
            return Response({"success": False, "error": err}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {"success": True, "message": "User updated successfully", "user": result.get("user", {})},
            status=status.HTTP_200_OK,
        )