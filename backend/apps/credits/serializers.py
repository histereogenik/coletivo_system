from rest_framework import serializers

from apps.common.validators import validate_text_length
from apps.credits.models import CreditEntry
from apps.credits.services import get_credit_summary
from apps.users.models import Member


class CreditEntrySerializer(serializers.ModelSerializer):
    owner_name = serializers.CharField(source="owner.full_name", read_only=True)
    beneficiary_name = serializers.CharField(source="beneficiary.full_name", read_only=True)
    created_by_username = serializers.CharField(source="created_by.username", read_only=True)

    class Meta:
        model = CreditEntry
        fields = [
            "id",
            "owner",
            "owner_name",
            "beneficiary",
            "beneficiary_name",
            "entry_type",
            "origin",
            "value_cents",
            "description",
            "agenda_entry",
            "lunch",
            "created_by",
            "created_by_username",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "created_by"]


class ManualCreditEntrySerializer(serializers.Serializer):
    owner = serializers.PrimaryKeyRelatedField(queryset=Member.objects.all())
    beneficiary = serializers.PrimaryKeyRelatedField(
        queryset=Member.objects.all(),
        required=False,
        allow_null=True,
    )
    value_cents = serializers.IntegerField(min_value=1)
    description = serializers.CharField()

    def validate_description(self, value: str) -> str:
        normalized = (validate_text_length(value, field_label="Descrição") or "").strip()
        if not normalized:
            raise serializers.ValidationError("Descrição é obrigatória.")
        return normalized


class CreditSummarySerializer(serializers.Serializer):
    owner = serializers.IntegerField()
    owner_name = serializers.CharField()
    credits_cents = serializers.IntegerField()
    debits_cents = serializers.IntegerField()
    balance_cents = serializers.IntegerField()

    @classmethod
    def from_member(cls, member: Member) -> dict:
        summary = get_credit_summary(member.id)
        return {
            "owner": member.id,
            "owner_name": member.full_name,
            **summary,
        }

