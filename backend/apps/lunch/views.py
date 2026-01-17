import django_filters
from rest_framework import viewsets

from apps.common.permissions import SuperuserOnly
from apps.lunch.models import Lunch
from apps.lunch.serializers import LunchSerializer


class LunchFilter(django_filters.FilterSet):
    date_from = django_filters.DateFilter(field_name="date", lookup_expr="gte")
    date_to = django_filters.DateFilter(field_name="date", lookup_expr="lte")

    class Meta:
        model = Lunch
        fields = ["payment_status", "date", "member", "package"]


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
