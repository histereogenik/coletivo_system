import hmac

import django_filters
from django.conf import settings
from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import SuperuserOnly
from apps.fiscal.models import FiscalDocument
from apps.fiscal.serializers import FiscalDocumentSerializer, FiscalEmissionSerializer
from apps.fiscal.services import (
    emit_fiscal_document,
    get_missing_fiscal_settings,
    refresh_fiscal_document,
)
from apps.fiscal.webhooks import process_focus_webhook


class FiscalDocumentFilter(django_filters.FilterSet):
    date_from = django_filters.DateFilter(field_name="sale_date", lookup_expr="gte")
    date_to = django_filters.DateFilter(field_name="sale_date", lookup_expr="lte")
    search = django_filters.CharFilter(method="filter_search")

    def filter_search(self, queryset, name, value):
        if not value:
            return queryset
        return queryset.filter(
            Q(access_key__icontains=value)
            | Q(number__icontains=value)
            | Q(lunch__member__full_name__icontains=value)
            | Q(package__member__full_name__icontains=value)
        ).distinct()

    class Meta:
        model = FiscalDocument
        fields = ["document_type", "environment", "status", "date_from", "date_to", "search"]


class FiscalDocumentViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = FiscalDocument.objects.select_related("lunch", "package", "created_by")
    serializer_class = FiscalDocumentSerializer
    permission_classes = [SuperuserOnly]
    filterset_class = FiscalDocumentFilter

    @action(detail=False, methods=["get"], url_path="configuration")
    def configuration(self, request):
        missing = get_missing_fiscal_settings()
        production_allowed = bool(settings.FOCUS_NFE_ALLOW_PRODUCTION)
        blocked = settings.FOCUS_NFE_ENVIRONMENT == "production" and not production_allowed
        return Response(
            {
                "environment": settings.FOCUS_NFE_ENVIRONMENT,
                "production_allowed": production_allowed,
                "package_emission_allowed": settings.FISCAL_ALLOW_PACKAGE_EMISSION,
                "webhook_configured": bool(
                    settings.FOCUS_WEBHOOK_URL and settings.FOCUS_WEBHOOK_SECRET
                ),
                "ready": not missing and not blocked,
                "missing": missing,
                "fiscal_profile": {
                    "ncm": settings.FISCAL_MEAL_NCM,
                    "cfop": settings.FISCAL_MEAL_CFOP,
                    "csosn": settings.FISCAL_ICMS_CSOSN,
                },
            }
        )

    @action(detail=False, methods=["post"], url_path="emit")
    def emit(self, request):
        input_serializer = FiscalEmissionSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)
        document = emit_fiscal_document(
            **input_serializer.validated_data,
            actor=request.user,
        )
        output_serializer = self.get_serializer(document)
        response_status = (
            status.HTTP_201_CREATED
            if document.status != FiscalDocument.Status.REJECTED
            else status.HTTP_422_UNPROCESSABLE_ENTITY
        )
        return Response(output_serializer.data, status=response_status)

    @action(detail=True, methods=["post"], url_path="refresh")
    def refresh(self, request, pk=None):
        document = refresh_fiscal_document(self.get_object())
        return Response(self.get_serializer(document).data)


class FocusWebhookView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = []

    def post(self, request):
        if not settings.FOCUS_WEBHOOK_SECRET:
            return Response(
                {"detail": "Webhook da Focus não configurado."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        received_secret = request.headers.get(settings.FOCUS_WEBHOOK_AUTHORIZATION_HEADER, "")
        if not hmac.compare_digest(received_secret, settings.FOCUS_WEBHOOK_SECRET):
            return Response(
                {"detail": "Credencial do webhook inválida."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        if not isinstance(request.data, dict):
            return Response(
                {"detail": "Payload do webhook deve ser um objeto JSON."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        event, created = process_focus_webhook(request.data)
        if event.status == event.Status.FAILED:
            return Response(
                {
                    "received": True,
                    "duplicate": not created,
                    "status": event.status,
                    "detail": "Falha temporária ao processar o webhook.",
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        return Response(
            {
                "received": True,
                "duplicate": not created,
                "status": event.status,
            }
        )
