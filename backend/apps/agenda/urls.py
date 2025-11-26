from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.agenda.views import AgendaEntryViewSet

router = DefaultRouter()
router.register(r"entries", AgendaEntryViewSet, basename="agenda-entry")

urlpatterns = [
    path("", include(router.urls)),
]
