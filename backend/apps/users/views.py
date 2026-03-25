import django_filters
from django.db import transaction
from django.http import JsonResponse
from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from apps.common.exports import create_xlsx_response
from apps.common.pagination import OptionalPagination
from apps.common.permissions import SuperuserOnly
from apps.users.models import Member, PublicRegistration
from apps.users.serializers import (
    MemberSerializer,
    PublicRegistrationAdminSerializer,
    PublicRegistrationRejectSerializer,
    PublicRegistrationSubmitSerializer,
)


class PublicRegistrationThrottle(AnonRateThrottle):
    scope = "public_registration"


class UserHealthView(APIView):
    """Basic health endpoint for the users service slice."""

    authentication_classes = []
    permission_classes = []

    def get(self, request):
        return JsonResponse({"status": "ok", "service": "users"}, status=200)


class PublicRegistrationMetaView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        return Response(
            {
                "role": [
                    {"value": value, "label": label} for value, label in Member.Role.choices
                ],
                "diet": [
                    {"value": value, "label": label} for value, label in Member.Diet.choices
                ],
            }
        )


class PublicRegistrationSubmissionView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [PublicRegistrationThrottle]

    def post(self, request):
        serializer = PublicRegistrationSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {"detail": "Inscrição enviada com sucesso."},
            status=status.HTTP_201_CREATED,
        )


class MemberFilter(django_filters.FilterSet):
    search = django_filters.CharFilter(field_name="full_name", lookup_expr="icontains")
    role = django_filters.CharFilter(field_name="role")
    diet = django_filters.CharFilter(field_name="diet")

    class Meta:
        model = Member
        fields = ["search", "role", "diet"]


class PublicRegistrationFilter(django_filters.FilterSet):
    status = django_filters.CharFilter(field_name="status")
    search = django_filters.CharFilter(method="filter_search")

    class Meta:
        model = PublicRegistration
        fields = ["status", "search"]

    def filter_search(self, queryset, name, value):
        if not value:
            return queryset
        return queryset.filter(Q(full_name__icontains=value) | Q(email__icontains=value))


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


class PublicRegistrationAdminViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = PublicRegistration.objects.prefetch_related("children").all()
    serializer_class = PublicRegistrationAdminSerializer
    permission_classes = [SuperuserOnly]
    filterset_class = PublicRegistrationFilter

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, pk=None):
        registration = self.get_object()
        if registration.status != PublicRegistration.Status.PENDENTE:
            return Response(
                {"detail": "A inscrição já foi processada."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if registration.email and Member.objects.filter(email__iexact=registration.email).exists():
            return Response(
                {"detail": "Já existe um integrante com este e-mail."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            adult_member = Member.objects.create(
                full_name=registration.full_name,
                phone=registration.phone,
                email=registration.email,
                address=registration.address,
                heard_about=registration.heard_about,
                role=registration.role,
                diet=registration.diet,
                observations=registration.observations,
            )

            for child in registration.children.all():
                Member.objects.create(
                    full_name=child.full_name,
                    is_child=True,
                    responsible=adult_member,
                    phone=None,
                    email=None,
                    address="",
                    heard_about="",
                    role=None,
                    diet=child.diet,
                    observations=child.observations,
                )

            registration.status = PublicRegistration.Status.APROVADO
            registration.save(update_fields=["status", "updated_at"])

        registration.refresh_from_db()
        serializer = self.get_serializer(registration)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, pk=None):
        registration = self.get_object()
        if registration.status != PublicRegistration.Status.PENDENTE:
            return Response(
                {"detail": "A inscrição já foi processada."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = PublicRegistrationRejectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        registration.status = PublicRegistration.Status.REJEITADO
        registration.review_notes = serializer.validated_data.get("review_notes", "")
        registration.save(update_fields=["status", "review_notes", "updated_at"])

        response_serializer = self.get_serializer(registration)
        return Response(response_serializer.data, status=status.HTTP_200_OK)
