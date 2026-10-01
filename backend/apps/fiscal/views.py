import hmac

import django_filters
from django.conf import settings
from django.db import transaction
from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import AreaPermission
from apps.common.pagination import DefaultPagination
from apps.common.audit import record_audit_event, snapshot
from apps.common.models import AuditEvent
from apps.fiscal.models import FiscalDocument
from apps.fiscal.serializers import FiscalDocumentSerializer, FiscalEmissionSerializer
from apps.fiscal.services import (
    emit_fiscal_document,
    get_missing_fiscal_settings,
    refresh_fiscal_document,
)
from apps.fiscal.webhooks import process_focus_webhook
from apps.lunch.models import Lunch, Package


class FiscalSourceView(APIView):
    permission_classes = [AreaPermission]
    area_permission = "authentication.manage_fiscal"
    pagination_class = DefaultPagination

    def get(self, request):
        source_type = request.query_params.get("source_type")
        if source_type == FiscalDocument.SourceType.LUNCH:
            queryset = (
                Lunch.objects.filter(
                    payment_status=Lunch.PaymentStatus.PAGO,
                    package__isnull=True,
                    value_cents__gt=0,
                )
                .exclude(payment_mode=Lunch.PaymentMode.TROCA)
                .select_related("member")
                .order_by("-date", "-created_at")
            )
        elif source_type == FiscalDocument.SourceType.PACKAGE:
            queryset = (
                Package.objects.filter(
                    payment_status=Package.PaymentStatus.PAGO,
                    value_cents__gt=0,
                )
                .exclude(payment_mode=Package.PaymentMode.TROCA)
                .select_related("member")
                .order_by("-date", "-created_at")
            )
        else:
            return Response(
                {"source_type": "Informe LUNCH ou PACKAGE."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(queryset, request, view=self)
        data = []
        for item in page:
            source = {
                "id": item.id,
                "member_name": item.member.full_name,
                "value_cents": item.value_cents,
                "date": item.date,
                "payment_mode": item.payment_mode,
            }
            if source_type == FiscalDocument.SourceType.PACKAGE:
                source["quantity"] = item.quantity
            data.append(source)
        return paginator.get_paginated_response(data)


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
    permission_classes = [AreaPermission]
    area_permission = "authentication.manage_fiscal"
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
                "manual_emission_allowed": settings.FISCAL_ALLOW_MANUAL_EMISSION,
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
        document, created = emit_fiscal_document(
            **input_serializer.validated_data,
            actor=request.user,
        )
        if created:
            record_audit_event(
                request=request,
                instance=document,
                action=AuditEvent.Action.CREATE,
                changes={"created": snapshot(document)},
            )
        else:
            record_audit_event(
                request=request,
                instance=document,
                action=AuditEvent.Action.SPECIAL,
                changes={"operation": "idempotent_emission_retry"},
            )
        output_serializer = self.get_serializer(document)
        response_status = (
            status.HTTP_200_OK
            if not created
            else (
                status.HTTP_201_CREATED
                if document.status != FiscalDocument.Status.REJECTED
                else status.HTTP_422_UNPROCESSABLE_ENTITY
            )
        )
        return Response(output_serializer.data, status=response_status)

    @action(detail=True, methods=["post"], url_path="refresh")
    @transaction.atomic
    def refresh(self, request, pk=None):
        document = refresh_fiscal_document(self.get_object())
        record_audit_event(
            request=request,
            instance=document,
            action=AuditEvent.Action.SPECIAL,
            changes={"operation": "refresh"},
        )
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

        event, created, document_changes = process_focus_webhook(request.data)
        if document_changes is not None and event.document:
            record_audit_event(
                request=request,
                instance=event.document,
                action=AuditEvent.Action.UPDATE,
                source=AuditEvent.Source.WEBHOOK,
                changes={
                    "operation": "focus_webhook_update",
                    "webhook_event_id": event.id,
                    **document_changes,
                },
            )
        elif created and event.status in {
            event.Status.FAILED,
            event.Status.IGNORED,
        }:
            record_audit_event(
                request=request,
                instance=event,
                action=AuditEvent.Action.SPECIAL,
                source=AuditEvent.Source.WEBHOOK,
                changes={
                    "operation": (
                        "focus_webhook_failed"
                        if event.status == event.Status.FAILED
                        else "focus_webhook_ignored"
                    ),
                    "provider_event": event.provider_event,
                },
            )
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
