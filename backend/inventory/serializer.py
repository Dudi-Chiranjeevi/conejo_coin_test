# from rest_framework import serializers
# from decimal import Decimal
# from .models import Category, Location, InventoryItem, StatusHistory


# class CategorySerializer(serializers.ModelSerializer):
#     parent_name = serializers.CharField(source='parent.name', read_only=True)
#     children = serializers.SerializerMethodField()

#     class Meta:
#         model = Category
#         fields = [
#             'id', 'name', 'parent', 'parent_name', 'children', 
#             'custom_fields', 'client_id', 'created_at', 'updated_at'
#         ]
#         read_only_fields = ['id', 'created_at', 'updated_at']

#     def get_children(self, obj):
#         children = Category.objects.filter(parent=obj)
#         return CategorySerializer(children, many=True).data

#     def validate_custom_fields(self, value):
#         """Validate custom fields structure"""
#         if not isinstance(value, dict):
#             raise serializers.ValidationError("Custom fields must be a dictionary")
        
#         # Validate field definitions
#         for field_name, field_config in value.items():
#             if not isinstance(field_config, dict):
#                 raise serializers.ValidationError(f"Field configuration for '{field_name}' must be a dictionary")
            
#             required_keys = ['type', 'label']
#             if not all(key in field_config for key in required_keys):
#                 raise serializers.ValidationError(f"Field '{field_name}' must have 'type' and 'label' keys")
        
#         return value


# class LocationSerializer(serializers.ModelSerializer):
#     parent_name = serializers.CharField(source='parent.name', read_only=True)
#     full_path = serializers.SerializerMethodField()
#     children = serializers.SerializerMethodField()

#     class Meta:
#         model = Location
#         fields = [
#             'id', 'name', 'type', 'parent', 'parent_name', 'full_path', 
#             'children', 'client_id', 'created_at', 'updated_at'
#         ]
#         read_only_fields = ['id', 'created_at', 'updated_at']

#     def get_full_path(self, obj):
#         """Build hierarchical path like 'Building 1 > Room A > Shelf 1'"""
#         path = []
#         current = obj
#         while current:
#             path.insert(0, current.name)
#             current = current.parent
#         return ' > '.join(path)

#     def get_children(self, obj):
#         children = Location.objects.filter(parent=obj)
#         return LocationSerializer(children, many=True).data


# class StatusHistorySerializer(serializers.ModelSerializer):
#     user_username = serializers.CharField(source='user.username', read_only=True)

#     class Meta:
#         model = StatusHistory
#         fields = [
#             'id', 'item', 'old_status', 'new_status', 
#             'timestamp', 'user', 'user_username', 'notes'
#         ]
#         read_only_fields = ['id', 'timestamp']


# class InventoryItemSerializer(serializers.ModelSerializer):
#     category_name = serializers.CharField(source='category.name', read_only=True)
#     location_name = serializers.CharField(source='location.name', read_only=True)
#     location_full_path = serializers.CharField(source='location.full_path', read_only=True)
#     status_history = StatusHistorySerializer(many=True, read_only=True)

#     class Meta:
#         model = InventoryItem
#         fields = [
#             'id', 'name', 'description', 'category', 'category_name',
#             'status', 'price', 'thumbnail', 'images', 'date_added',
#             'location', 'location_name', 'location_full_path', 'notes',
#             'is_consigned', 'weight', 'weight_unit', 'attributes',
#             'client_id', 'status_history', 'created_at', 'updated_at'
#         ]
#         read_only_fields = ['id', 'date_added', 'created_at', 'updated_at']

#     def validate_price(self, value):
#         """Validate price is positive"""
#         if value <= Decimal('0'):
#             raise serializers.ValidationError("Price must be positive.")
#         return value

#     def validate_images(self, value):
#         """Validate images is a list of URLs"""
#         if not isinstance(value, list):
#             raise serializers.ValidationError("Images must be a list.")
        
#         for url in value:
#             if not isinstance(url, str):
#                 raise serializers.ValidationError("Each image must be a URL string.")
        
#         return value

#     def validate_attributes(self, value):
#         """Validate attributes based on category requirements"""
#         if not isinstance(value, dict):
#             raise serializers.ValidationError("Attributes must be a dictionary.")
        
#         # Get category from validated data or instance
#         category = None
#         if hasattr(self, 'initial_data'):
#             category_id = self.initial_data.get('category')
#             if category_id:
#                 try:
#                     category = Category.objects.get(id=category_id)
#                 except Category.DoesNotExist:
#                     pass
        
#         if not category and self.instance:
#             category = self.instance.category

#         # Apply category-specific validations
#         if category:
#             self._validate_category_attributes(value, category)
        
#         return value

#     def _validate_category_attributes(self, attrs, category):
#         """Apply category-specific validation rules"""
#         category_name = category.name.lower()
        
#         # Example validations for coins
#         if category_name == "coins":
#             required_fields = ['cert_number', 'grade', 'year']
#             for field in required_fields:
#                 if field not in attrs:
#                     raise serializers.ValidationError(f"'{field}' is required for coins.")
            
#             # Validate grade format
#             if 'grade' in attrs:
#                 valid_grades = ['PR70', 'PR69', 'PR68', 'MS70', 'MS69', 'MS68', 'MS67', 'MS66', 'MS65']
#                 if attrs['grade'] not in valid_grades:
#                     raise serializers.ValidationError(f"Invalid grade. Must be one of: {', '.join(valid_grades)}")
        
#         # Example validations for stamps
#         elif category_name == "stamps":
#             if 'condition' in attrs:
#                 valid_conditions = ['mint', 'used', 'damaged']
#                 if attrs['condition'] not in valid_conditions:
#                     raise serializers.ValidationError(f"Invalid condition. Must be one of: {', '.join(valid_conditions)}")

#     def validate(self, data):
#         """Cross-field validation"""
#         # Validate weight and weight_unit relationship
#         weight = data.get('weight')
#         weight_unit = data.get('weight_unit')
        
#         if weight and not weight_unit:
#             raise serializers.ValidationError("Weight unit is required when weight is specified.")
        
#         if weight_unit and not weight:
#             raise serializers.ValidationError("Weight is required when weight unit is specified.")
        
#         return data

#     def create(self, validated_data):
#         """Create item and record initial status"""
#         item = super().create(validated_data)
        
#         # Create initial status history entry
#         StatusHistory.objects.create(
#             item=item,
#             old_status='',  # No previous status
#             new_status=item.status,
#             user=self.context['request'].user if 'request' in self.context else None,
#             notes='Item created'
#         )
        
#         return item

#     def update(self, instance, validated_data):
#         """Update item and track status changes"""
#         old_status = instance.status
#         item = super().update(instance, validated_data)
        
#         # Record status change if status changed
#         if old_status != item.status:
#             StatusHistory.objects.create(
#                 item=item,
#                 old_status=old_status,
#                 new_status=item.status,
#                 user=self.context['request'].user if 'request' in self.context else None,
#                 notes=f'Status changed from {old_status} to {item.status}'
#             )
        
#         return item


# class InventoryItemListSerializer(serializers.ModelSerializer):
#     """Lightweight serializer for list views"""
#     category_name = serializers.CharField(source='category.name', read_only=True)
#     location_name = serializers.CharField(source='location.name', read_only=True)

#     class Meta:
#         model = InventoryItem
#         fields = [
#             "id", "name", "status", "price", "date_added",
#             "category", "category_name",
#             "location", "location_name", "location_path",
#             "attributes", "images",
#             "description",           # ← ADD THIS
#         ]