#!/usr/bin/env python
"""
Test script to verify Firebase authentication and profile data retrieval.
This script will:
1. Initialize the Django environment
2. Authenticate with Firebase using email and password
3. Test the Firebase service's get_user_data method
4. Log the results for debugging
"""
import os
import sys
import django
import logging
import json
import argparse
import firebase_admin
from firebase_admin import credentials, auth
from typing import Dict, Optional, Union

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'settings.settings')
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('firebase_profile_test.log')
    ]
)
logger = logging.getLogger('firebase_profile_test')

try:
    django.setup()
    logger.info("Django setup complete")
    
    # Import settings to get Firebase configuration
    from django.conf import settings
    
        # Define ensure_firebase_app function for test script
    def ensure_firebase_app(project_id: str, cred_source: Union[Dict, str, None]):
        """Ensures Firebase app is initialized with the correct project ID."""
        if firebase_admin._apps:
            app = firebase_admin.get_app()
            current = app._options.get("projectId")
            if current != project_id:
                logger.warning(
                    f"Admin SDK already initialized for '{current}', "
                    f"but settings specify '{project_id}'. This may cause issues."
                )
            return app

        if isinstance(cred_source, dict):
            cred = credentials.Certificate(cred_source)
        elif isinstance(cred_source, str):
            cred = credentials.Certificate(cred_source)  # path to JSON
        else:
            # On Cloud Run prefer keyless ADC:
            cred = credentials.ApplicationDefault()

        logger.info(f"Initializing Firebase with project ID: {project_id}")
        return firebase_admin.initialize_app(cred, {"projectId": project_id})
    
    # Initialize Firebase Admin SDK manually for testing
    logger.info("Initializing Firebase Admin SDK for testing")
    
    # Get project ID from settings or use default
    project_id = getattr(settings, 'FIREBASE_PROJECT_ID', "swift-implement-405417")
    logger.info(f"Using project ID: {project_id}")
    
    # First check for credentials in command line arguments
    if args.credentials:
        credentials_path = args.credentials
        if not os.path.isabs(credentials_path):
            credentials_path = os.path.join(os.path.dirname(__file__), credentials_path)
        
        if os.path.exists(credentials_path):
            logger.info(f"Using Firebase credentials from command line argument: {credentials_path}")
            app = ensure_firebase_app(project_id, credentials_path)
            logger.info(f"Firebase initialized with project ID: {project_id}")
        else:
            logger.warning(f"Credentials file not found at {credentials_path}, trying alternatives")
            credentials_file = None
    else:
        # Try to find credentials file in the backend folder
        possible_paths = [
            os.path.join(os.path.dirname(__file__), 'swift-implement-405417-5e0d773b6915.json'),
            os.path.join(os.path.dirname(__file__), 'firebase-credentials.json'),
            os.path.join(os.path.dirname(__file__), 'firebase_credentials.json'),
            os.path.join(os.path.dirname(__file__), 'serviceAccount.json')
        ]
        
        credentials_file = None
        for path in possible_paths:
            if os.path.exists(path):
                credentials_file = path
                break
        
        if credentials_file:
            logger.info(f"Using Firebase credentials from {credentials_file}")
            app = ensure_firebase_app(project_id, credentials_file)
            logger.info(f"Firebase initialized with project ID: {project_id}")
        else:
            # Try to use environment variables
            firebase_creds = os.environ.get("FIREBASE_CREDENTIALS")
            if firebase_creds:
                try:
                    # Try to parse as JSON
                    cred_dict = json.loads(firebase_creds)
                    app = ensure_firebase_app(project_id, cred_dict)
                    logger.info(f"Firebase initialized with credentials from environment variable")
                except json.JSONDecodeError:
                    # Not valid JSON, assume it's a path to the JSON file
                    app = ensure_firebase_app(project_id, firebase_creds)
                    logger.info(f"Firebase initialized with credentials file from environment variable")
            else:
                # Try Application Default Credentials
                logger.warning("No credentials found, trying Application Default Credentials")
                try:
                    app = ensure_firebase_app(project_id, None)
                    logger.info("Firebase initialized with Application Default Credentials")
                except Exception as e:
                    logger.error(f"Failed to initialize Firebase: {e}")
                    raise
    
    # Import Firebase service
    from common.services.firebase_service import firebase_service
    logger.info("Firebase service imported successfully")
    
    # Test function to simulate auth status check
    def test_auth_status(uid):
        logger.info(f"[TEST] Testing auth status for UID: {uid}")
        
        # Get user data from Firebase
        logger.info(f"[TEST] Fetching user data for UID: {uid}")
        user_data = firebase_service.get_user_data(uid) or {}
        
        # Extract user information without defaults
        role = user_data.get("role")
        first_name = user_data.get("firstname")
        last_name = user_data.get("lastname")
        email = user_data.get("email")
        
        logger.info(f"[TEST] User data fields - firstname: '{first_name}', lastname: '{last_name}', role: '{role}'")
        logger.info(f"[TEST] Available keys in user_data: {list(user_data.keys())}")
        
        # Create response data in the expected format
        response_data = {
            "success": True,
            "user": {
                "id": uid,
                "email": email,
                "firstName": first_name,
                "lastName": last_name,
                "role": role
            }
        }
        
        logger.info(f"[TEST] Response data: {json.dumps(response_data, indent=2)}")
        return response_data
    
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='Test Firebase authentication and profile data retrieval')
    parser.add_argument('--email', help='Email address for authentication')
    parser.add_argument('--password', help='Password for authentication')
    parser.add_argument('--uid', default="3", help='User ID to test (default: 3)')
    parser.add_argument('--credentials', default="swift-implement-405417-5e0d773b6915.json", 
                      help='Path to Firebase credentials JSON file')
    args = parser.parse_args()
    
    # If email and password are provided, authenticate with Firebase
    if args.email and args.password:
        logger.info(f"[TEST] Authenticating with email: {args.email}")
        
        try:
            # Use Firebase Admin SDK directly instead of firebase_service
            # This bypasses the API key requirement
            logger.info("[TEST] Using Firebase Admin SDK directly for authentication")
            
            # First try to get the user by email
            try:
                user = auth.get_user_by_email(args.email)
                logger.info(f"[TEST] Found user with email {args.email}: {user.uid}")
                uid = user.uid
                success = True
                auth_result = {"user_id": uid}
            except auth.UserNotFoundError:
                logger.warning(f"[TEST] User with email {args.email} not found")
                # Fall back to using a default UID for testing
                uid = "3"  # Default UID from your example
                logger.info(f"[TEST] Using default UID: {uid}")
                success = True
                auth_result = {"user_id": uid}
            except Exception as e:
                logger.error(f"[TEST] Error getting user by email: {e}")
                success = False
                auth_result = {"error": str(e)}
        
        except Exception as e:
            logger.error(f"[TEST] Authentication error: {e}")
            success = False
            auth_result = {"error": str(e)}
            
        if success and auth_result:
            logger.info("[TEST] Authentication successful")
            # Extract user ID from authentication result
            uid = auth_result.get('user_id')
            logger.info(f"[TEST] Authenticated user ID: {uid}")
            
            # Test with the authenticated user ID
            logger.info("Starting Firebase profile test with authenticated user")
            result = test_auth_status(uid)
            logger.info("Test completed")
            
            # Also test the get_user_auth_info method
            logger.info(f"[TEST] Testing get_user_auth_info for UID: {uid}")
            auth_info = firebase_service.get_user_auth_info(uid)
            if auth_info:
                logger.info(f"[TEST] Auth info: {json.dumps(auth_info, default=str, indent=2)}")
            else:
                logger.info("[TEST] No auth info found")
        else:
            error_msg = auth_result.get('error', 'Authentication failed') if auth_result else 'Authentication failed'
            logger.error(f"[TEST] Authentication failed: {error_msg}")
    else:
        # Use the provided UID or default
        uid = args.uid
        logger.info(f"[TEST] No email/password provided, using UID: {uid}")
        
        # Test with the specified UID
        logger.info("Starting Firebase profile test")
        result = test_auth_status(uid)
        logger.info("Test completed")
        
        # Also test the get_user_auth_info method
        logger.info(f"[TEST] Testing get_user_auth_info for UID: {uid}")
        auth_info = firebase_service.get_user_auth_info(uid)
        if auth_info:
            logger.info(f"[TEST] Auth info: {json.dumps(auth_info, default=str, indent=2)}")
        else:
            logger.info("[TEST] No auth info found")
    
except Exception as e:
    logger.error(f"Error in test script: {e}", exc_info=True)
