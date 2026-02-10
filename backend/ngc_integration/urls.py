from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import BarcodeViewSet, lookup_cert, lookup_and_save_cert, check_certificate_exists, invalidate_cache, InventoryFromNGCView

router = DefaultRouter()
router.register(r'barcodes', BarcodeViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('lookup-cert/', lookup_cert, name='lookup-cert'),
    path('lookup-and-save-cert/', lookup_and_save_cert, name='lookup-and-save-cert'),
    path('check-certificate-exists/', check_certificate_exists, name='check-certificate-exists'),
    path('invalidate-cache/', invalidate_cache, name='invalidate-cache'),
    path('from-ngc/', InventoryFromNGCView.as_view(), name='from-ngc'),
]
