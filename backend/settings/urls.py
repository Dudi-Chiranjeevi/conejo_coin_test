# settings/urls.py - Main project URLs
from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

# Unified API Gateway approach
urlpatterns = [
    path('admin/', admin.site.urls),
    # All API endpoints now under /api/v1/[module]/ pattern
    path('api/v1/', include([
        path('inventory/', include('inventory.urls')),
        path('ai/', include('assistant.urls')),
        path('ngc-integration/', include('ngc_integration.urls')),
        path('locations/', include('locations.urls')),
        path('auth/', include('common.auth.urls')),
        path('ebay/', include('ebay_integration.urls')),  # ← ADD THIS LINE
        path('clients/', include('client_management.urls')),
    ])),
    path('api-auth/', include('rest_framework.urls')),
    
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),

    # Swagger UI
    path("docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="api-docs"),

    # ReDoc
    path("redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
]