import requests
import logging
from .tokens import token_manager
from django.conf import settings
from inventory.models import Category, Location, InventoryItem
from .ngc_normalizer import normalize_ngc_for_inventory
from client_management.models import Client

# Set up logging
logger = logging.getLogger(__name__)

def get_ngc_auth_token(request=None):
    """
    Authenticate with NGC API and return a bearer token.
    Uses config() from python-decouple via Django settings.
    """
    # Check cookies first if request is available
    if request and 'ngc_token' in request.COOKIES:
        cookie_token = request.COOKIES['ngc_token']
        if token_manager.is_valid(cookie_token):
            token_manager.set_token(cookie_token)
            logger.info("Using valid token from cookies")
            return cookie_token

    # Check token manager
    if token_manager.is_valid():
        token = token_manager.get_token()
        logger.info("Using valid token from token_manager")
        return token

    # Get new token from API using settings
    login_url = f"{settings.NGC_BASE_URL}{settings.NGC_AUTH_PATH}/{settings.NGC_COMPANY}"
    payload = {
        "username": settings.NGC_USERNAME,
        "password": settings.NGC_PASSWORD
    }
    
    # Add debugging logs - using both logger and print for maximum visibility
    print(f"DEBUG: NGC_USERNAME is set: {'Yes' if settings.NGC_USERNAME else 'No'} (length: {len(settings.NGC_USERNAME) if settings.NGC_USERNAME else 0})")
    print(f"DEBUG: NGC_PASSWORD is set: {'Yes' if settings.NGC_PASSWORD else 'No'} (length: {len(settings.NGC_PASSWORD) if settings.NGC_PASSWORD else 0})")
    print(f"DEBUG: NGC_COMPANY is set: {'Yes' if settings.NGC_COMPANY else 'No'} (value: {settings.NGC_COMPANY})")
    print(f"DEBUG: NGC_AUTH_PATH: {settings.NGC_AUTH_PATH}")
    print(f"DEBUG: Login URL: {login_url}")
    print(f"DEBUG: Payload: {{'username': '[MASKED]', 'password': '[MASKED]'}}")
    
    logger.info(f"NGC_USERNAME is set: {'Yes' if settings.NGC_USERNAME else 'No'} (length: {len(settings.NGC_USERNAME) if settings.NGC_USERNAME else 0})")
    logger.info(f"NGC_PASSWORD is set: {'Yes' if settings.NGC_PASSWORD else 'No'} (length: {len(settings.NGC_PASSWORD) if settings.NGC_PASSWORD else 0})")
    logger.info(f"NGC_COMPANY is set: {'Yes' if settings.NGC_COMPANY else 'No'} (value: {settings.NGC_COMPANY})")
    logger.info(f"NGC_AUTH_PATH: {settings.NGC_AUTH_PATH}")
    logger.info(f"Login URL: {login_url}")
    logger.info(f"Payload: {{'username': '[MASKED]', 'password': '[MASKED]'}}")
    
    # Try multiple authentication approaches since we're getting a 403 error
    auth_methods = [
        # Method 1: Company in URL path (original approach)
        {
            "url": f"{settings.NGC_BASE_URL}{settings.NGC_AUTH_PATH}/{settings.NGC_COMPANY}",
            "payload": {
                "username": settings.NGC_USERNAME,
                "password": settings.NGC_PASSWORD
            },
            "description": "Company in URL path"
        },
        # Method 2: Company in payload
        {
            "url": f"{settings.NGC_BASE_URL}{settings.NGC_AUTH_PATH}",
            "payload": {
                "username": settings.NGC_USERNAME,
                "password": settings.NGC_PASSWORD,
                "company": settings.NGC_COMPANY
            },
            "description": "Company in payload"
        },
        # Method 3: No company name, just username/password
        {
            "url": f"{settings.NGC_BASE_URL}{settings.NGC_AUTH_PATH}",
            "payload": {
                "username": settings.NGC_USERNAME,
                "password": settings.NGC_PASSWORD
            },
            "description": "No company name"
        },
        # Method 4: Try with lowercase company name
        {
            "url": f"{settings.NGC_BASE_URL}{settings.NGC_AUTH_PATH}/{settings.NGC_COMPANY.lower()}",
            "payload": {
                "username": settings.NGC_USERNAME,
                "password": settings.NGC_PASSWORD
            },
            "description": "Lowercase company in URL"
        },
    ]
    
    # Try each authentication method until one works
    last_error = None
    for method in auth_methods:
        try:
            login_url = method["url"]
            payload = method["payload"]
            description = method["description"]
            
            print(f"DEBUG: Trying authentication method: {description}")
            print(f"DEBUG: URL: {login_url}")
            logger.info(f"Trying authentication method: {description}")
            logger.info(f"URL: {login_url}")
            
            # Make the authentication request
            response = requests.post(login_url, json=payload, timeout=30)
            
            # Log response status
            print(f"DEBUG: Response status code: {response.status_code} for method: {description}")
            logger.info(f"Response status code: {response.status_code} for method: {description}")
            
            # If successful, return the token
            if response.status_code == 200:
                token = response.text.strip('"\'')
                if token:
                    token_manager.set_token(token)
                    print(f"DEBUG: Authentication successful using method: {description}")
                    logger.info(f"Authentication successful using method: {description}")
                    return token
            
            # If we get here, this method didn't work
            content_preview = response.text[:100] if len(response.text) > 100 else response.text
            print(f"DEBUG: Method {description} failed with status {response.status_code}: {content_preview}")
            logger.info(f"Method {description} failed with status {response.status_code}: {content_preview}")
            
        except Exception as e:
            print(f"DEBUG: Method {description} failed with exception: {str(e)}")
            logger.error(f"Method {description} failed with exception: {str(e)}")
            last_error = e
    
    # If we get here, all methods failed
    error_msg = "All authentication methods failed"
    if last_error:
        error_msg += f": {str(last_error)}"
    
    print(f"DEBUG: {error_msg}")
    logger.error(error_msg)
    raise Exception(error_msg)

