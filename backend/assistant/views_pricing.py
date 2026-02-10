from typing import List, Dict, Any

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from drf_spectacular.utils import extend_schema

from .price_estimator import get_price_estimate


@extend_schema(
    request={
        "type": "object",
        "properties": {
            "cert_number": {"type": "string"},
            "description": {"type": "string"},
            "grade": {"type": "string"},
            "history": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "role": {"type": "string"},
                        "content": {"type": "string"},
                    },
                },
            },
        },
        "required": ["cert_number", "description", "grade"],
    },
    responses={200: {"type": "object", "properties": {"text": {"type": "string"}}}},
    description="Get an estimated selling price for a certified coin using expert numismatist prompt",
)
@api_view(["POST"])
@permission_classes([AllowAny])
def price_estimate(request):
    data = request.data or {}
    cert_number = (data.get("cert_number") or "").strip()
    description = (data.get("description") or "").strip()
    grade = (data.get("grade") or "").strip()
    history: List[Dict[str, Any]] = data.get("history") or []

    if not cert_number or not description or not grade:
        return Response(
            {"error": "cert_number, description, and grade are required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        text = get_price_estimate(cert_number, description, grade, history=history)
        return Response({"text": text})
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
