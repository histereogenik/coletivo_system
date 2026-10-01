from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.duties.views import DutyOptionListView, DutyViewSet

router = DefaultRouter()
router.register(r"duties", DutyViewSet, basename="duty")

urlpatterns = [
    path("options/", DutyOptionListView.as_view(), name="duty-options"),
    path("", include(router.urls)),
]
