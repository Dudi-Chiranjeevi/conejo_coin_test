# from django.urls import path
# from .views import ClientListView, ClientDetailView, ClientBulkDeleteView

# urlpatterns = [
#     path('clients/', ClientListView.as_view(), name='client-list'),
#     path('clients/<uuid:client_id>/', ClientDetailView.as_view(), name='client-detail'),
#     path('clients/bulk-delete/', ClientBulkDeleteView.as_view(), name='client-bulk-delete'),
# ]

from django.urls import path
from .views import ClientListView, ClientDetailView, ClientBulkDeleteView

urlpatterns = [
    path('', ClientListView.as_view(), name='client-list'),  # Now: /api/v1/clients/
    path('<uuid:client_id>/', ClientDetailView.as_view(), name='client-detail'),  # Now: /api/v1/clients/{id}/
    path('bulk-delete/', ClientBulkDeleteView.as_view(), name='client-bulk-delete'),  # Now: /api/v1/clients/bulk-delete/
]