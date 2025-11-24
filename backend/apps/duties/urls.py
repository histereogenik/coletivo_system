from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.duties.views import DutyViewSet

router = DefaultRouter()
router.register(r"duties", DutyViewSet, basename="duty")

urlpatterns = [
    path("", include(router.urls)),
]
