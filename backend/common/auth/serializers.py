from rest_framework import serializers

class UserProfileSerializer(serializers.Serializer):
    firstname = serializers.CharField(required=False, allow_blank=True)
    lastname = serializers.CharField(required=False, allow_blank=True)
    email = serializers.EmailField(required=False)
    phone = serializers.CharField(required=False, allow_blank=True)
    bio = serializers.CharField(required=False, allow_blank=True)
    role = serializers.CharField(required=False, allow_blank=True)
    
# class EmergencyContactSerializer(serializers.Serializer):
#     name = serializers.CharField(required=False, allow_blank=True)
#     phone = serializers.CharField(required=False, allow_blank=True)
#     relationship = serializers.CharField(required=False, allow_blank=True)
