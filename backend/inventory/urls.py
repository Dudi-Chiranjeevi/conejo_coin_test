# inventory/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import *

# Create a router for DRF viewsets
router = DefaultRouter()

# Register all viewsets with the router
# Uncomment these as you implement the views
# router.register(r'categories', CategoryViewSet)
# router.register(r'locations', LocationViewSet)
router.register(r'inventory_items', InventoryItemViewSet, basename='inventory_items')
# router.register(r'auth', AuthViewSet, basename='auth')  # Auth functionality moved to common/auth/
# router.register(r'status_history', StatusHistoryViewSet)

# Define URL patterns for the inventory app
urlpatterns = [
    # Inventory endpoints - no longer need api/v1/ prefix as it's handled by the main URL configuration
    path('', include(router.urls)),
    path("test-auth/", TestAuthView.as_view()),
]
