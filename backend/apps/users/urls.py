from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.users.views import (
    MemberViewSet,
    PublicRegistrationAdminViewSet,
    PublicRegistrationMetaView,
    PublicRegistrationSubmissionView,
)

router = DefaultRouter()
router.register(r"members", MemberViewSet, basename="member")
router.register(
    r"public-registrations-admin",
    PublicRegistrationAdminViewSet,
    basename="public-registration-admin",
)

urlpatterns = [
    path(
        "public-registrations/",
        PublicRegistrationSubmissionView.as_view(),
        name="public-registration-submit",
    ),
    path(
        "public-registrations/meta/",
        PublicRegistrationMetaView.as_view(),
        name="public-registration-meta",
    ),
    path("", include(router.urls)),
]
