from django.urls import path
from .views import (
    chat, history_list, history_clear, sql_from_question,
    FAQListCreateView, FAQDetailView, query_faqs, execute_sql
)
from .faq_latest import latest_faqs
from .faq_flags import update_faq_flags
from .streams import sse_chat_stream  
from .views_pricing import price_estimate

urlpatterns = [
    path("chat", chat),                    # non-streaming
    path("chat/stream", sse_chat_stream),  # streaming SSE (optional)
    # path("history", history_list),         # optional: list history items
    # path("history/clear", history_clear),  # optional: clear history
    path("sql", sql_from_question),       # SQL generation endpoint
    path("execute-sql", execute_sql),     # Execute SQL query endpoint
    
    # FAQ Management endpoints
    path("faqs", FAQListCreateView.as_view(), name="faq-list-create"),
    path("faqs/<int:pk>", FAQDetailView.as_view(), name="faq-detail"),
    path("faqs/query", query_faqs, name="faq-query"),
    path("faqs/latest", latest_faqs, name="faq-latest"),
    path("faqs/flags", update_faq_flags, name="faq-flags"),
    path("pricing/estimate", price_estimate, name="pricing-estimate"),
]
