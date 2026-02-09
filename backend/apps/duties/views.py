from rest_framework import viewsets
from rest_framework.decorators import action

from apps.common.exports import create_xlsx_response

from apps.common.permissions import SuperuserOnly
from apps.duties.models import Duty
from apps.duties.serializers import DutySerializer


class DutyViewSet(viewsets.ModelViewSet):
    queryset = Duty.objects.prefetch_related("members").order_by("name")
    serializer_class = DutySerializer
    permission_classes = [SuperuserOnly]

    @action(detail=False, methods=["get"], url_path="export")
    def export(self, request):
        queryset = self.get_queryset()
        headers = ["Função", "Remuneração (R$)", "Integrantes", "Criado em"]
        rows = [
            [
                duty.name,
                duty.remuneration_cents / 100,
                ", ".join(member.full_name for member in duty.members.all()),
                duty.created_at.strftime("%Y-%m-%d %H:%M"),
            ]
            for duty in queryset
        ]
        return create_xlsx_response("funcoes", headers, rows)
