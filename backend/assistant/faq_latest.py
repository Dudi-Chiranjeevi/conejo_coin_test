from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import FAQSQLCache


@api_view(["GET"])
@permission_classes([AllowAny])
def latest_faqs(request):
    """Return the latest 10 FAQs (minimal fields) sorted by recency."""
    qs = FAQSQLCache.objects.order_by("-created_at")[:10]
    data = [
        {
            "id": f.id,
            "question": f.question,
            "category": f.category,
            "usepie": getattr(f, "usepie", False),
            "usebar": getattr(f, "usebar", False),
            "created_at": f.created_at.isoformat() if getattr(f, "created_at", None) else None,
        }
        for f in qs
    ]
    return Response(data)
