# inventory/serializers.py
from rest_framework import serializers
from .models import Category, Location, InventoryItem, StatusHistory
from client_management.models import Client

class CategorySerializer(serializers.ModelSerializer):
    """Serializer for Category model"""

    client_id = serializers.PrimaryKeyRelatedField(
        source='client',
        queryset=Client.objects.all()
    )
    
    class Meta:
        model = Category
        fields = '__all__'

class LocationSerializer(serializers.ModelSerializer):
    # accept PK for client on write
    client_id = serializers.PrimaryKeyRelatedField(
        source='client',
        queryset=Client.objects.all(),
        write_only=True
    )
    # return client PK on read (optional – you can rename to client_id if you prefer)
    client = serializers.PrimaryKeyRelatedField(read_only=True)

    # ensure parent can be set by id and is optional
    parent = serializers.PrimaryKeyRelatedField(
        queryset=Location.objects.all(),
        allow_null=True,
        required=False
    )

    class Meta:
        model = Location
        # enumerate fields explicitly; do NOT use '__all__'
        fields = (
            'id', 'name', 'type', 'capacity', 'parent',
            'client',      # read-only in responses
            'client_id',   # write-only in requests
            'created_at', 'updated_at',  # if your model has these
        )

class StatusHistorySerializer(serializers.ModelSerializer):
    """Serializer for StatusHistory model"""
    class Meta:
        model = StatusHistory
        fields = '__all__'

class InventoryItemListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views"""
    category_name = serializers.CharField(source='category.name', read_only=True)
    location_name = serializers.CharField(source='location.name', read_only=True)
    location_path = serializers.CharField(source='location.path', read_only=True)
    client_id = serializers.PrimaryKeyRelatedField(
        source='client',
        queryset=Client.objects.all()
    )
    class Meta:
        model = InventoryItem
        fields = [
            'id', 'name', 'category', 'category_name', 'status',
            'price', 'location', 'location_name', 'location_path', 'date_added',
            'updated_at', 'updated_by',
            'images', 'client_id', 'attributes', 'description'
        ]

class InventoryItemSerializer(serializers.ModelSerializer):
    """Full serializer for detail views"""
    status_history = StatusHistorySerializer(many=True, read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
    location_path = serializers.CharField(source='location.path', read_only=True)
    client_id = serializers.PrimaryKeyRelatedField(
        source='client',
        queryset=Client.objects.all()
    )
    
    class Meta:
        model = InventoryItem
        fields = [
            'id', 'name', 'description', 'category', 'status',
            'price', 'thumbnail', 'images', 'date_added',
            'location', 'notes', 'is_consigned', 'weight',
            'weight_unit', 'attributes', 'client_id', 'status_history',
            'updated_at', 'category_name', 'location_path', 'created_by', 'updated_by'
        ]
        read_only_fields = ['id', 'date_added', 'updated_at', 'created_by', 'updated_by']
        extra_kwargs = {"location": {"required": False}}


class ResendVerificationSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    password = serializers.CharField(required=False, allow_blank=True)
   
    def validate(self, data):
        # Password is optional if user has valid session
        return data