# ebay_integration/models.py
from django.db import models

class EbayItemStatus(models.TextChoices):
    ACTIVE = 'ACTIVE', 'Active'
    ENDED = 'ENDED', 'Ended'
    COMPLETED = 'COMPLETED', 'Completed'
    CANCELLED = 'CANCELLED', 'Cancelled'
    UNKNOWN = 'UNKNOWN', 'Unknown'

class EbayItem(models.Model):
    # Basic Listing Information
    item_id = models.CharField(max_length=100, unique=True)
    title = models.TextField()
    
    # Status
    status = models.CharField(
        max_length=20, 
        choices=EbayItemStatus.choices, 
        default=EbayItemStatus.UNKNOWN
    )
    
    # Pricing
    current_price = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=10, default='USD')
    
    # Listing Details
    listing_type = models.CharField(max_length=100, null=True, blank=True)
    condition = models.CharField(max_length=200, null=True, blank=True)
    
    # Seller
    seller_username = models.CharField(max_length=500, null=True, blank=True)
    
    # URLs
    view_item_url = models.URLField(max_length=1000, null=True, blank=True)
    image_url = models.URLField(max_length=1000, null=True, blank=True)
    
    # Dates
    start_time = models.DateTimeField(null=True, blank=True)
    end_time = models.DateTimeField(null=True, blank=True)
    
    # Availability Information (NEW FIELDS)
    estimated_availability_status = models.CharField(max_length=50, null=True, blank=True)
    estimated_available_quantity = models.IntegerField(null=True, blank=True)
    estimated_sold_quantity = models.IntegerField(null=True, blank=True)
    estimated_remaining_quantity = models.IntegerField(null=True, blank=True)
    
    # Additional fields
    buying_options = models.JSONField(null=True, blank=True)
    shipping_options = models.JSONField(null=True, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.item_id} - {self.title}"
    
    class Meta:
        db_table = 'ebay_items'
        verbose_name = 'eBay Item'
        verbose_name_plural = 'eBay Items'



class EbaySettings(models.Model):
    # Dashboard refresh settings
    dashboard_refresh_enabled = models.BooleanField(default=True)
    dashboard_refresh_interval = models.IntegerField(default=30)  # seconds
    
    # Sync settings  
    auto_sync_enabled = models.BooleanField(default=True)
    sync_interval = models.IntegerField(default=15)  # minutes
    
    # NEW: Track when auto sync last ran
    last_sync_run = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'ebay_settings'
        verbose_name = 'eBay Setting'
        verbose_name_plural = 'eBay Settings'

    def __str__(self):
        return f"eBay Settings (ID: {self.id})"