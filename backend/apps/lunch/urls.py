from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.credits.views import CreditOwnerOptionView
from apps.lunch.views import LunchViewSet, PackageViewSet

router = DefaultRouter()
router.register(r"lunches", LunchViewSet, basename="lunch")
router.register(r"packages", PackageViewSet, basename="package")

urlpatterns = [
    path(
        "credit-owner-options/",
        CreditOwnerOptionView.as_view(),
        name="lunch-credit-owner-options",
    ),
    path("", include(router.urls)),
]
