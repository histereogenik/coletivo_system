from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.fiscal.views import FiscalDocumentViewSet, FiscalSourceView, FocusWebhookView

router = DefaultRouter()
router.register(r"documents", FiscalDocumentViewSet, basename="fiscal-document")

urlpatterns = [
    path("sources/", FiscalSourceView.as_view(), name="fiscal-sources"),
    path("webhooks/focus/", FocusWebhookView.as_view(), name="focus-webhook"),
    path("", include(router.urls)),
]
