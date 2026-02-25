import django_filters
from django.http import JsonResponse
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.views import APIView

from apps.common.exports import create_xlsx_response
from apps.common.pagination import OptionalPagination
from apps.common.permissions import SuperuserOnly
from apps.users.models import Member
from apps.users.serializers import MemberSerializer


class UserHealthView(APIView):
    """Basic health endpoint for the users service slice."""

    authentication_classes = []
    permission_classes = []

    def get(self, request):
        return JsonResponse({"status": "ok", "service": "users"}, status=200)


class MemberFilter(django_filters.FilterSet):
    search = django_filters.CharFilter(field_name="full_name", lookup_expr="icontains")
    role = django_filters.CharFilter(field_name="role")
    diet = django_filters.CharFilter(field_name="diet")

    class Meta:
        model = Member
        fields = ["search", "role", "diet"]


class MemberViewSet(viewsets.ModelViewSet):
    queryset = Member.objects.all().order_by("full_name")
    serializer_class = MemberSerializer
    permission_classes = [SuperuserOnly]
    filterset_class = MemberFilter
    pagination_class = OptionalPagination

    @action(detail=False, methods=["get"], url_path="export")
    def export(self, request):
        queryset = self.filter_queryset(self.get_queryset())
        headers = [
            "Nome",
            "Criança",
            "Responsável",
            "Telefone",
            "Email",
            "Endereço",
            "Como conheceu",
            "Categoria",
            "Dieta",
            "Observações",
            "Criado em",
        ]
        rows = [
            [
                member.full_name,
                "Sim" if member.is_child else "Não",
                member.responsible.full_name if member.responsible else "",
                member.phone or "",
                member.email or "",
                member.address or "",
                member.heard_about or "",
                member.get_role_display() if member.role else "",
                member.get_diet_display(),
                member.observations or "",
                member.created_at.strftime("%Y-%m-%d %H:%M"),
            ]
            for member in queryset
        ]
        return create_xlsx_response("integrantes", headers, rows)
