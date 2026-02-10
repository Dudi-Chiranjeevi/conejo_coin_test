import uuid
from django.db import models
from django.contrib.auth.models import User
from django.contrib.postgres.indexes import GinIndex
from django.core.validators import MinValueValidator
from decimal import Decimal
from django.core.exceptions import ValidationError  
from django.utils import timezone 

class Barcode(models.Model):
    value = models.CharField(max_length=255)
    format = models.CharField(max_length=50)
    timestamp = models.DateTimeField(default=timezone.now)
    additional_info = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"{self.value} ({self.format})"

class Coin(models.Model):
    # Basic identification
    cert_number = models.CharField(max_length=100, unique=True)
    barcode = models.CharField(max_length=255, unique=True, null=True, blank=True)
    
    # Grade information (replacing old grade fields)
    display_grade = models.CharField(max_length=100, blank=True, null=True)
    grade_type = models.CharField(max_length=100, blank=True, null=True)
    
    # Metadata (replacing old date fields)
    encapsulation_date = models.DateField(null=True, blank=True)
    graded_date = models.DateField(null=True, blank=True)
    submission_number = models.CharField(max_length=100, blank=True, null=True)
    
    # Additional info (new fields)
    grader_notes = models.JSONField(default=list, blank=True, null=True)
    pedigree = models.CharField(max_length=255, blank=True, null=True)
    pedigree2 = models.CharField(max_length=255, blank=True, null=True)
    grade_comment = models.TextField(blank=True, null=True)
    
    # Collectible information (replacing old coin_type, description, etc.)
    collectible_id = models.CharField(max_length=100, blank=True, null=True)
    # description field removed as requested
    rollup_number = models.CharField(max_length=100, blank=True, null=True)
    denomination = models.CharField(max_length=100, blank=True, null=True)
    year = models.CharField(max_length=10, blank=True, null=True)
    proof_mint = models.CharField(max_length=100, blank=True, null=True)
    mint_mark = models.CharField(max_length=10, blank=True, null=True)
    strike = models.CharField(max_length=100, blank=True, null=True)  # Replaces grade_modifier
    variety1 = models.CharField(max_length=500, blank=True, null=True)  # Replaces coin_type
    variety2 = models.CharField(max_length=100, blank=True, null=True)
    variety3 = models.CharField(max_length=100, blank=True, null=True)
    universal_coin_id = models.CharField(max_length=100, blank=True, null=True)
    fineness = models.CharField(max_length=50, blank=True, null=True)
    metal_type = models.CharField(max_length=50, blank=True, null=True)
    weight_grams = models.FloatField(null=True, blank=True)
    weight_ounces = models.FloatField(null=True, blank=True)
    
    # Images (updating old image fields)
    front_url = models.URLField(max_length=500, blank=True, null=True)  # Replaces front_image_url
    front_thumbnail_url = models.URLField(max_length=500, blank=True, null=True)
    rear_url = models.URLField(max_length=500, blank=True, null=True)  # Replaces back_image_url
    rear_thumbnail_url = models.URLField(max_length=500, blank=True, null=True)
    
    # Holder type (keeping from old model)
    holder_type = models.CharField(max_length=100, blank=True, null=True)
    
    # Timestamps
    fetched_at = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.cert_number

    class Meta:
        ordering = ['-fetched_at']


