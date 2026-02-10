from rest_framework import serializers
from .models import FAQSQLCache

class MessageIn(serializers.Serializer):
    role = serializers.ChoiceField(choices=["user", "assistant", "system"])
    content = serializers.CharField()

class ChatRequest(serializers.Serializer):
    query = serializers.CharField()
    history = MessageIn(many=True, required=False)

class QueryResult(serializers.Serializer):
    id = serializers.CharField()
    query = serializers.CharField()
    type = serializers.ChoiceField(choices=["summary","table","chart"])
    data = serializers.JSONField()
    processingTime = serializers.CharField()
    confidence = serializers.ChoiceField(choices=["low","medium","high"])
    timestamp = serializers.DateTimeField()

class SQLAsk(serializers.Serializer):
    question = serializers.CharField()
    category = serializers.CharField(required=False, allow_blank=True)
    force_refresh = serializers.BooleanField(required=False, default=False)

class SQLResp(serializers.Serializer):
    sql = serializers.CharField()

# FAQ Management Serializers
class FAQSerializer(serializers.ModelSerializer):
    """Serializer for FAQ items"""
    class Meta:
        model = FAQSQLCache
        fields = ['id', 'question', 'sql', 'category', 'created_at']
        read_only_fields = ['id', 'created_at']

class FAQCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating FAQ items"""
    class Meta:
        model = FAQSQLCache
        fields = ['question', 'sql', 'category']
    
    def create(self, validated_data):
        # We'll handle embedding generation in the view
        return validated_data

class FAQQuerySerializer(serializers.Serializer):
    """Serializer for querying FAQs by similarity"""
    query = serializers.CharField()
    category = serializers.CharField(required=False, allow_blank=True)
    limit = serializers.IntegerField(required=False, default=5, min_value=1, max_value=20)