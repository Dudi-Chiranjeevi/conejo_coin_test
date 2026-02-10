import os, time
import json
from datetime import datetime, timezone
from django.db import connection
from django.conf import settings
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.views import APIView
from openai import OpenAI
from pgvector.django import CosineDistance
from dotenv import load_dotenv
from .serializers import (
    ChatRequest, QueryResult, SQLAsk, SQLResp,
    FAQSerializer, FAQCreateSerializer, FAQQuerySerializer
)
from .models import FAQSQLCache
from .sql_gen import get_sql_query
from .faq_manager import get_faq_sql, add_faq, get_all_faqs, delete_faq
from .embeddings import embed
from drf_spectacular.utils import extend_schema
import logging

logger = logging.getLogger(__name__)

load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

SYSTEM_PROMPT = (
    "You are a helpful inventory assistant. "
    "Answer briefly unless asked otherwise. If a question implies data/table/chart, "
    "state what fields would be needed and propose a SQL query shape."
)


@extend_schema(
    request=ChatRequest,
    responses={200: QueryResult},
    description="Chat with the inventory assistant"
)
@api_view(["POST"])
@permission_classes([AllowAny])
def chat(request):
    # Validate input
    req = ChatRequest(data=request.data)
    if not req.is_valid():
        return Response(req.errors, status=status.HTTP_400_BAD_REQUEST)

    query = req.validated_data["query"]
    history = req.validated_data.get("history", [])

    messages = [{"role": "system", "content": SYSTEM_PROMPT}, *history, {"role": "user", "content": query}]

    try:
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0.2,
        )
        reply = resp.choices[0].message.content

        # OPTIONAL: persist
        # convo = Conversation.objects.create(title=query[:80])
        # Message.objects.create(convo=convo, role="user", content=query)
        # Message.objects.create(convo=convo, role="assistant", content=reply)

        result = {
            "id": str(int(time.time() * 1000)),
            "query": query,
            "type": "summary",  # you can set "table"/"chart" later based on tool outputs
            "data": {"text": reply},
            "processingTime": "~1.0s",
            "confidence": "high",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        # Validate the shape React expects (optional)
        QueryResult(data=result).is_valid(raise_exception=True)

        return Response(result, status=200)
    except Exception as e:
        return Response({"detail": str(e)}, status=500)


# ---- Optional history handlers (simple, ephemeral demo) ----
# Swap these to DB-based endpoints if you enable models.

_FAKE_HISTORY = []  # [{query, answer, ts}]

@api_view(["GET"])
@permission_classes([AllowAny])
def history_list(request):
    return Response(_FAKE_HISTORY[-50:])

@api_view(["POST"])
@permission_classes([AllowAny])
def history_clear(request):
    _FAKE_HISTORY.clear()
    return Response({"ok": True})


@extend_schema(
    request=SQLAsk,
    responses={200: SQLResp},
    description="Generate SQL from a natural language question"
)
@api_view(["POST"])
@permission_classes([AllowAny])
def sql_from_question(request):
    ser = SQLAsk(data=request.data)
    ser.is_valid(raise_exception=True)

    try:
        try:
            # Use the FAQ-based approach instead of direct generation
            sql = get_faq_sql(
                ser.validated_data["question"],
                ser.validated_data.get("category", ""),
                ser.validated_data.get("force_refresh", False),
            )
            return Response({"sql": sql})
        except ValueError as exc:
            # Expected shape: (message, unsafe_sql?)
            detail = exc.args[0] if exc.args else "SQL generation error"
            unsafe_sql = exc.args[1] if len(exc.args) > 1 else None
            payload = {"error": detail}
            if unsafe_sql:
                payload["unsafe_sql"] = unsafe_sql
            return Response(payload, status=status.HTTP_400_BAD_REQUEST)
    except Exception as exc:
        logger.exception("Unhandled error in sql_from_question")
        return Response(
            {"error": "Internal server error", "detail": str(exc)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


# FAQ Management API Endpoints
class FAQListCreateView(APIView):
    """API endpoint for listing and creating FAQs"""
    permission_classes = [IsAuthenticated]
    
    @extend_schema(
        responses={200: FAQSerializer(many=True)},
        description="List all FAQs, optionally filtered by category"
    )
    def get(self, request):
        """List all FAQs, optionally filtered by category"""
        category = request.query_params.get('category', None)
        faqs = get_all_faqs(category)
        serializer = FAQSerializer(faqs, many=True)
        return Response(serializer.data)
    
    @extend_schema(
        request=FAQCreateSerializer,
        responses={201: FAQSerializer},
        description="Create a new FAQ with automatic embedding generation"
    )
    def post(self, request):
        """Create a new FAQ with automatic embedding generation"""
        serializer = FAQCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Extract validated data
        question = serializer.validated_data['question']
        sql = serializer.validated_data['sql']
        category = serializer.validated_data.get('category', '')
        
        # Generate embedding and create FAQ
        embedding = embed(question)
        
        # Create the FAQ in the database
        faq = FAQSQLCache.objects.create(
            question=question,
            sql=sql,
            embedding=embedding,
            category=category
        )
        
        # Return the created FAQ
        result_serializer = FAQSerializer(faq)
        return Response(result_serializer.data, status=status.HTTP_201_CREATED)


class FAQDetailView(APIView):
    """API endpoint for retrieving, updating, and deleting FAQs"""
    permission_classes = [IsAuthenticated]
    
    def get_object(self, pk):
        """Get a FAQ by ID or return 404"""
        try:
            return FAQSQLCache.objects.get(pk=pk)
        except FAQSQLCache.DoesNotExist:
            return Response({"detail": "FAQ not found"}, status=status.HTTP_404_NOT_FOUND)
    
    @extend_schema(
        responses={200: FAQSerializer},
        description="Retrieve a specific FAQ by ID"
    )
    def get(self, request, pk):
        """Retrieve a specific FAQ by ID"""
        faq = self.get_object(pk)
        if isinstance(faq, Response):
            return faq
        
        serializer = FAQSerializer(faq)
        return Response(serializer.data)
    
    @extend_schema(
        request=FAQSerializer,
        responses={200: FAQSerializer},
        description="Update a specific FAQ by ID"
    )
    def put(self, request, pk):
        """Update a specific FAQ by ID"""
        faq = self.get_object(pk)
        if isinstance(faq, Response):
            return faq
        
        serializer = FAQSerializer(faq, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        
        # If the question changed, update the embedding
        if 'question' in serializer.validated_data:
            serializer.validated_data['embedding'] = embed(serializer.validated_data['question'])
        
        serializer.save()
        return Response(serializer.data)
    
    @extend_schema(
        responses={204: None},
        description="Delete a specific FAQ by ID"
    )
    def delete(self, request, pk):
        """Delete a specific FAQ by ID"""
        faq = self.get_object(pk)
        if isinstance(faq, Response):
            return faq
        
        faq.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(
    request=FAQQuerySerializer,
    responses={200: FAQSerializer(many=True)},
    description="Query FAQs by semantic similarity"
)
@api_view(["POST"])
@permission_classes([AllowAny])
def query_faqs(request):
    """Query FAQs by semantic similarity"""
    serializer = FAQQuerySerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    
    query = serializer.validated_data["query"]
    category = serializer.validated_data.get("category", "")
    limit = serializer.validated_data.get("limit", 5)
    
    # Generate embedding for the query
    query_embedding = embed(query)
    
    # Find similar FAQs
    queryset = FAQSQLCache.objects
    if category:
        queryset = queryset.filter(category=category)
    
    similar_faqs = (
        queryset
        .annotate(distance=CosineDistance("embedding", query_embedding))
        .order_by("distance")[:limit]
    )
    
    result_serializer = FAQSerializer(similar_faqs, many=True)
    return Response(result_serializer.data)


@extend_schema(
    request={"type": "object", "properties": {"sql": {"type": "string"}}},
    responses={200: {"type": "object"}},
    description="Execute a SQL query and return the results"
)
@api_view(["POST"])
@permission_classes([AllowAny])  # Allow anonymous access for testing
def execute_sql(request):
    """Execute a SQL query and return the results"""
    # Get the SQL query from the request
    sql = request.data.get("sql")
    if not sql:
        return Response({"error": "SQL query is required"}, status=status.HTTP_400_BAD_REQUEST)
    
    # Validate and sanitize the SQL query
    sql = sql.strip()
    
    # Only allow read-only queries (SELECT or CTEs that lead to SELECT)
    sql_l = sql.lower()
    if sql_l.startswith("with"):
        if " select" not in sql_l:
            return Response({"error": "Only SELECT queries are allowed"}, status=status.HTTP_400_BAD_REQUEST)
    elif not sql_l.startswith("select"):
        return Response({"error": "Only SELECT queries are allowed"}, status=status.HTTP_400_BAD_REQUEST)

    # Prevent destructive queries
    forbidden_keywords = [" drop ", " delete ", " truncate ", " update ", " insert ", " alter ", " create "]
    if any(keyword in f" {sql_l} " for keyword in forbidden_keywords):
        return Response({"error": "Query contains forbidden keywords"}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        # Execute the query
        with connection.cursor() as cursor:
            logger.info(f"Executing SQL: {sql}")
            cursor.execute(sql)
            
            # Get column names
            columns = [col[0] for col in cursor.description]
            
            # Fetch all rows
            rows = cursor.fetchall()
            
            # Convert rows to list of lists for JSON serialization
            data = []
            for row in rows:
                # Convert any non-JSON serializable types
                processed_row = []
                for item in row:
                    if isinstance(item, (datetime, timezone)):
                        processed_row.append(item.isoformat())
                    elif hasattr(item, "__str__"):
                        processed_row.append(str(item))
                    else:
                        processed_row.append(item)
                data.append(processed_row)
            
            # Determine if this should be a table or chart result
            result_type = "table"
            
            # For aggregation queries that might be better as charts
            if len(columns) == 2 and len(rows) <= 10:
                # Check if second column is numeric (potential chart candidate)
                all_numeric = all(isinstance(row[1], (int, float)) for row in rows)
                if all_numeric:
                    result_type = "chart"
            
            # Get summary statistics for the query results
            summary = {}
            
            # Try to extract common summary statistics based on column names
            for i, col in enumerate(columns):
                col_lower = col.lower()
                if "count" in col_lower or "total" in col_lower:
                    if len(rows) > 0:
                        summary["totalItems"] = sum(row[i] for row in rows if isinstance(row[i], (int, float)))
                
                if "value" in col_lower or "price" in col_lower or "amount" in col_lower:
                    if len(rows) > 0:
                        summary["totalValue"] = sum(row[i] for row in rows if isinstance(row[i], (int, float)))
                
                if "category" in col_lower:
                    summary["categories"] = len(set(row[i] for row in rows if row[i]))
                
                if "location" in col_lower:
                    summary["locations"] = len(set(row[i] for row in rows if row[i]))
            
            # Create the response based on result type
            if result_type == "table":
                return Response({
                    "columns": columns,
                    "data": data,
                    "totalRows": len(rows),
                    "summary": summary
                })
            else:  # Chart
                # For chart data, format as labels and datasets
                return Response({
                    "labels": [str(row[0]) for row in rows],
                    "datasets": [{
                        "label": columns[1],
                        "data": [row[1] for row in rows]
                    }],
                    "summary": summary
                })
                
    except Exception as e:
        logger.error(f"Error executing SQL: {str(e)}")
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
