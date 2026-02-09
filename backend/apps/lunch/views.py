import django_filters
from django.db import models
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.exports import cents_to_reais, create_xlsx_response
from apps.common.permissions import SuperuserOnly
from apps.lunch.models import Lunch, Package
from apps.lunch.serializers import LunchSerializer, PackageSerializer


class LunchFilter(django_filters.FilterSet):
    date_from = django_filters.DateFilter(field_name="date", lookup_expr="gte")
    date_to = django_filters.DateFilter(field_name="date", lookup_expr="lte")
    has_package = django_filters.BooleanFilter(method="filter_has_package")
    value_cents = django_filters.NumberFilter(field_name="value_cents")
    value_cents_min = django_filters.NumberFilter(field_name="value_cents", lookup_expr="gte")
    value_cents_max = django_filters.NumberFilter(field_name="value_cents", lookup_expr="lte")
    value_cents = django_filters.NumberFilter(field_name="value_cents")
    value_cents_min = django_filters.NumberFilter(field_name="value_cents", lookup_expr="gte")
    value_cents_max = django_filters.NumberFilter(field_name="value_cents", lookup_expr="lte")

    def filter_has_package(self, queryset, name, value):
        if value is True:
            return queryset.filter(package__isnull=False)
        if value is False:
            return queryset.filter(package__isnull=True)
        return queryset

    class Meta:
        model = Lunch
        fields = ["payment_status", "date", "member", "package", "has_package", "value_cents", "value_cents_min", "value_cents_max"]


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

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        filterset = LunchFilter(request.GET, queryset=self.filter_queryset(self.get_queryset()))
        if not filterset.is_valid():
            return Response(filterset.errors, status=400)

        entries = filterset.qs
        total_received = (
            entries.filter(payment_status=Lunch.PaymentStatus.PAGO).aggregate(
                total=models.Sum("value_cents")
            )["total"]
            or 0
        )
        total_open = (
            entries.filter(payment_status=Lunch.PaymentStatus.EM_ABERTO).aggregate(
                total=models.Sum("value_cents")
            )["total"]
            or 0
        )

        return Response(
            {
                "received_cents": total_received,
                "open_cents": total_open,
                "count": entries.count(),
            }
        )

    @action(detail=False, methods=["get"], url_path="export")
    def export(self, request):
        queryset = self.filter_queryset(self.get_queryset())
        headers = [
            "Data",
            "Integrante",
            "Tipo",
            "Status",
            "Pagamento",
            "Valor (R$)",
            "Pacote",
        ]
        rows = [
            [
                lunch.date.strftime("%Y-%m-%d"),
                lunch.member.full_name,
                "Pacote" if lunch.package_id else "Avulso",
                lunch.get_payment_status_display(),
                lunch.get_payment_mode_display(),
                cents_to_reais(lunch.value_cents),
                lunch.package_id or "",
            ]
            for lunch in queryset
        ]
        return create_xlsx_response("almocos", headers, rows)


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

    @action(detail=False, methods=["get"], url_path="export")
    def export(self, request):
        queryset = self.filter_queryset(self.get_queryset())
        headers = [
            "Compra",
            "Integrante",
            "Valor unitario (R$)",
            "Valor total (R$)",
            "Quantidade",
            "Saldo",
            "Validade",
            "Status",
            "Pagamento",
        ]
        rows = [
            [
                package.date.strftime("%Y-%m-%d"),
                package.member.full_name,
                cents_to_reais(package.unit_value_cents),
                cents_to_reais(package.value_cents),
                package.quantity,
                package.remaining_quantity,
                package.expiration.strftime("%Y-%m-%d"),
                package.get_status_display(),
                package.get_payment_status_display(),
            ]
            for package in queryset
        ]
        return create_xlsx_response("pacotes", headers, rows)

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
