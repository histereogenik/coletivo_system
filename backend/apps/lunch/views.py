import django_filters
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.permissions import SuperuserOnly
from apps.lunch.models import Lunch, Package
from apps.lunch.serializers import LunchSerializer, PackageSerializer


class LunchFilter(django_filters.FilterSet):
    date_from = django_filters.DateFilter(field_name="date", lookup_expr="gte")
    date_to = django_filters.DateFilter(field_name="date", lookup_expr="lte")
    has_package = django_filters.BooleanFilter(method="filter_has_package")

    def filter_has_package(self, queryset, name, value):
        if value is True:
            return queryset.filter(package__isnull=False)
        if value is False:
            return queryset.filter(package__isnull=True)
        return queryset

    class Meta:
        model = Lunch
        fields = ["payment_status", "date", "member", "package", "has_package"]


class PackageFilter(django_filters.FilterSet):
    date_from = django_filters.DateFilter(field_name="date", lookup_expr="gte")
    date_to = django_filters.DateFilter(field_name="date", lookup_expr="lte")
    expiration_from = django_filters.DateFilter(field_name="expiration", lookup_expr="gte")
    expiration_to = django_filters.DateFilter(field_name="expiration", lookup_expr="lte")

    class Meta:
        model = Package
        fields = ["payment_status", "status", "member", "date", "expiration"]


class LunchViewSet(viewsets.ModelViewSet):
    queryset = Lunch.objects.select_related("member", "package").order_by("-date", "-created_at")
    serializer_class = LunchSerializer
    permission_classes = [SuperuserOnly]
    filterset_class = LunchFilter

    def perform_destroy(self, instance):
        # Remove linked financial entry to keep financial data consistent
        entry = getattr(instance, "financial_entry", None)
        if entry:
            entry.delete()
        super().perform_destroy(instance)


class PackageViewSet(viewsets.ModelViewSet):
    queryset = Package.objects.select_related("member").order_by("-date", "-created_at")
    serializer_class = PackageSerializer
    permission_classes = [SuperuserOnly]
    filterset_class = PackageFilter

    def perform_destroy(self, instance):
        entry = getattr(instance, "financial_entry", None)
        if entry:
            entry.delete()
        super().perform_destroy(instance)

    @action(detail=True, methods=["post"], url_path="decrement")
    def decrement(self, request, pk=None):
        package = self.get_object()
        amount = int(request.data.get("amount", 1))
        if amount <= 0:
            return Response({"detail": "Quantidade deve ser maior que zero."}, status=400)
        if package.remaining_quantity is None:
            package.remaining_quantity = package.quantity
        if package.remaining_quantity is None or package.remaining_quantity < amount:
            return Response({"detail": "Saldo insuficiente no pacote."}, status=400)

        package.remaining_quantity -= amount
        package.save(update_fields=["remaining_quantity", "updated_at"])
        serializer = self.get_serializer(package)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="increment")
    def increment(self, request, pk=None):
        package = self.get_object()
        amount = int(request.data.get("amount", 1))
        if amount <= 0:
            return Response({"detail": "Quantidade deve ser maior que zero."}, status=400)
        if package.remaining_quantity is None:
            package.remaining_quantity = package.quantity
        target = package.remaining_quantity + amount
        if package.quantity is not None and target > package.quantity:
            return Response(
                {"detail": "Não é possível exceder a quantidade total do pacote."}, status=400
            )

        package.remaining_quantity = target
        package.save(update_fields=["remaining_quantity", "updated_at"])
        serializer = self.get_serializer(package)
        return Response(serializer.data)
