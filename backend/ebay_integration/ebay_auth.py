import requests
import logging
import base64
from django.conf import settings
from .tokens import ebay_token_manager

# Set up logging
logger = logging.getLogger(__name__)

def get_ebay_auth_token(request=None):
    """
    Authenticate with eBay API and return a bearer token.
    Uses refresh token flow for automatic token renewal.
    """
    # Check cookies first if request is available
    if request and 'ebay_token' in request.COOKIES:
        cookie_token = request.COOKIES['ebay_token']
        if ebay_token_manager.is_valid(cookie_token):
            ebay_token_manager.set_token(cookie_token)
            logger.info("Using valid token from cookies")
            return cookie_token

    # Check token manager
    if ebay_token_manager.is_valid():
        token = ebay_token_manager.get_token()
        logger.info("Using valid token from token_manager")
        return token

    # Get new token using refresh token
    return refresh_ebay_token()

def refresh_ebay_token():
    """
    Refresh eBay access token using refresh token
    """
    try:
        config = settings.EBAY_CONFIG['SANDBOX']
        refresh_token = ebay_token_manager.get_refresh_token() or config.get('refresh_token')
        
        if not refresh_token:
            raise Exception("No refresh token available. Need initial OAuth flow.")
        
        # eBay OAuth endpoint
        token_url = "https://api.sandbox.ebay.com/identity/v1/oauth2/token"
        
        # Prepare Basic Auth header
        credentials = f"{config['client_id']}:{config['client_secret']}"
        encoded_credentials = base64.b64encode(credentials.encode()).decode()
        
        # Request headers
        headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': f'Basic {encoded_credentials}'
        }
        
        # Request payload
        data = {
            'grant_type': 'refresh_token',
            'refresh_token': refresh_token,
            'scope': 'https://api.ebay.com/oauth/api_scope/sell.inventory https://api.ebay.com/oauth/api_scope/sell.account'
        }
        
        logger.info("Refreshing eBay access token...")
        print(f"🔄 Refreshing eBay token with refresh token: {refresh_token[:20]}...")
        
        response = requests.post(token_url, headers=headers, data=data, timeout=30)
        
        if response.status_code == 200:
            token_data = response.json()
            access_token = token_data['access_token']
            expires_in = token_data.get('expires_in', 7200)
            
            # Store the new token
            ebay_token_manager.set_token(access_token, expires_in)
            
            # Update refresh token if provided (eBay may return a new one)
            if 'refresh_token' in token_data:
                ebay_token_manager.set_refresh_token(token_data['refresh_token'])
                print(f"✅ New refresh token stored: {token_data['refresh_token'][:20]}...")
            
            print(f"✅ Access token refreshed, expires in: {expires_in} seconds")
            logger.info("eBay token refreshed successfully")
            return access_token
        else:
            error_msg = f"Token refresh failed: {response.status_code} - {response.text}"
            print(f"❌ {error_msg}")
            logger.error(error_msg)
            raise Exception(error_msg)
            
    except Exception as e:
        error_msg = f"Error refreshing eBay token: {str(e)}"
        print(f"❌ {error_msg}")
        logger.error(error_msg)
        raise Exception("Failed to refresh eBay access token")