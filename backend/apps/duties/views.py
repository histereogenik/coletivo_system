from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.exports import create_xlsx_response
from apps.common.audit import AuthoredAuditViewSetMixin
from apps.common.permissions import AnyAreaPermission, AreaPermission
from apps.duties.models import Duty
from apps.duties.serializers import DutyOptionSerializer, DutySerializer


class DutyOptionListView(APIView):
    permission_classes = [AnyAreaPermission]
    area_permissions = ("authentication.manage_agenda",)

    def get(self, request):
        queryset = Duty.objects.all().order_by("name")
        return Response(DutyOptionSerializer(queryset, many=True).data)


class DutyViewSet(AuthoredAuditViewSetMixin, viewsets.ModelViewSet):
    queryset = Duty.objects.prefetch_related("members").order_by("name")
    serializer_class = DutySerializer
    permission_classes = [AreaPermission]
    area_permission = "authentication.manage_duties"

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
