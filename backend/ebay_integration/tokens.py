import time
from django.conf import settings

class EbayTokenManager:
    def __init__(self):
        self.token = None
        self.expiry = 0  # UNIX timestamp
        self.refresh_token = None

    def is_valid(self, token=None):
        """Check if token exists and hasn't expired"""
        if token:
            return token == self.token and time.time() < self.expiry
        return self.token is not None and time.time() < self.expiry

    def set_token(self, token, expires_in=None):
        """Store token with expiration"""
        self.token = token
        # eBay tokens expire in 7200 seconds (2 hours)
        self.expiry = time.time() + (expires_in or 7200)

    def set_refresh_token(self, refresh_token):
        """Store refresh token (long-lived)"""
        self.refresh_token = refresh_token

    def get_token(self):
        """Return token if valid"""
        return self.token if self.is_valid() else None

    def get_refresh_token(self):
        """Return refresh token"""
        return self.refresh_token

# Singleton token manager instance
ebay_token_manager = EbayTokenManager()