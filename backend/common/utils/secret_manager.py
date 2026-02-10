import json
import os
import logging
from django.conf import settings

# Handle environments where google-cloud-secret-manager isn't installed
try:
    from google.cloud import secretmanager
except Exception:
    secretmanager = None

logger = logging.getLogger(__name__)

class SecretManager:
    def __init__(self):
        # In local/dev without GCP libs, make this a no-op to avoid breaking management commands
        self.client = None
        self.project_id = None
        self.credentials = None

        try:
            if secretmanager is None:
                logger.warning("[SECRET_MANAGER] google-cloud-secret-manager not installed; SecretManager disabled for this run")
                return

            # Get project ID and credentials from the existing service account file
            self.project_id, self.credentials = self._get_google_cloud_config()

            if not self.project_id:
                logger.warning("[SECRET_MANAGER] No project ID detected; SecretManager disabled for this run")
                return

            logger.info(f"[SECRET_MANAGER] ✅ Using Google Cloud project: {self.project_id}")

            # Initialize client with the service account credentials
            if self.credentials:
                self.client = secretmanager.SecretManagerServiceClient(credentials=self.credentials)
                logger.info("[SECRET_MANAGER] Using service account credentials from FIREBASE_CREDENTIALS/SERVICEACCOUNT_CREDENTIALS")
            else:
                self.client = secretmanager.SecretManagerServiceClient()
                logger.info("[SECRET_MANAGER] Using Application Default Credentials")

        except Exception as e:
            logger.error(f"[SECRET_MANAGER] Initialization error: {str(e)} - SecretManager disabled for this run")
            self.client = None
    
    def _get_google_cloud_config(self):
        """Get Google Cloud project ID and credentials from the service account file"""
        # Check FIREBASE_CREDENTIALS environment variable (your existing service account)
        firebase_creds_path = os.environ.get("FIREBASE_CREDENTIALS")
        
        if firebase_creds_path and os.path.exists(firebase_creds_path):
            try:
                with open(firebase_creds_path, 'r') as f:
                    service_account_info = json.load(f)
                
                project_id = service_account_info.get('project_id')
                
                if project_id:
                    from google.oauth2 import service_account
                    credentials = service_account.Credentials.from_service_account_file(firebase_creds_path)
                    
                    logger.info(f"[SECRET_MANAGER] Using service account from FIREBASE_CREDENTIALS: {firebase_creds_path}")
                    logger.info(f"[SECRET_MANAGER] Project ID from service account: {project_id}")
                    
                    return project_id, credentials
                else:
                    logger.error("[SECRET_MANAGER] Service account JSON missing project_id")
                    
            except Exception as e:
                logger.error(f"[SECRET_MANAGER] Error reading service account file: {e}")
        
        # Fallback: Check if SERVICEACCOUNT_CREDENTIALS in settings has the service account info
        if hasattr(settings, 'SERVICEACCOUNT_CREDENTIALS') and settings.SERVICEACCOUNT_CREDENTIALS:
            try:
                service_account_info = settings.SERVICEACCOUNT_CREDENTIALS
                project_id = service_account_info.get('project_id')
                
                if project_id:
                    from google.oauth2 import service_account
                    credentials = service_account.Credentials.from_service_account_info(service_account_info)
                    
                    logger.info(f"[SECRET_MANAGER] Using SERVICEACCOUNT_CREDENTIALS from settings")
                    logger.info(f"[SECRET_MANAGER] Project ID from settings: {project_id}")
                    
                    return project_id, credentials
            except Exception as e:
                logger.error(f"[SECRET_MANAGER] Error with SERVICEACCOUNT_CREDENTIALS: {e}")
        
        # Final fallback: Try environment variable(s) commonly present on GCP
        # Cloud Run often exposes GCP_PROJECT; some environments expose GOOGLE_CLOUD_PROJECT
        project_id = os.getenv('GOOGLE_CLOUD_PROJECT') or os.getenv('GCP_PROJECT')
        if project_id:
            logger.info(f"[SECRET_MANAGER] Using project from environment: {project_id}")
            return project_id, None
        
        logger.error("[SECRET_MANAGER] Could not find Google Cloud service account configuration")
        return None, None
    
    def get_secret(self, secret_id, version_id="latest"):
        """Retrieve secret value from Secret Manager"""
        try:
            if not self.client or not self.project_id:
                # Fallback: use environment variables (Cloud Run Variables & Secrets)
                env_val = os.environ.get(secret_id)
                if env_val is not None:
                    logger.info(f"[SECRET_MANAGER] Using env var fallback for secret: {secret_id}")
                    return env_val
                logger.warning("[SECRET_MANAGER] Client not initialized; get_secret returning None")
                return None
            name = f"projects/{self.project_id}/secrets/{secret_id}/versions/{version_id}"
            logger.info(f"[SECRET_MANAGER] Attempting to get secret: {name}")
            response = self.client.access_secret_version(name=name)
            secret_value = response.payload.data.decode('UTF-8')
            logger.info(f"[SECRET_MANAGER] ✅ Successfully retrieved secret: {secret_id}")
            return secret_value
        except Exception as e:
            logger.error(f"[SECRET_MANAGER] Error retrieving secret {secret_id}: {str(e)}")
            # Fallback to environment variable if Secret Manager access fails
            env_val = os.environ.get(secret_id)
            if env_val is not None:
                logger.info(f"[SECRET_MANAGER] Using env var fallback after error for secret: {secret_id}")
                return env_val
            return None
    
    def create_secret(self, secret_id):
        """Create a new secret"""
        try:
            if not self.client or not self.project_id:
                logger.warning("[SECRET_MANAGER] Client not initialized; create_secret returning False")
                return False
            parent = f"projects/{self.project_id}"
            self.client.create_secret(
                request={
                    "parent": parent,
                    "secret_id": secret_id,
                    "secret": {"replication": {"automatic": {}}},
                }
            )
            logger.info(f"[SECRET_MANAGER] ✅ Successfully created secret: {secret_id}")
            return True
        except Exception as e:
            logger.error(f"[SECRET_MANAGER] Error creating secret {secret_id}: {str(e)}")
            return False
    
    def update_secret(self, secret_id, secret_value):
        """Update secret value"""
        try:
            if not self.client or not self.project_id:
                logger.warning("[SECRET_MANAGER] Client not initialized; update_secret returning False")
                return False
            parent = f"projects/{self.project_id}/secrets/{secret_id}"
            response = self.client.add_secret_version(
                request={"parent": parent, "payload": {"data": secret_value.encode("UTF-8")}}
            )
            logger.info(f"[SECRET_MANAGER] ✅ Successfully updated secret: {secret_id}")
            return True
        except Exception as e:
            logger.error(f"[SECRET_MANAGER] Error updating secret {secret_id}: {str(e)}")
            return False
    
    def list_secrets(self):
        """List all secrets"""
        try:
            if not self.client or not self.project_id:
                logger.warning("[SECRET_MANAGER] Client not initialized; list_secrets returning []")
                return []
            parent = f"projects/{self.project_id}"
            secrets = list(self.client.list_secrets(request={"parent": parent}))
            logger.info(f"[SECRET_MANAGER] Listed {len(secrets)} secrets")
            return secrets
        except Exception as e:
            logger.error(f"[SECRET_MANAGER] Error listing secrets: {str(e)}")
            return []
    
    def secret_exists(self, secret_id):
        """Check if a secret exists"""
        try:
            if not self.client or not self.project_id:
                # If Secret Manager isn't initialized, check env var presence
                if secret_id in os.environ:
                    logger.info(f"[SECRET_MANAGER] Env var present for secret: {secret_id}")
                    return True
                logger.warning("[SECRET_MANAGER] Client not initialized; secret_exists returning False")
                return False
            name = f"projects/{self.project_id}/secrets/{secret_id}"
            self.client.get_secret(name=name)
            logger.info(f"[SECRET_MANAGER] Secret exists: {secret_id}")
            return True
        except Exception as e:
            # If secret is not in Secret Manager, still report True if env var is set
            if secret_id in os.environ:
                logger.info(f"[SECRET_MANAGER] Env var present for secret (SM not found): {secret_id}")
                return True
            logger.info(f"[SECRET_MANAGER] Secret does not exist: {secret_id}")
            return False