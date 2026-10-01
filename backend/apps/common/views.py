import django_filters
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.models import AuditEvent
from apps.common.permissions import SuperuserOnly
from apps.common.serializers import AuditEventSerializer


class AuditEventFilter(django_filters.FilterSet):
    created_from = django_filters.IsoDateTimeFilter(field_name="created_at", lookup_expr="gte")
    created_to = django_filters.IsoDateTimeFilter(field_name="created_at", lookup_expr="lte")

    class Meta:
        model = AuditEvent
        fields = ["actor", "action", "source", "entity_type", "object_id"]


class AuditEventViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditEvent.objects.select_related("actor").all()
    serializer_class = AuditEventSerializer
    permission_classes = [SuperuserOnly]
    filterset_class = AuditEventFilter

    @action(detail=False, methods=["get"], url_path="filter-options")
    def filter_options(self, request):
        actor_rows = (
            AuditEvent.objects.filter(actor__isnull=False)
            .values(
                "actor_id",
                "actor__username",
                "actor__first_name",
                "actor__last_name",
            )
            .order_by("actor__first_name", "actor__username")
            .distinct()
        )
        actors = []
        for row in actor_rows:
            full_name = " ".join(
                part
                for part in (row["actor__first_name"], row["actor__last_name"])
                if part
            ).strip()
            actors.append(
                {
                    "value": str(row["actor_id"]),
                    "label": full_name or row["actor__username"],
                }
            )

        return Response(
            {
                "actors": actors,
                "actions": [
                    {"value": value, "label": label}
                    for value, label in AuditEvent.Action.choices
                ],
                "sources": [
                    {"value": value, "label": label}
                    for value, label in AuditEvent.Source.choices
                ],
                "entity_types": list(
                    AuditEvent.objects.order_by("entity_type")
                    .values_list("entity_type", flat=True)
                    .distinct()
                ),
            }
        )
