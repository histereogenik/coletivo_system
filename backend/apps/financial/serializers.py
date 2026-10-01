from rest_framework import serializers

from apps.common.validators import validate_text_length
from apps.financial.models import FinancialEntry

ENTRADA_CATEGORIES = {FinancialEntry.EntryCategory.ALMOCO, FinancialEntry.EntryCategory.DOACAO}
SAIDA_CATEGORIES = {
    FinancialEntry.EntryCategory.NOTA,
    FinancialEntry.EntryCategory.STAFF,
    FinancialEntry.EntryCategory.DESPESA,
    FinancialEntry.EntryCategory.ESTORNO,
}


class FinancialEntrySerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source="created_by.get_username", read_only=True)
    updated_by_name = serializers.CharField(source="updated_by.get_username", read_only=True)

    class Meta:
        model = FinancialEntry
        fields = [
            "id",
            "entry_type",
            "category",
            "description",
            "value_cents",
            "date",
            "created_at",
            "updated_at",
            "created_by",
            "created_by_name",
            "updated_by",
            "updated_by_name",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
            "created_by",
            "created_by_name",
            "updated_by",
            "updated_by_name",
        ]

    def validate_value_cents(self, value: int) -> int:
        if value <= 0:
            raise serializers.ValidationError("Valor deve ser maior que zero.")
        return value

    def validate_description(self, value: str) -> str:
        return validate_text_length(value, field_label="Descrição") or ""

    def validate(self, attrs):
        entry_type = attrs.get("entry_type") or getattr(self.instance, "entry_type", None)
        category = attrs.get("category") or getattr(self.instance, "category", None)
        if entry_type == FinancialEntry.EntryType.ENTRADA and category not in ENTRADA_CATEGORIES:
            raise serializers.ValidationError({"category": "Categoria não permitida para entrada."})
        if entry_type == FinancialEntry.EntryType.SAIDA and category not in SAIDA_CATEGORIES:
            raise serializers.ValidationError({"category": "Categoria não permitida para saída."})
        return attrs
