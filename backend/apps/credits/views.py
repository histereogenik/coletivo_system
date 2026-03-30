import django_filters
from django.db.models import Case, F, IntegerField, Sum, Value, When
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.pagination import DefaultPagination
from apps.common.permissions import SuperuserOnly
from apps.credits.models import CreditEntry
from apps.credits.serializers import (
    CreditEntrySerializer,
    CreditSummaryListSerializer,
    CreditSummarySerializer,
    ManualCreditEntrySerializer,
)
from apps.credits.services import create_manual_credit_entry
from apps.users.models import Member


class CreditEntryFilter(django_filters.FilterSet):
    owner = django_filters.NumberFilter(field_name="owner_id")
    beneficiary = django_filters.NumberFilter(field_name="beneficiary_id")
    origin = django_filters.CharFilter(field_name="origin")
    entry_type = django_filters.CharFilter(field_name="entry_type")
    created_from = django_filters.DateFilter(method="filter_created_from")
    created_to = django_filters.DateFilter(method="filter_created_to")

    class Meta:
        model = CreditEntry
        fields = ["owner", "beneficiary", "origin", "entry_type"]

    def filter_created_from(self, queryset, name, value):
        return queryset.filter(created_at__date__gte=value)

    def filter_created_to(self, queryset, name, value):
        return queryset.filter(created_at__date__lte=value)


class CreditEntryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = CreditEntry.objects.select_related(
        "owner",
        "beneficiary",
        "agenda_entry",
        "lunch",
        "created_by",
    )
    serializer_class = CreditEntrySerializer
    permission_classes = [SuperuserOnly]
    filterset_class = CreditEntryFilter


class CreditSummaryView(APIView):
    permission_classes = [SuperuserOnly]
    pagination_class = DefaultPagination

    def get(self, request):
        owner_id = request.query_params.get("owner")
        if owner_id:
            member = get_object_or_404(Member, pk=owner_id)
            serializer = CreditSummarySerializer(CreditSummarySerializer.from_member(member))
            return Response(serializer.data)

        queryset = Member.objects.filter(credit_entries__isnull=False).annotate(
            credits_cents=Coalesce(
                Sum(
                    Case(
                        When(
                            credit_entries__entry_type=CreditEntry.EntryType.CREDITO,
                            then="credit_entries__value_cents",
                        ),
                        default=Value(0),
                        output_field=IntegerField(),
                    )
                ),
                0,
            ),
            debits_cents=Coalesce(
                Sum(
                    Case(
                        When(
                            credit_entries__entry_type=CreditEntry.EntryType.DEBITO,
                            then="credit_entries__value_cents",
                        ),
                        default=Value(0),
                        output_field=IntegerField(),
                    )
                ),
                0,
            ),
        ).annotate(balance_cents=F("credits_cents") - F("debits_cents"))

        search = (request.query_params.get("search") or "").strip()
        if search:
            queryset = queryset.filter(full_name__icontains=search)

        queryset = queryset.filter(balance_cents__gt=0).order_by("full_name").distinct()

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(queryset, request, view=self)
        serializer = CreditSummaryListSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class ManualCreditCreateView(APIView):
    permission_classes = [SuperuserOnly]
    entry_type = CreditEntry.EntryType.CREDITO

    def post(self, request):
        serializer = ManualCreditEntrySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        entry = create_manual_credit_entry(
            owner=serializer.validated_data["owner"],
            beneficiary=serializer.validated_data.get("beneficiary"),
            value_cents=serializer.validated_data["value_cents"],
            description=serializer.validated_data["description"],
            created_by=request.user,
            entry_type=self.entry_type,
        )
        response = CreditEntrySerializer(entry)
        return Response(response.data, status=status.HTTP_201_CREATED)


class ManualDebitCreateView(ManualCreditCreateView):
    entry_type = CreditEntry.EntryType.DEBITO
