from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.lunch.views import LunchViewSet


router = DefaultRouter()
router.register(r"lunches", LunchViewSet, basename="lunch")

urlpatterns = [
    path("", include(router.urls)),
]
