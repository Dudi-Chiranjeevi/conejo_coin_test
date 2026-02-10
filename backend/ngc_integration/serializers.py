from rest_framework import serializers
from .models import Barcode
from inventory.models import InventoryItem
from .ngc_normalizer import normalize_ngc_for_inventory

class BarcodeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Barcode
        fields = ['id', 'value', 'format', 'timestamp', 'additional_info']
        read_only_fields = ['id', 'timestamp']


# class CoinSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = Coin
#         fields = '__all__'
#         extra_kwargs = {
#             'cert_number': {'allow_blank': False, 'required': True},
#             'barcode': {'allow_blank': True, 'required': False},
#             'display_grade': {'allow_blank': True, 'required': False},
#             'grade_type': {'allow_blank': True, 'required': False},
#             'encapsulation_date': {'allow_null': True, 'required': False},
#             'graded_date': {'allow_null': True, 'required': False},
#             'submission_number': {'allow_blank': True, 'required': False},
#             'grader_notes': {'allow_null': True, 'required': False},
#             'pedigree': {'allow_blank': True, 'required': False},
#             'pedigree2': {'allow_blank': True, 'required': False},
#             'grade_comment': {'allow_blank': True, 'required': False},
#             'collectible_id': {'allow_blank': True, 'required': False},
#             'rollup_number': {'allow_blank': True, 'required': False},
#             'denomination': {'allow_blank': True, 'required': False},
#             'year': {'allow_blank': True, 'required': False},
#             'proof_mint': {'allow_blank': True, 'required': False},
#             'mint_mark': {'allow_blank': True, 'required': False},
#             'strike': {'allow_blank': True, 'required': False},
#             'variety1': {'allow_blank': True, 'required': False},
#             'variety2': {'allow_blank': True, 'required': False},
#             'variety3': {'allow_blank': True, 'required': False},
#             'universal_coin_id': {'allow_blank': True, 'required': False},
#             'fineness': {'allow_blank': True, 'required': False},
#             'metal_type': {'allow_blank': True, 'required': False},
#             'weight_grams': {'allow_null': True, 'required': False},
#             'weight_ounces': {'allow_null': True, 'required': False},
#             'front_url': {'allow_blank': True, 'required': False},
#             'front_thumbnail_url': {'allow_blank': True, 'required': False},
#             'rear_url': {'allow_blank': True, 'required': False},
#             'rear_thumbnail_url': {'allow_blank': True, 'required': False},
#         }

class InventoryFromNGCSerializer(serializers.Serializer):
    client_id = serializers.UUIDField()
    category_id = serializers.UUIDField()
    status = serializers.ChoiceField(choices=[c[0] for c in InventoryItem.STATUS_CHOICES], default="in_store")
    price = serializers.DecimalField(max_digits=12, decimal_places=2, default="0.00")
    location_id = serializers.UUIDField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True, default="")
    description = serializers.CharField(required=False, allow_blank=True, default="")
    name = serializers.CharField(required=False, allow_blank=True)
    ngc_data = serializers.JSONField()

    def create(self, validated_data):
        # Lazy imports to avoid circular imports
        from client_management.models import Client
        from inventory.models import Category, Location
        import traceback
        
        print("InventoryFromNGCSerializer.create() called with validated_data:", validated_data)
        
        # Get client
        try:
            client = Client.objects.get(id=validated_data["client_id"])
            print(f"Found client: {client.id}")
        except Client.DoesNotExist:
            print(f"Client with ID {validated_data['client_id']} does not exist")
            raise
        except Exception as e:
            print(f"Error getting client: {str(e)}")
            raise
        
        # Get category
        try:
            category = Category.objects.get(id=validated_data["category_id"])
            print(f"Found category: {category.id}")
        except Category.DoesNotExist:
            print(f"Category with ID {validated_data['category_id']} does not exist")
            raise
        except Exception as e:
            print(f"Error getting category: {str(e)}")
            raise
        
        # Get location if provided
        location = None
        if validated_data.get("location_id"):
            try:
                location = Location.objects.get(id=validated_data["location_id"])
                print(f"Found location: {location.id}")
            except Location.DoesNotExist:
                print(f"Location with ID {validated_data['location_id']} does not exist")
                raise
            except Exception as e:
                print(f"Error getting location: {str(e)}")
                raise
        
        # Normalize NGC data
        try:
            normalized = normalize_ngc_for_inventory(validated_data["ngc_data"])
            print("Normalized NGC data:", normalized)
        except Exception as e:
            print(f"Error normalizing NGC data: {str(e)}")
            traceback.print_exc()
            raise

        # Create inventory item
        try:
            # Use name and description from validated_data if provided, otherwise use normalized data
            name = validated_data.get("name") or normalized["name"]
            description = validated_data.get("description", "")
            
            print(f"Using name: {name}, description: {description}")
            
            item = InventoryItem(
                client=client,
                category=category,
                status=validated_data["status"],
                price=validated_data["price"],
                name=name,
                thumbnail=normalized["thumbnail"],
                images=normalized["images"],
                attributes=normalized["attributes"],
                identification_number=normalized["identification_number"] or "",
                lookup_url=normalized["lookup_url"] or "",
                location=location,
                notes=validated_data.get("notes", ""),
                description=description,
            )
            print("InventoryItem object created, about to call full_clean()")
            item.full_clean()
            print("full_clean() passed, about to save item")
            item.save()
            print(f"Item saved successfully with ID: {item.id}")
            return item
        except Exception as e:
            print(f"Error creating/saving inventory item: {str(e)}")
            traceback.print_exc()
            raise

    def to_representation(self, instance: InventoryItem):
        return {
            "id": str(instance.id),
            "name": instance.name,
            "identification_number": instance.identification_number,
            "lookup_url": instance.lookup_url,
            "thumbnail": instance.thumbnail,
            "status": instance.status,
            "price": str(instance.price),
            "category": str(instance.category_id),
            "client": str(instance.client_id),
        }