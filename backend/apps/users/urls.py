from django.urls import path

from apps.users.views import UserHealthView


urlpatterns = [
    path("health/", UserHealthView.as_view(), name="users-health"),
]
