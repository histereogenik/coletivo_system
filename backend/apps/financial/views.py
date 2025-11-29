import django_filters
from rest_framework import viewsets

from apps.common.permissions import SuperuserOrReadOnly
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
    permission_classes = [SuperuserOrReadOnly]
    filterset_class = FinancialEntryFilter
