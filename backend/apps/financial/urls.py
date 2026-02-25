from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.financial.views import FinancialEntryViewSet, FinancialSummaryView

router = DefaultRouter()
router.register(r"entries", FinancialEntryViewSet, basename="financial-entry")

urlpatterns = [
    path("summary/", FinancialSummaryView.as_view(), name="financial-summary"),
    path("", include(router.urls)),
]
