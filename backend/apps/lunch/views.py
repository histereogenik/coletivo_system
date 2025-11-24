from rest_framework import viewsets
from rest_framework.permissions import BasePermission

from apps.lunch.models import Lunch
from apps.lunch.serializers import LunchSerializer


class IsSuperUser(BasePermission):
    message = "Apenas superusuários podem gerenciar almoços."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)


class LunchViewSet(viewsets.ModelViewSet):
    queryset = Lunch.objects.select_related("member").order_by("-date", "-created_at")
    serializer_class = LunchSerializer
    permission_classes = [IsSuperUser]
    filterset_fields = [
        "payment_status",
        "date",
        "member",
        "package_status",
        "lunch_type",
    ]