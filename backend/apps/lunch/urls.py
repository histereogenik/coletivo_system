from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.lunch.views import LunchViewSet, PackageViewSet

router = DefaultRouter()
router.register(r"lunches", LunchViewSet, basename="lunch")
router.register(r"packages", PackageViewSet, basename="package")

urlpatterns = [
    path("", include(router.urls)),
]