def save_ngc_payload_to_inventory(
    ngc_payload,
    client_id,
    category_id,
    price=0,
    status="in_store",
    location_id=None,
    notes="",
    *,
    created_by: str | None = None,
    name: str | None = None,
    description: str | None = None,
):
    client = Client.objects.get(id=client_id)
    category = Category.objects.get(id=category_id)
    location = Location.objects.get(id=location_id) if location_id else None

    normalized = normalize_ngc_for_inventory(ngc_payload)

    # Get the certificate number from the normalized data or directly from the payload
    cert_number = normalized["attributes"].get("cert_number") or ngc_payload.get("certNumber") or ""
    
    # Build name/description
    item_name = name or normalized["name"]
    # Auto-generate a basic description if not provided
    if not description:
        coin = (normalized.get("attributes") or {}).get("coin", {})
        grade = (normalized.get("attributes") or {}).get("grade", {})
        year = coin.get("year") or ""
        denomination = coin.get("denomination") or ""
        variety = coin.get("variety") or ""
        grade_display = grade.get("display") or ""
        parts = []
        if variety or denomination:
            parts.append(f"{variety} {denomination}".strip())
        if grade_display:
            parts.append(f"graded {grade_display}")
        if year:
            parts.append(f"Dated {year}")
        if cert_number:
            parts.append(f"Certificate #{cert_number}")
        description = ". ".join([p for p in parts if p])

    item = InventoryItem(
        client=client,
        category=category,
        status=status,
        price=price,
        name=item_name,
        thumbnail=normalized["thumbnail"],
        images=normalized["images"],
        attributes=normalized["attributes"],
        identification_number=cert_number,  # Set the identification_number field
        location=location,
        notes=notes or "",
        description=description or "",
    )
    if created_by:
        item.created_by = created_by

    item.full_clean()
    item.save()
    return item


def fetch_coin(identifier, by_barcode=False):
    """
    Fetch coin details from NGC API and return complete response
    """
    try:
        # If not in DB → call NGC API using settings
        token = get_ngc_auth_token()
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

        if by_barcode:
            # Use the barcode path from environment variables
            lookup_url = f"{settings.NGC_BASE_URL}{settings.NGC_BARCODE_PATH}/{identifier}?include=images"
        else:
            # Use the lookup path from environment variables
            lookup_url = f"{settings.NGC_BASE_URL}{settings.NGC_LOOKUP_PATH}/{identifier}?include=images"
        
        logger.info(f"Fetching coin from NGC API")
        response = requests.get(lookup_url, headers=headers)
        response.raise_for_status()
        
        # Return the complete API response
        data = response.json()
        
        # Add debugging for the API response structure
        print("NGC API Response Structure:")
        print(f"Keys in response: {list(data.keys())}")
        if 'images' in data:
            print(f"Image keys: {list(data['images'].keys())}")
        else:
            print("No 'images' key in response")
            # Check if images might be nested elsewhere
            for key in data.keys():
                if isinstance(data[key], dict) and 'images' in data[key]:
                    print(f"Found images in {key}: {list(data[key]['images'].keys())}")
        
        return data

    except requests.exceptions.RequestException as e:
        logger.error(f"API request failed: {str(e)}")
        # Log the full error for debugging but show a simplified message to the user
        raise Exception("Failed to fetch coin data")