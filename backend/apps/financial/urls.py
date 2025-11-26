from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.financial.views import FinancialEntryViewSet

router = DefaultRouter()
router.register(r"entries", FinancialEntryViewSet, basename="financial-entry")

urlpatterns = [
    path("", include(router.urls)),
]
