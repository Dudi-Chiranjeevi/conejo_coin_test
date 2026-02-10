import uuid
from django.db import models
from django.contrib.auth.models import User
from django.contrib.postgres.indexes import GinIndex
from django.core.validators import MinValueValidator
from decimal import Decimal
from django.core.exceptions import ValidationError
from django.db.models import Q
import client_management 

# class Client(models.Model):
#     id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
#     name = models.CharField(max_length=200)
#     contact_email = models.EmailField(blank=True)
#     created_at = models.DateTimeField(auto_now_add=True)
#     updated_at = models.DateTimeField(auto_now=True)

#     def __str__(self):
#         return self.name

class Category(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True)
    custom_fields = models.JSONField(default=dict, blank=True)
    #client = models.ForeignKey(Client, on_delete=models.CASCADE)
    client = models.ForeignKey('client_management.Client', on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            GinIndex(fields=["custom_fields"]),
        ]
        unique_together = ('name', 'client')

    def __str__(self):
        return self.name

    def clean(self):
        if self.parent and self.parent.client != self.client:
            raise ValidationError("Parent category must belong to the same client")


class Location(models.Model):
    LOCATION_TYPES = [
        ('site', 'Site'),
        ('room', 'Room'),
        ('shelf', 'Shelf'),
        ('box', 'Box'),
        ('row', 'Row'),
        ('slot', 'Slot'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    type = models.CharField(max_length=20, choices=LOCATION_TYPES)
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='children')
    #client = models.ForeignKey('Client', on_delete=models.CASCADE)
    client = models.ForeignKey('client_management.Client', on_delete=models.CASCADE)
    # Optional capacity per location (mainly used for box/row/slot)
    capacity = models.PositiveIntegerField(null=True, blank=True)

    # Computed/stored breadcrumb path (e.g. Site A > Room 1 > Shelf A > Box 2 > Row 1)
    path = models.TextField(blank=True, editable=False)

    created_at = models.DateTimeField(auto_now_add=True)
    # date_added = models.DateField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('name', 'parent', 'client')

    def __str__(self):
        return self.name

    def clean(self):
        # Enforce that parent belongs to the same client
        if self.parent and self.parent.client != self.client:
            raise ValidationError("Parent location must belong to the same client")

    def save(self, *args, **kwargs):
        # Update path before saving
        self.path = self.generate_path()
        super().save(*args, **kwargs)

    def generate_path(self):
        """Build full breadcrumb path like 'Site A > Room 1 > Box B'"""
        if not self.parent:
            return self.name
        return f"{self.parent.generate_path()} > {self.name}"


class InventoryItem(models.Model):
    # --- Constants / choices ---
    STATUS_CHOICES = [
        ('in_store', 'In Store'),
        ('in_transit', 'In Transit'),
        ('consigned', 'Consigned'),
        ('sold', 'Sold'),
        ('ebay', 'eBay'),
    ]
    WEIGHT_UNITS = [
        ('g', 'Grams'),
        ('oz', 'Ounces'),
    ]

    # --- Identity & ownership ---
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    #client = models.ForeignKey('Client', on_delete=models.CASCADE)
    client = models.ForeignKey('client_management.Client', on_delete=models.CASCADE)
    created_by = models.CharField(max_length=128, null=True, blank=True)
    updated_by = models.CharField(max_length=128, null=True, blank=True)
    is_listed = models.BooleanField(default=False, db_index=True)  # ✅ ADD THIS LINE
    # --- Presentation / commerce ---
    name = models.CharField(max_length=300)
    description = models.TextField(blank=True)
    category = models.ForeignKey('Category', on_delete=models.PROTECT)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='in_store')
    price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        # validators=[MinValueValidator(Decimal('0.01'))]
    )

    # A quick “primary” image for cards/lists.
    thumbnail = models.URLField(blank=True)

    # All images from all sources (NGC originals, your GCS copies, etc.)
    # Shape: [
    #   {
    #     "source": "ngc" | "gcs",
    #     "front_url": "...",
    #     "rear_url": "...",
    #     "front_thumbnail_url": "...",
    #     "rear_thumbnail_url": "...",
    #     "meta": { "width": 1200, "height": 1200 }  # optional
    #   },
    #   ...
    # ]
    images = models.JSONField(default=list, blank=True)

    # Dates / audit
    # created_at = models.DateTimeField(auto_now_add=True)
    date_added = models.DateField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Stock placement & notes
    location = models.ForeignKey('Location', on_delete=models.SET_NULL, null=True, blank=True)
    notes = models.TextField(blank=True)
    is_consigned = models.BooleanField(default=False)

    # Physical attributes (generic; coin/stamp/bullion specifics go in JSON)
    weight = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)
    weight_unit = models.CharField(max_length=2, choices=WEIGHT_UNITS, null=True, blank=True)

    # Attributes holds category-specific data.
    # For coins:
    # {
    #   "coin": {
    #     "cert_number": "1234567-001",
    #     "country": "USA",
    #     "year": 1909,
    #     "mint_mark": "S",
    #     "denomination": "1C",
    #     "variety": "VDB",
    #     "grade": {
    #       "service": "NGC",
    #       "label": "MS",
    #       "numeric": 65,
    #       "suffix": "RD",
    #       "details": null
    #     },
    #     "ngc": {
    #       "lookup_url": "https://www.ngccoin.com/certlookup/1234567-001/",
    #       "raw": { ... }  # full unmodified provider payload
    #     }
    #   },
    #   "stamp": { ... },     # future
    #   "bullion": { ... }    # future
    # }
    attributes = models.JSONField(default=dict, blank=True)

    # Convenience fields for speed & uniqueness (derived from attributes.coin.cert_number)
    identification_number = models.CharField(max_length=32, blank=True, db_index=True)
    lookup_url = models.URLField(blank=True)

    class Meta:
        indexes = [
            GinIndex(fields=['attributes']),
            models.Index(fields=['status', 'client']),
            models.Index(fields=['category', 'client']),
            models.Index(fields=['identification_number', 'client']),
        ]
        constraints = [
            # Prevent the same cert appearing twice for one client (ignore blanks)
            models.UniqueConstraint(
                fields=['client', 'identification_number'],
                condition=~Q(identification_number=""),
                name='uniq_client_identification_number_per_client',
            ),
        ]

    def __str__(self):
        return self.name

    # --- Validations & consistency guards ---
    def clean(self):
        # Category and Location must belong to same client
        if self.category and getattr(self.category, "client_id", None) != self.client_id:
            raise ValidationError("Category must belong to the same client.")
        if self.location and getattr(self.location, "client_id", None) != self.client_id:
            raise ValidationError("Location must belong to the same client.")

        # If weight provided, unit must be set
        if self.weight and not self.weight_unit:
            raise ValidationError("Weight unit is required when weight is specified.")

        # Validate images shape (keys present; values may be null if truly unavailable)
        if self.images:
            if not isinstance(self.images, list):
                raise ValidationError("images must be a list of objects.")
            required_img_keys = {
                "source",
                "front_url",
                "rear_url",
                "front_thumbnail_url",
                "rear_thumbnail_url",
            }
            for i, block in enumerate(self.images):
                if not isinstance(block, dict):
                    raise ValidationError(f"images[{i}] must be an object.")
                missing = required_img_keys - set(block.keys())
                if missing:
                    raise ValidationError(
                        f"images[{i}] missing keys: {', '.join(sorted(missing))}. "
                        "Include the keys even if the value is null."
                    )

        coin = (self.attributes or {}).get("coin") if self.attributes else None
        if coin:
            # sync identification_number
            identification_number = (coin.get("identification_number") or "").strip()
            if identification_number and not self.identification_number:
                self.identification_number = identification_number

            # sync lookup_url
            ngc = coin.get("ngc") or {}
            lookup = (ngc.get("lookup_url") or "").strip()
            if lookup and not self.lookup_url:
                self.lookup_url = lookup
    
        # Validate weight unit is provided if weight is provided
        if self.weight and not self.weight_unit:
            raise ValidationError("Weight unit is required when weight is specified")


class StatusHistory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    item = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name='status_history')
    old_status = models.CharField(max_length=20, choices=InventoryItem.STATUS_CHOICES)
    new_status = models.CharField(max_length=20, choices=InventoryItem.STATUS_CHOICES)
    timestamp = models.DateTimeField(auto_now_add=True)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-timestamp']
        verbose_name_plural = "Status histories"

    def __str__(self):
        return f"{self.item.name}: {self.old_status} → {self.new_status}"

