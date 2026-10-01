from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.credits.views import (
    CreditEntryViewSet,
    CreditOwnerOptionView,
    CreditSummaryView,
    ManualCreditCreateView,
    ManualDebitCreateView,
)

router = DefaultRouter()
router.register(r"entries", CreditEntryViewSet, basename="credit-entry")

urlpatterns = [
    path("owner-options/", CreditOwnerOptionView.as_view(), name="credit-owner-options"),
    path("summary/", CreditSummaryView.as_view(), name="credit-summary"),
    path("manual-credit/", ManualCreditCreateView.as_view(), name="credit-manual-credit"),
    path("manual-debit/", ManualDebitCreateView.as_view(), name="credit-manual-debit"),
    path("", include(router.urls)),
]
