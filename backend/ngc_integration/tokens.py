import time
from django.conf import settings

class TokenManager:
    def __init__(self):
        self.token = None
        self.expiry = 0  # UNIX timestamp

    def is_valid(self, token=None):
        """Check if token exists and hasn't expired"""
        if token:
            return token == self.token and time.time() < self.expiry
        return self.token is not None and time.time() < self.expiry

    def set_token(self, token, expires_in=None):
        """Store token with expiration"""
        self.token = token
        self.expiry = time.time() + (expires_in or settings.SESSION_COOKIE_AGE)

    def get_token(self):
        """Return token if valid"""
        return self.token if self.is_valid() else None

# Singleton token manager instance
token_manager = TokenManager()