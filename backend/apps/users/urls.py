from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.users.views import MemberViewSet, UserHealthView

router = DefaultRouter()
router.register(r"members", MemberViewSet, basename="member")

urlpatterns = [
    path("health/", UserHealthView.as_view(), name="users-health"),
    path("", include(router.urls)),
]
