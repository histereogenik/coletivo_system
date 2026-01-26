import django_filters
from django.db import models
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import SuperuserOnly
from apps.financial.models import FinancialEntry
from apps.financial.serializers import FinancialEntrySerializer


class FinancialEntryFilter(django_filters.FilterSet):
    date = django_filters.DateFilter()
    date_from = django_filters.DateFilter(field_name="date", lookup_expr="gte")
    date_to = django_filters.DateFilter(field_name="date", lookup_expr="lte")
    date_range = django_filters.DateFromToRangeFilter(field_name="date")
    entry_type = django_filters.CharFilter(field_name="entry_type")
    category = django_filters.CharFilter(field_name="category")

    class Meta:
        model = FinancialEntry
        fields = ["date", "entry_type", "category", "date_range", "date_from", "date_to"]


class FinancialEntryViewSet(viewsets.ModelViewSet):
    queryset = FinancialEntry.objects.all().order_by("-date", "-created_at")
    serializer_class = FinancialEntrySerializer
    permission_classes = [SuperuserOnly]
    filterset_class = FinancialEntryFilter


class FinancialSummaryView(APIView):
    permission_classes = [SuperuserOnly]

    def get(self, request):
        today = timezone.localdate()
        start_month = today.replace(day=1)

        entries = FinancialEntry.objects.all()
        month_entries = entries.filter(date__gte=start_month, date__lte=today)

        month_entradas = (
            month_entries.filter(entry_type=FinancialEntry.EntryType.ENTRADA).aggregate(
                total=models.Sum("value_cents")
            )["total"]
            or 0
        )
        month_saidas = (
            month_entries.filter(entry_type=FinancialEntry.EntryType.SAIDA).aggregate(
                total=models.Sum("value_cents")
            )["total"]
            or 0
        )
        total_entradas = (
            entries.filter(entry_type=FinancialEntry.EntryType.ENTRADA).aggregate(
                total=models.Sum("value_cents")
            )["total"]
            or 0
        )
        total_saidas = (
            entries.filter(entry_type=FinancialEntry.EntryType.SAIDA).aggregate(
                total=models.Sum("value_cents")
            )["total"]
            or 0
        )

        filterset = FinancialEntryFilter(request.GET, queryset=entries)
        if not filterset.is_valid():
            return Response(filterset.errors, status=400)

        filtered_entries = filterset.qs
        filtered_entradas = (
            filtered_entries.filter(entry_type=FinancialEntry.EntryType.ENTRADA).aggregate(
                total=models.Sum("value_cents")
            )["total"]
            or 0
        )
        filtered_saidas = (
            filtered_entries.filter(entry_type=FinancialEntry.EntryType.SAIDA).aggregate(
                total=models.Sum("value_cents")
            )["total"]
            or 0
        )

        return Response(
            {
                "month": {
                    "entradas_cents": month_entradas,
                    "saidas_cents": month_saidas,
                    "saldo_cents": month_entradas - month_saidas,
                },
                "total": {
                    "entradas_cents": total_entradas,
                    "saidas_cents": total_saidas,
                    "saldo_cents": total_entradas - total_saidas,
                },
                "filtered": {
                    "entradas_cents": filtered_entradas,
                    "saidas_cents": filtered_saidas,
                    "saldo_cents": filtered_entradas - filtered_saidas,
                    "count": filtered_entries.count(),
                },
            }
        )
