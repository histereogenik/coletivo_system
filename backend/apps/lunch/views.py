from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
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

    @action(detail=True, methods=["post"], url_path="decrement")
    def decrement(self, request, pk=None):
        lunch = self.get_object()
        amount = int(request.data.get("amount", 1))
        if amount <= 0:
            return Response({"detail": "Quantidade deve ser maior que zero."}, status=400)
        if lunch.lunch_type != Lunch.LunchType.PACOTE:
            return Response({"detail": "Ação permitida apenas para pacotes."}, status=400)
        if lunch.remaining_quantity is None:
            lunch.remaining_quantity = lunch.quantity
        if lunch.remaining_quantity is None or lunch.remaining_quantity < amount:
            return Response({"detail": "Saldo insuficiente no pacote."}, status=400)

        lunch.remaining_quantity -= amount
        lunch.save(update_fields=["remaining_quantity", "updated_at"])
        serializer = self.get_serializer(lunch)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="increment")
    def increment(self, request, pk=None):
        lunch = self.get_object()
        amount = int(request.data.get("amount", 1))
        if amount <= 0:
            return Response({"detail": "Quantidade deve ser maior que zero."}, status=400)
        if lunch.lunch_type != Lunch.LunchType.PACOTE:
            return Response({"detail": "Ação permitida apenas para pacotes."}, status=400)
        if lunch.remaining_quantity is None:
            lunch.remaining_quantity = lunch.quantity
        target = lunch.remaining_quantity + amount
        if lunch.quantity is not None and target > lunch.quantity:
            return Response({"detail": "Não é possível exceder a quantidade total do pacote."}, status=400)

        lunch.remaining_quantity = target
        lunch.save(update_fields=["remaining_quantity", "updated_at"])
        serializer = self.get_serializer(lunch)
        return Response(serializer.data)
