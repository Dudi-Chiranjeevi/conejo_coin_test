# ebay_integration/urls.py
from django.urls import path
from . import views

urlpatterns = [
    # Existing endpoints
    path('get-listing/', views.get_listing, name='get_listing'),
    path('listings/', views.get_all_listings, name='get_all_listings'),
    path('check-listing/', views.check_listing_exists, name='check_listing_exists'),
    
    # 3-Step Process Endpoints
    path('step1-inventory-item/', views.step1_create_inventory_item, name='step1_inventory_item'),
    path('step2-create-offer/', views.step2_create_offer, name='step2_create_offer'),
    path('step3-publish-offer/', views.step3_publish_offer, name='step3_publish_offer'),
    path('create-listing/', views.create_listing, name='create_listing'),
    # Single endpoint for everything
    path('get-all-listings-with-availability/', views.get_all_listings_with_availability, name='get_all_listings_with_availability'),
    path('settings/', views.ebay_settings, name='ebay_settings'),
    path('listing-by-sku/<str:sku>/', views.get_listing_by_sku, name='get_listing_by_sku'),
    path('update-listing/', views.update_listing, name='update_listing'),
    path('trigger-auto-sync/', views.trigger_auto_sync, name='trigger_auto_sync'),
    path('auto-sync-status/', views.get_auto_sync_status, name='auto_sync_status'),
]