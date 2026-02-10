from rest_framework import status
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
    parser_classes
)
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.parsers import JSONParser
from rest_framework.views import APIView
from django.views.decorators.csrf import csrf_exempt
from common.utils.secret_manager import SecretManager
import json
import logging

logger = logging.getLogger(__name__)

class SecretsListView(APIView):
    """
    List all secrets or create/update a secret
    TEMPORARY: No authentication required
    """
    authentication_classes = []
    permission_classes = [AllowAny]
    parser_classes = [JSONParser]
    
    def post(self, request):
        """Create or update a secret - no auth required temporarily"""
        logger.info(f"📨 [Secrets API] Received POST request (NO AUTH)")
        
        secret_id = request.data.get('secret_id')
        secret_value = request.data.get('secret_value')
        
        if not secret_id or not secret_value:
            return Response(
                {'error': 'Both secret_id and secret_value are required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            secret_manager = SecretManager()
            logger.info(f"🔄 [Secrets API] Processing secret: {secret_id}")
            
            # Check if secret exists, create if not
            if not secret_manager.secret_exists(secret_id):
                logger.info(f"🆕 [Secrets API] Creating new secret: {secret_id}")
                secret_manager.create_secret(secret_id)
            
            # Update secret value
            logger.info(f"🔄 [Secrets API] Updating secret: {secret_id}")
            success = secret_manager.update_secret(secret_id, secret_value)
            
            if success:
                logger.info(f"✅ [Secrets API] Secret {secret_id} updated successfully")
                return Response({
                    'message': f'Secret {secret_id} updated successfully',
                    'secret_id': secret_id
                }, status=status.HTTP_200_OK)
            else:
                logger.error(f"❌ [Secrets API] Failed to update secret: {secret_id}")
                return Response(
                    {'error': 'Failed to update secret'}, 
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
                
        except Exception as e:
            logger.error(f"💥 [Secrets API] Error managing secret: {str(e)}", exc_info=True)
            return Response(
                {'error': f'Failed to manage secret: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class SecretDetailView(APIView):
    """
    Get secret details (masked value for sensitive data only)
    TEMPORARY: No authentication required
    """
    authentication_classes = []
    permission_classes = [AllowAny]
    
    def get(self, request, secret_id):
        """Get secret details with masked value for sensitive data only"""
        try:
            logger.info(f"[SECRET_DETAIL] GET request for {secret_id} (NO AUTH)")
            secret_manager = SecretManager()
            value = secret_manager.get_secret(secret_id)
            
            if value:
                # Define which secrets should be masked (sensitive data)
                sensitive_secrets = [
                    # API Keys and Tokens
                    'API_KEY', 'PASSWORD', 'SECRET', 'TOKEN', 'AUTH', 
                    'CREDENTIAL', 'KEY', 'NGC_PASSWORD', 'OPENAI_API_KEY',
                    'EBAY_.*_TOKEN', 'EBAY_.*_AUTH', 'REFRESH_TOKEN',
                    # Specific known sensitive secrets
                    'NGC_PASSWORD', 'OPENAI_API_KEY'
                ]
                
                # Check if this secret should be masked
                should_mask = any(
                    pattern.lower() in secret_id.lower() 
                    for pattern in sensitive_secrets
                )
                
                if should_mask:
                    # Mask sensitive values
                    if len(value) > 8:
                        masked_value = value[:4] + '*' * (len(value) - 8) + value[-4:]
                    else:
                        masked_value = '****'
                else:
                    # Return non-sensitive values as-is (DB names, usernames, ports, etc.)
                    masked_value = value
                    
                return Response({
                    'secret_id': secret_id,
                    'value_masked': masked_value,
                    'exists': True,
                    'length': len(value),
                    'is_sensitive': should_mask  # Optional: useful for frontend
                })
            else:
                return Response({
                    'secret_id': secret_id,
                    'exists': False
                })
                
        except Exception as e:
            logger.error(f"Error fetching secret {secret_id}: {str(e)}")
            return Response(
                {'error': f'Failed to fetch secret: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

# Alternative: Function-based view version (if you prefer)
@api_view(['GET', 'POST'])
@authentication_classes([])
@permission_classes([AllowAny])
@parser_classes([JSONParser])
@csrf_exempt
def secrets_manage_view(request, secret_id=None):
    """
    Function-based view alternative for secret management
    """
    if request.method == 'POST':
        logger.info(f"📨 [Secrets API] Received POST request (NO AUTH)")
        
        secret_id = request.data.get('secret_id')
        secret_value = request.data.get('secret_value')
        
        if not secret_id or not secret_value:
            return Response(
                {'error': 'Both secret_id and secret_value are required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            secret_manager = SecretManager()
            logger.info(f"🔄 [Secrets API] Processing secret: {secret_id}")
            
            # Check if secret exists, create if not
            if not secret_manager.secret_exists(secret_id):
                logger.info(f"🆕 [Secrets API] Creating new secret: {secret_id}")
                secret_manager.create_secret(secret_id)
            
            # Update secret value
            logger.info(f"🔄 [Secrets API] Updating secret: {secret_id}")
            success = secret_manager.update_secret(secret_id, secret_value)
            
            if success:
                logger.info(f"✅ [Secrets API] Secret {secret_id} updated successfully")
                return Response({
                    'message': f'Secret {secret_id} updated successfully',
                    'secret_id': secret_id
                }, status=status.HTTP_200_OK)
            else:
                logger.error(f"❌ [Secrets API] Failed to update secret: {secret_id}")
                return Response(
                    {'error': 'Failed to update secret'}, 
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
                
        except Exception as e:
            logger.error(f"💥 [Secrets API] Error managing secret: {str(e)}", exc_info=True)
            return Response(
                {'error': f'Failed to manage secret: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    elif request.method == 'GET' and secret_id:
        """Get secret details with masked value for sensitive data only"""
        try:
            logger.info(f"[SECRET_DETAIL] GET request for {secret_id} (NO AUTH)")
            secret_manager = SecretManager()
            value = secret_manager.get_secret(secret_id)
            
            if value:
                # Define which secrets should be masked (sensitive data)
                sensitive_secrets = [
                    'API_KEY', 'PASSWORD', 'SECRET', 'TOKEN', 'AUTH', 
                    'CREDENTIAL', 'KEY', 'NGC_PASSWORD', 'OPENAI_API_KEY',
                    'EBAY_.*_TOKEN', 'EBAY_.*_AUTH', 'REFRESH_TOKEN',
                    'NGC_PASSWORD', 'OPENAI_API_KEY'
                ]
                
                # Check if this secret should be masked
                should_mask = any(
                    pattern.lower() in secret_id.lower() 
                    for pattern in sensitive_secrets
                )
                
                if should_mask:
                    # Mask sensitive values
                    if len(value) > 8:
                        masked_value = value[:4] + '*' * (len(value) - 8) + value[-4:]
                    else:
                        masked_value = '****'
                else:
                    # Return non-sensitive values as-is
                    masked_value = value
                    
                return Response({
                    'secret_id': secret_id,
                    'value_masked': masked_value,
                    'exists': True,
                    'length': len(value),
                    'is_sensitive': should_mask
                })
            else:
                return Response({
                    'secret_id': secret_id,
                    'exists': False
                })
                
        except Exception as e:
            logger.error(f"Error fetching secret {secret_id}: {str(e)}")
            return Response(
                {'error': f'Failed to fetch secret: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )