import django_filters
from rest_framework import viewsets

from apps.agenda.models import AgendaEntry
from apps.agenda.serializers import AgendaEntrySerializer
from apps.common.permissions import SuperuserOrReadOnly


class AgendaEntryFilter(django_filters.FilterSet):
    date = django_filters.DateFilter()
    date_from = django_filters.DateFilter(field_name="date", lookup_expr="gte")
    date_to = django_filters.DateFilter(field_name="date", lookup_expr="lte")
    date_range = django_filters.DateFromToRangeFilter(field_name="date")
    duty = django_filters.NumberFilter(field_name="duty_id")
    member = django_filters.NumberFilter(field_name="members__id")
    status = django_filters.CharFilter(field_name="status")

    class Meta:
        model = AgendaEntry
        fields = ["date", "status", "duty", "member", "date_range", "date_from", "date_to"]


class AgendaEntryViewSet(viewsets.ModelViewSet):
    queryset = (
        AgendaEntry.objects.select_related("duty")
        .prefetch_related("members")
        .order_by("date", "start_time", "duty__name")
    )
    serializer_class = AgendaEntrySerializer
    permission_classes = [SuperuserOrReadOnly]
    filterset_class = AgendaEntryFilter
