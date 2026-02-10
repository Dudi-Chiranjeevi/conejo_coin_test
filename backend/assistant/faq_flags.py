from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status

from .models import FAQSQLCache


@api_view(["POST"])
@permission_classes([AllowAny])  # adjust to IsAuthenticated if needed
def update_faq_flags(request):
    """Update usebar/usepie flags for an FAQ identified by its unique question."""
    data = request.data or {}
    question = (data.get("question") or "").strip()
    if not question:
        return Response({"error": "question is required"}, status=status.HTTP_400_BAD_REQUEST)

    usebar = bool(data.get("usebar", False))
    usepie = bool(data.get("usepie", False))

    try:
        faq = FAQSQLCache.objects.get(question=question)
    except FAQSQLCache.DoesNotExist:
        return Response({"error": "FAQ not found for given question"}, status=status.HTTP_404_NOT_FOUND)

    changed = False
    if getattr(faq, "usebar", None) is not None and faq.usebar != usebar:
        faq.usebar = usebar
        changed = True
    if getattr(faq, "usepie", None) is not None and faq.usepie != usepie:
        faq.usepie = usepie
        changed = True

    if changed:
        faq.save(update_fields=["usebar", "usepie"])

    return Response({"ok": True, "usebar": faq.usebar, "usepie": faq.usepie})
