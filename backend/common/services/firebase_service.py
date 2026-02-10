import json
import requests
import os
from django.conf import settings
from django.core.cache import cache
from typing import Dict, Optional, Tuple, List, Union
import logging
import jwt
import time
from cryptography.x509 import load_pem_x509_certificate
from cryptography.hazmat.backends import default_backend

# role
from firebase_admin import auth
from datetime import datetime
import firebase_admin
from firebase_admin import credentials, firestore

logger = logging.getLogger(__name__)

class FirebaseAuthService:
    def _ensure_firebase_app(self, project_id: str, cred_source: Union[Dict, str, None]):
        """Ensures Firebase app is initialized with the correct project ID.
        
        Args:
            project_id: The Firebase project ID to use
            cred_source: Either a dict with service account info, a path to a JSON file, or None for ApplicationDefault
            
        Returns:
            The Firebase app instance
            
        Raises:
            RuntimeError: If Firebase is already initialized with a different project ID
        """
        if firebase_admin._apps:
            app = firebase_admin.get_app()
            current = app._options.get("projectId")
            if current != project_id:
                raise RuntimeError(
                    f"Admin SDK already initialized for '{current}', "
                    f"but settings specify '{project_id}'. Align your config."
                )
            return app

        if isinstance(cred_source, dict):
            cred = credentials.Certificate(cred_source)
        elif isinstance(cred_source, str):
            cred = credentials.Certificate(cred_source)  # path to JSON
        else:
            # On Cloud Run prefer keyless ADC:
            cred = credentials.ApplicationDefault()

        return firebase_admin.initialize_app(cred, {"projectId": project_id})
        
    def __init__(self):
        self.api_key = settings.FIREBASE_API_KEY
        self.project_id = settings.FIREBASE_PROJECT_ID
        self._public_keys = None
        self._keys_last_fetched = 0

        # Use environment variables for Firebase API endpoints
        self.auth_endpoint = settings.FIREBASE_AUTH_ENDPOINT
        self.token_endpoint = settings.FIREBASE_TOKEN_ENDPOINT
        self.public_keys_endpoint = settings.FIREBASE_PUBLIC_KEYS_ENDPOINT
        self.token_issuer = settings.FIREBASE_TOKEN_ISSUER
        
        logger.info(f"[FIREBASE] Initialized FirebaseAuthService for project: {self.project_id}")

        # Initialize Firebase Admin SDK with explicit project ID
        try:
            # Use the project ID from settings
            self.project_id = settings.FIREBASE_PROJECT_ID
            logger.info(f"[FIREBASE] Using project ID from settings: {self.project_id}")
            
            # Try to use SERVICEACCOUNT_CREDENTIALS from settings (Secret Manager in Cloud Run)
            if hasattr(settings, 'SERVICEACCOUNT_CREDENTIALS') and settings.SERVICEACCOUNT_CREDENTIALS:
                logger.info(f"[FIREBASE] Using SERVICEACCOUNT_CREDENTIALS from settings/Secret Manager")
                self.firebase_app = self._ensure_firebase_app(self.project_id, settings.SERVICEACCOUNT_CREDENTIALS)
            else:
                # Fallback to environment variable
                logger.info(f"[FIREBASE] No SERVICEACCOUNT_CREDENTIALS in settings, checking environment variables")
                firebase_creds = os.environ.get("FIREBASE_CREDENTIALS")
                
                if firebase_creds:
                    try:
                        # Try to parse as JSON
                        cred_dict = json.loads(firebase_creds)
                        self.firebase_app = self._ensure_firebase_app(self.project_id, cred_dict)
                        logger.info(f"[FIREBASE] Using credentials from environment variable")
                    except json.JSONDecodeError:
                        # Not valid JSON, assume it's a path to the JSON file
                        self.firebase_app = self._ensure_firebase_app(self.project_id, firebase_creds)
                        logger.info(f"[FIREBASE] Using credentials file from environment variable")
                else:
                    # Last resort: try to use Application Default Credentials
                    logger.warning(f"[FIREBASE] No explicit credentials found, trying Application Default Credentials")
                    try:
                        self.firebase_app = self._ensure_firebase_app(self.project_id, None)
                        logger.info(f"[FIREBASE] Using Application Default Credentials")
                    except Exception as e:
                        logger.error(f"[FIREBASE] Failed to initialize with Application Default Credentials: {e}")
                        self.firebase_app = None
                        self.firestore_client = None
                        return
            
            # Initialize Firestore client
            self.firestore_client = firestore.client()
            logger.info(f"[FIREBASE] Firestore client initialized successfully with project ID: {self.project_id}")
            
        except Exception as e:
            logger.error(f"Firebase Admin init error: {e}")
            self.firestore_client = None
    
    def authenticate_user(self, email: str, password: str) -> Tuple[bool, Dict]:
        """
        Authenticate user via Firebase REST API
        Returns: (success, data)
        """
        url = f"{self.auth_endpoint}?key={self.api_key}"
        
        payload = {
            "email": email,
            "password": password,
            "returnSecureToken": True
        }
        
        try:
            logger.debug(f"[FIREBASE] Sending authentication request for user: {email}")
            response = requests.post(url, json=payload, timeout=10)
            data = response.json()
            
            if response.status_code == 200:
                logger.info(f"[FIREBASE] User {email} authenticated successfully")
                return True, {
                    'id_token': data['idToken'],
                    'refresh_token': data['refreshToken'],
                    'user_id': data['localId'],
                    'email': data['email'],
                    'expires_in': int(data['expiresIn'])
                }
            else:
                error_message = data.get('error', {}).get('message', 'Authentication failed')
                logger.warning(f"[FIREBASE] Authentication failed for {email}: {error_message}")
                return False, {'error': error_message}
                
        except requests.exceptions.RequestException as e:
            logger.error(f"[FIREBASE] API error: {str(e)}")
            return False, {'error': 'Authentication service unavailable'}
    
    def _get_firebase_public_keys(self) -> Dict:
        """
        Get Firebase public keys for token verification
        """
        # Cache keys for 1 hour
        if (self._public_keys and 
            time.time() - self._keys_last_fetched < 3600):
            return self._public_keys
        
        try:
            response = requests.get(
                self.public_keys_endpoint,
                timeout=10
            )
            
            if response.status_code == 200:
                self._public_keys = response.json()
                self._keys_last_fetched = time.time()
                return self._public_keys
            else:
                logger.error(f"Failed to fetch Firebase public keys: {response.status_code}")
                return {}
                
        except requests.exceptions.RequestException as e:
            logger.error(f"Error fetching Firebase public keys: {str(e)}")
            return {}
    
    def verify_id_token(self, id_token: str) -> Optional[Dict]:
        """
        Verify Firebase ID token using public key verification
        """
        logger.debug("Token verification started")
        try:
            # Check cache first
            # cache_key = f"firebase_token_{id_token[:20]}"
            # cached_user = cache.get(cache_key)
            # if cached_user:
            #     return cached_user
            
            # Get Firebase public keys
            public_keys = self._get_firebase_public_keys()
            if not public_keys:
                logger.error("No public keys available for token verification")
                return None
            
            # Decode token header to get key ID
            unverified_header = jwt.get_unverified_header(id_token)
            key_id = unverified_header.get('kid')
            
            if key_id not in public_keys:
                logger.error(f"Key ID {key_id} not found in public keys")
                return None
            
            # Verify token
            cert_str = public_keys[key_id]
            cert_obj = load_pem_x509_certificate(cert_str.encode(), default_backend())
            public_key = cert_obj.public_key()

            decoded_token = jwt.decode(
                id_token,
                public_key,
                algorithms=['RS256'],
                audience=self.project_id,
                issuer=f'{self.token_issuer}/{self.project_id}'
            )

            logger.debug(f"Token decoded successfully for user: {decoded_token.get('email', 'unknown')}")
            
            user_data = {
                'uid': decoded_token['sub'],
                'email': decoded_token.get('email'),
                'email_verified': decoded_token.get('email_verified', False),
                'name': decoded_token.get('name'),
                'exp': decoded_token.get('exp'),
            }
            
            # Cache for 5 minutes
            # cache.set(cache_key, user_data, 300)
            return user_data
            
        except jwt.ExpiredSignatureError:
            logger.warning("Token has expired")
            return None
        except jwt.InvalidTokenError as e:
            logger.error(f"Invalid token: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"Token verification failed: {str(e)}")
            return None
    
    def refresh_token(self, refresh_token: str) -> Tuple[bool, Dict]:
        """
        Refresh Firebase ID token
        """
        url = f"{self.token_endpoint}?key={self.api_key}"
        
        payload = {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token
        }
        
        try:
            response = requests.post(url, json=payload, timeout=10)
            data = response.json()
            
            if response.status_code == 200:
                return True, {
                    'id_token': data['id_token'],
                    'refresh_token': data['refresh_token'],
                    'expires_in': int(data['expires_in'])
                }
            else:
                return False, {'error': 'Token refresh failed'}
                
        except requests.exceptions.RequestException as e:
            logger.error(f"Token refresh error: {str(e)}")
            return False, {'error': 'Token refresh service unavailable'}

    def get_user_role(self, uid: str) -> str:
        """
        Get user role from Firestore 'users' collection using Admin SDK
        """
        try:
            if not self.firestore_client:
                logger.error("Firestore client not initialized")
                return "user"

            doc_ref = self.firestore_client.collection("users").document(uid)
            doc = doc_ref.get()
            logger.info(f"Checking Firestore for user {uid}")

            if doc.exists:
                user_data = doc.to_dict()
                logger.info(f"User document found: {user_data}")
                return user_data.get("role", "user")

            else:
                logger.warning(f"User document not found for UID: {uid}")
                return "user"

        except Exception as e:
            logger.error(f"Error fetching user role for {uid}: {e}")
            return "user"

    #Password reset
    def send_password_reset_email(self, email: str) -> bool:
        """
        Trigger Firebase Authentication to send a password reset email.
        """
        url = f"https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key={self.api_key}"
        payload = {
            "requestType": "PASSWORD_RESET",
            "email": email
        }
        try:
            response = requests.post(url, json=payload, timeout=10)
            if response.status_code == 200:
                logger.info(f"Password reset email sent to {email}")
                return True
            else:
                error = response.json().get("error", {}).get("message", "Unknown error")
                logger.error(f"Failed to send reset email for {email}: {error}")
                return False
        except requests.exceptions.RequestException as e:
            logger.error(f"Password reset request error: {str(e)}")
            return False

    def create_user_with_email_and_password(self, email: str, password: str, display_name: str = "") -> Tuple[bool, Dict]:
        """
        Create a new user with email and password via Firebase REST API
        Returns: (success, data)
        """
        url = f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={self.api_key}"
       
        payload = {
            "email": email,
            "password": password,
            "displayName": display_name,
            "returnSecureToken": True
        }
       
        try:
            logger.debug(f"[FIREBASE] Creating user: {email}")
            response = requests.post(url, json=payload, timeout=10)
            data = response.json()
           
            if response.status_code == 200:
                logger.info(f"[FIREBASE] User {email} created successfully")
                return True, {
                    'id_token': data['idToken'],
                    'refresh_token': data['refreshToken'],
                    'user_id': data['localId'],
                    'email': data['email'],
                    'expires_in': int(data['expiresIn'])
                }
            else:
                error_message = data.get('error', {}).get('message', 'User creation failed')
                logger.warning(f"[FIREBASE] User creation failed for {email}: {error_message}")
                return False, {'error': error_message}
               
        except requests.exceptions.RequestException as e:
            logger.error(f"[FIREBASE] API error: {str(e)}")
            return False, {'error': 'User creation service unavailable'}
 
    def send_email_verification(self, id_token: str) -> Tuple[bool, Dict]:
        """
        Send email verification link to user via Firebase REST API
        Returns: (success, data)
        """
        url = f"https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key={self.api_key}"
       
        payload = {
            "requestType": "VERIFY_EMAIL",
            "idToken": id_token
        }
       
        try:
            logger.debug(f"[FIREBASE] Sending verification email")
            response = requests.post(url, json=payload, timeout=10)
            data = response.json()
           
            if response.status_code == 200:
                logger.info(f"[FIREBASE] Verification email sent successfully")
                return True, {
                    'email': data.get('email'),
                    'message': 'Verification email sent successfully'
                }
            else:
                error_message = data.get('error', {}).get('message', 'Failed to send verification email')
                logger.warning(f"[FIREBASE] Verification email failed: {error_message}")
                return False, {'error': error_message}
               
        except requests.exceptions.RequestException as e:
            logger.error(f"[FIREBASE] Verification email API error: {str(e)}")
            return False, {'error': 'Verification service unavailable'}
    # Add these methods to your FirebaseAuthService class
 
    def check_email_verified(self, id_token: str) -> Tuple[bool, Dict]:
        """
        Check if user's email is verified using their ID token
        Returns: (success, data) where data contains email_verified status
        """
        try:
            # Verify the token to get user info
            decoded_token = self.verify_id_token(id_token)
            if not decoded_token:
                return False, {'error': 'Invalid token'}
           
            return True, {
                'email_verified': decoded_token.get('email_verified', False),
                'user_id': decoded_token.get('uid'),
                'email': decoded_token.get('email')
            }
           
        except Exception as e:
            logger.error(f"[FIREBASE] Email verification check failed: {str(e)}")
            return False, {'error': str(e)}
 
    def get_user_by_email(self, email: str) -> Optional[Dict]:
        """
        Get user by email from Firebase
        """
        try:
            # This would require Firebase Admin SDK for full implementation
            # For now, we'll use the verify_id_token approach
            # You might want to implement this properly with Admin SDK later
            return None
        except Exception as e:
            logger.error(f"[FIREBASE] Get user by email failed: {str(e)}")
            return None
 
    def create_custom_token(self, uid: str) -> str:
        """
        Create custom token for user (requires Firebase Admin SDK)
        This is a placeholder - you'll need to implement with Admin SDK
        """
        # This requires Firebase Admin SDK implementation
        logger.warning("[FIREBASE] create_custom_token not implemented - requires Admin SDK")
        return ""
 
    def exchange_custom_token_for_id_token(self, custom_token: str) -> Optional[str]:
        """
        Exchange custom token for ID token (requires Firebase Admin SDK)
        This is a placeholder - you'll need to implement with Admin SDK
        """
        # This requires Firebase Admin SDK implementation
        logger.warning("[FIREBASE] exchange_custom_token_for_id_token not implemented - requires Admin SDK")
        return None

    #get a user data
    def get_user_data(self, uid: str) -> Dict:
        """
        Get complete user data from Firestore and Firebase Auth
        """
        try:
            logger.info(f"[PROFILE] Fetching user data for UID: {uid}")
            
            # Get data from Firestore
            firestore_data = {}
            if self.firestore_client:
                try:
                    doc_ref = self.firestore_client.collection("users").document(uid)
                    doc = doc_ref.get()
                    
                    if doc.exists:
                        firestore_data = doc.to_dict()
                        # Ensure client_id is included (default to empty string if not present)
                        if 'client_id' not in firestore_data:
                            firestore_data['client_id'] = ''
                            
                        logger.info(f"[PROFILE] User document found in Firestore for UID: {uid}")
                        logger.info(f"[PROFILE] Firestore data: firstname='{firestore_data.get('firstname', 'NOT_FOUND')}', "
                                   f"lastname='{firestore_data.get('lastname', 'NOT_FOUND')}', "
                                   f"role='{firestore_data.get('role', 'NOT_FOUND')}', "
                                   f"email='{firestore_data.get('email', 'NOT_FOUND')}', "
                                   f"client_id='{firestore_data.get('client_id', 'NOT_FOUND')}', "
                                   f"keys={list(firestore_data.keys())}")
                    else:
                        logger.warning(f"[PROFILE] User document not found in Firestore for UID: {uid}")
                except Exception as fs_error:
                    logger.error(f"[PROFILE] Error fetching Firestore data for {uid}: {fs_error}")
            else:
                logger.error("[PROFILE] Firestore client not initialized")
            
            # Get data from Firebase Auth
            auth_data = self.get_user_auth_info(uid) or {}
            if auth_data:
                logger.info(f"[PROFILE] Firebase Auth data: display_name='{auth_data.get('display_name', 'NOT_FOUND')}', "
                           f"email='{auth_data.get('email', 'NOT_FOUND')}', "
                           f"keys={list(auth_data.keys())}")
            else:
                logger.warning(f"[PROFILE] No Firebase Auth data found for UID: {uid}")
            
            # Combine data with priority to Firestore for overlapping fields
            combined_data = {**auth_data, **firestore_data}
            
            # Ensure we have name fields
            if not combined_data.get('firstname') and auth_data.get('display_name'):
                # Parse display_name into firstname/lastname
                name_parts = auth_data.get('display_name', '').split()
                if name_parts:
                    combined_data['firstname'] = name_parts[0]
                    if len(name_parts) > 1:
                        combined_data['lastname'] = name_parts[-1]
                    logger.info(f"[PROFILE] Extracted name from display_name: firstname='{combined_data.get('firstname', '')}', "
                               f"lastname='{combined_data.get('lastname', '')}' from '{auth_data.get('display_name', '')}'") 
            
            # Ensure client_id is present in combined data
            if 'client_id' not in combined_data:
                combined_data['client_id'] = ''
            
            # Log if role is not found but don't set a default
            if 'role' not in combined_data:
                logger.warning(f"[PROFILE] No role found for user {uid}")
            
            # Log the final combined data
            logger.info(f"[PROFILE] Final user data for {uid}: "
                       f"firstname='{combined_data.get('firstname', 'NOT_SET')}', "
                       f"lastname='{combined_data.get('lastname', 'NOT_SET')}', "
                       f"role='{combined_data.get('role', 'NOT_SET')}', "
                       f"email='{combined_data.get('email', 'NOT_SET')}', "
                       f"client_id='{combined_data.get('client_id', 'NOT_SET')}', "
                       f"keys={list(combined_data.keys())}")
                
            return combined_data
            
        except Exception as e:
            logger.error(f"[PROFILE] Error in get_user_data for {uid}: {e}")
            return {}  # Return empty dict instead of defaulting to user role




    # delete a user

    def delete_user(self, user_id: str) -> dict:
        """
        Delete a user from both Firestore and Firebase Authentication
        Returns a dictionary with deletion status from both services
        """
        print(f"DEBUG: delete_user() method called for user ID: {user_id}")
        
        result = {
            'firebase_auth_deleted': False,
            'firestore_deleted': False,
            'errors': []
        }
        
        try:
            # Step 1: Delete from Firebase Authentication
            try:
                auth.delete_user(user_id)
                result['firebase_auth_deleted'] = True
                print(f"DEBUG: User {user_id} deleted from Firebase Authentication")
                logger.info(f"User {user_id} deleted from Firebase Authentication")
            except auth.UserNotFoundError:
                result['errors'].append(f"User {user_id} not found in Firebase Authentication")
                print(f"DEBUG: User {user_id} not found in Firebase Authentication")
            except Exception as auth_error:
                result['errors'].append(f"Firebase Auth error: {str(auth_error)}")
                print(f"DEBUG: Error deleting user from Firebase Auth: {auth_error}")

            # Step 2: Delete from Firestore
            try:
                if not self.firestore_client:
                    raise Exception("Firestore client not initialized")
                    
                user_ref = self.firestore_client.collection("users").document(user_id)
                user_doc = user_ref.get()
                
                if user_doc.exists:
                    user_ref.delete()
                    result['firestore_deleted'] = True
                    print(f"DEBUG: User {user_id} deleted successfully from Firestore")
                    logger.info(f"User {user_id} deleted from Firestore")
                else:
                    result['errors'].append(f"User {user_id} not found in Firestore")
                    print(f"DEBUG: User {user_id} not found in Firestore")
                    
            except Exception as firestore_error:
                result['errors'].append(f"Firestore error: {str(firestore_error)}")
                print(f"DEBUG: Error deleting user from Firestore: {firestore_error}")
            
            # Consider operation successful if at least one deletion worked
            result['overall_success'] = result['firebase_auth_deleted'] or result['firestore_deleted']
            
            return result
            
        except Exception as e:
            error_msg = f"Unexpected error in delete_user: {e}"
            result['errors'].append(error_msg)
            result['overall_success'] = False
            print(f"DEBUG: {error_msg}")
            logger.error(error_msg)
            return result

    #get all users
    def get_all_users(self) -> List[Dict]:
        """
        Get all users from Firestore with Firebase Auth information including last login
        """
        print("DEBUG: get_all_users() method called")
        
        try:
            if not self.firestore_client:
                print("DEBUG: Firestore client not initialized")
                logger.error("Firestore client not initialized")
                return []

            users_ref = self.firestore_client.collection("users")
            docs = users_ref.stream()
            
            users_list = []
            for doc in docs:
                user_data = doc.to_dict()
                user_data["id"] = doc.id  # Add the document ID as user ID
                
                # Ensure client_id is included
                if 'client_id' not in user_data:
                    user_data['client_id'] = ''
                
                # Get Firebase Auth info using your existing method
                auth_info = self.get_user_auth_info(doc.id)
                if auth_info:
                    # Merge auth info with user data
                    user_data.update({
                        'disabled': auth_info.get('disabled', False),
                        'email_verified': auth_info.get('email_verified', False),
                        'last_login': auth_info.get('last_login'),
                        'last_login_iso': auth_info.get('last_login_iso'),
                        'last_login_formatted': auth_info.get('last_login_formatted', 'Never'),
                        'created_at': auth_info.get('created_at'),
                        'created_at_iso': auth_info.get('created_at_iso'),
                        'created_at_formatted': auth_info.get('created_at_formatted', 'Unknown')
                    })
                else:
                    # Fallback if auth info not available
                    user_data.update({
                        'disabled': False,
                        'email_verified': False,
                        'last_login': None,
                        'last_login_iso': None,
                        'last_login_formatted': 'Never',
                        'created_at': None,
                        'created_at_iso': None,
                        'created_at_formatted': 'Unknown'
                    })
                
                users_list.append(user_data)
                
            print(f"DEBUG: Retrieved {len(users_list)} users from Firestore with auth info")
            logger.info(f"Retrieved {len(users_list)} users from Firestore with auth info")
            
            return users_list
            
        except Exception as e:
            print(f"DEBUG: Error in get_all_users: {e}")
            logger.error(f"Error fetching all users: {e}")
            return []    


    def get_user_auth_info(self, user_id: str) -> Optional[dict]:
        """
        Get Firebase Auth user information including last login
        """
        try:
            user = auth.get_user(user_id)
            
            # Extract user metadata
            metadata = user.user_metadata
            last_login = metadata.last_sign_in_timestamp if metadata else None
            created_at = metadata.creation_timestamp if metadata else None
            
            # Convert timestamps to readable format if needed
            last_login_iso = self._format_timestamp_to_iso(last_login) if last_login else None
            created_at_iso = self._format_timestamp_to_iso(created_at) if created_at else None
            
            return {
                'uid': user.uid,
                'email': user.email,
                'disabled': user.disabled,
                'email_verified': user.email_verified,
                'display_name': user.display_name,
                'phone_number': user.phone_number,
                'photo_url': user.photo_url,
                'provider_id': user.provider_id,
                'created_at': created_at,
                'created_at_iso': created_at_iso,
                'last_login': last_login,
                'last_login_iso': last_login_iso,
                'last_login_formatted': self._format_timestamp_readable(last_login),
                'created_at_formatted': self._format_timestamp_readable(created_at),
                'providers': [provider.provider_id for provider in user.provider_data] if user.provider_data else []
            }
        except auth.UserNotFoundError:
            print(f"DEBUG: User {user_id} not found in Firebase Auth")
            return None
        except Exception as e:
            print(f"DEBUG: Error getting user auth info: {e}")
            return None

    # firebase_service.py
    def _format_timestamp_to_iso(self, timestamp_ms):
        """Convert timestamp in milliseconds to ISO format"""
        if not timestamp_ms:
            return None
        try:
            # Convert milliseconds to seconds by dividing by 1000
            dt = datetime.fromtimestamp(timestamp_ms / 1000)
            return dt.isoformat()
        except Exception as e:
            print(f"DEBUG: Error formatting timestamp {timestamp_ms}: {e}")
            return None

    def _format_timestamp_readable(self, timestamp_ms):
        """Format timestamp in milliseconds to readable string"""
        if not timestamp_ms:
            return "Never"
        try:
            # Convert milliseconds to seconds by dividing by 1000
            dt = datetime.fromtimestamp(timestamp_ms / 1000)
            return dt.strftime("%Y-%m-%d %H:%M:%S")
        except Exception as e:
            print(f"DEBUG: Error formatting timestamp {timestamp_ms}: {e}")
            return "Never"

    #User active and incative function

    def update_user_status(self, user_id: str, disabled: bool) -> bool:
        """
        Update user active/inactive status in Firebase Authentication
        Returns True if successful, False if user not found
        """
        print(f"DEBUG: update_user_status() called for user {user_id}, disabled: {disabled}")
        
        try:
            # Update user status in Firebase Authentication
            auth.update_user(
                user_id,
                disabled=disabled
            )
            
            print(f"DEBUG: User {user_id} status updated to disabled={disabled} in Firebase Auth")
            logger.info(f"User {user_id} status updated to disabled={disabled}")
            
            # Optional: Also update in Firestore for consistency
            try:
                if self.firestore_client:
                    user_ref = self.firestore_client.collection("users").document(user_id)
                    user_doc = user_ref.get()
                    
                    if user_doc.exists:
                        user_ref.update({
                            'disabled': disabled,
                            'updated_at': datetime.now().isoformat()
                        })
                        print(f"DEBUG: User {user_id} status updated in Firestore")
            except Exception as firestore_error:
                print(f"DEBUG: Warning - Could not update Firestore: {firestore_error}")
                # Continue since Auth update was successful
            
            return True
            
        except auth.UserNotFoundError:
            print(f"DEBUG: User {user_id} not found in Firebase Authentication")
            logger.error(f"User {user_id} not found when updating status")
            return False
            
        except Exception as e:
            print(f"DEBUG: Error updating user status: {e}")
            logger.error(f"Error updating user {user_id} status: {e}")
            return False

    #create user
    def create_user(self, user_data: Dict) -> Dict:
        """
        Create a new user in Firebase Authentication and Firestore
        Returns user data if successful, raises exception if failed
        """
        print(f"DEBUG: create_user() called with data: {user_data}")
        
        try:
            # Extract user data
            email = user_data.get('email')
            password = user_data.get('password', 'TempPassword123!')  # Default temp password
            first_name = user_data.get('firstname') or user_data.get('firstName', '')
            last_name = user_data.get('lastname') or user_data.get('lastName', '')
            role = user_data.get('role', 'user')
            phone = user_data.get('phone', '')
            description = user_data.get('description', '')
            client_id = user_data.get('client_id', '')  # ADD THIS LINE - Extract client_id
            
            if not email:
                raise ValueError("Email is required to create a user")
            
            # Create user in Firebase Authentication
            user_record = auth.create_user(
                email=email,
                password=password,
                display_name=f"{first_name} {last_name}".strip(),
                disabled=False  # New users are active by default
            )
            
            print(f"DEBUG: User created in Firebase Auth with UID: {user_record.uid}")
            print(f"DEBUG: Client ID for new user: {client_id}")  # Log client_id
            
            # Prepare user data for Firestore
            firestore_user_data = {
                'email': email,
                'firstname': first_name,
                'lastname': last_name,
                'role': role,
                'phone': phone,
                'description': description,
                'client_id': client_id,  # ADD THIS LINE - Store client_id in Firestore
                'disabled': False,
                'email_verified': False,
                'created_at': datetime.now().timestamp() * 1000,  # Current timestamp in milliseconds
                'updated_at': datetime.now().isoformat(),
                # These will be populated when the user first logs in
                'last_login': None,
                'last_login_iso': None,
                'last_login_formatted': 'Never',
            }
            
            # Add user to Firestore
            if self.firestore_client:
                user_ref = self.firestore_client.collection("users").document(user_record.uid)
                user_ref.set(firestore_user_data)
                print(f"DEBUG: User added to Firestore with ID: {user_record.uid}")
                print(f"DEBUG: Client ID stored in Firestore: {client_id}")
            
            # Get auth info for the new user
            auth_info = self.get_user_auth_info(user_record.uid) or {}
            
            # Combine all user data
            complete_user_data = {
                **firestore_user_data,
                **auth_info,
                'id': user_record.uid,
            }
            
            logger.info(f"User created successfully: {user_record.uid} with client_id: {client_id}")
            return {
                'success': True,
                'user': complete_user_data,
                'message': 'User created successfully'
            }
            
        except auth.EmailAlreadyExistsError:
            error_msg = f"Email {email} already exists"
            print(f"DEBUG: {error_msg}")
            logger.error(error_msg)
            return {
                'success': False,
                'error': error_msg
            }
            
        except ValueError as ve:
            error_msg = f"Validation error: {ve}"
            print(f"DEBUG: {error_msg}")
            logger.error(error_msg)
            return {
                'success': False,
                'error': str(ve)
            }
            
        except Exception as e:
            error_msg = f"Error creating user: {e}"
            print(f"DEBUG: {error_msg}")
            logger.error(error_msg)
            
            # Cleanup: If Firebase user was created but Firestore failed, delete the auth user
            if 'user_record' in locals():
                try:
                    auth.delete_user(user_record.uid)
                    print(f"DEBUG: Cleaned up Firebase Auth user: {user_record.uid}")
                except:
                    pass
                    
            return {
                'success': False,
                'error': str(e)
            }

    def update_user(self, user_id: str, user_data: Dict) -> Dict:
        """
        Update an existing user in Firebase Authentication and Firestore
        """
        print(f"DEBUG: update_user() called for user {user_id} with data: {user_data}")
        
        try:
            # Update user in Firebase Authentication
            update_params = {}
            
            if 'email' in user_data:
                update_params['email'] = user_data['email']
            if 'firstname' in user_data or 'lastname' in user_data:
                first_name = user_data.get('firstname', '')
                last_name = user_data.get('lastname', '')
                update_params['display_name'] = f"{first_name} {last_name}".strip()
            if 'disabled' in user_data:
                update_params['disabled'] = user_data['disabled']
            
            if update_params:
                auth.update_user(user_id, **update_params)
                print(f"DEBUG: User {user_id} updated in Firebase Auth")
            
            # Prepare update data for Firestore
            firestore_update_data = {}
            if 'firstname' in user_data:
                firestore_update_data['firstname'] = user_data['firstname']
            if 'lastname' in user_data:
                firestore_update_data['lastname'] = user_data['lastname']
            if 'email' in user_data:
                firestore_update_data['email'] = user_data['email']
            if 'role' in user_data:
                firestore_update_data['role'] = user_data['role']
            if 'department' in user_data:
                firestore_update_data['department'] = user_data['department']
            if 'phone' in user_data:
                firestore_update_data['phone'] = user_data['phone']
            if 'description' in user_data:
                firestore_update_data['description'] = user_data['description']
            if 'disabled' in user_data:
                firestore_update_data['disabled'] = user_data['disabled']
            if 'client_id' in user_data:  # ADD THIS LINE - Handle client_id updates
                firestore_update_data['client_id'] = user_data['client_id']
                print(f"DEBUG: Updating client_id for user {user_id}: {user_data['client_id']}")
            
            # Always update the updated_at timestamp
            firestore_update_data['updated_at'] = datetime.now().isoformat()
            
            # Update user in Firestore
            if self.firestore_client and firestore_update_data:
                user_ref = self.firestore_client.collection("users").document(user_id)
                user_ref.update(firestore_update_data)
                print(f"DEBUG: User {user_id} updated in Firestore")
            
            # Get updated user data
            auth_info = self.get_user_auth_info(user_id) or {}
            firestore_data = self.firestore_client.collection("users").document(user_id).get().to_dict() if self.firestore_client else {}
            
            complete_user_data = {
                **firestore_data,
                **auth_info,
                'id': user_id,
            }
            
            logger.info(f"User updated successfully: {user_id} with client_id: {user_data.get('client_id', 'not changed')}")
            return {
                'success': True,
                'user': complete_user_data,
                'message': 'User updated successfully'
            }
            
        except auth.UserNotFoundError:
            error_msg = f"User {user_id} not found"
            print(f"DEBUG: {error_msg}")
            logger.error(error_msg)
            return {
                'success': False,
                'error': error_msg
            }
            
        except Exception as e:
            error_msg = f"Error updating user: {e}"
            print(f"DEBUG: {error_msg}")
            logger.error(error_msg)
            return {
                'success': False,
                'error': str(e)
            }

# Singleton instance
firebase_service = FirebaseAuthService()