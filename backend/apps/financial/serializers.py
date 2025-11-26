from rest_framework import serializers

from apps.financial.models import FinancialEntry

ENTRADA_CATEGORIES = {FinancialEntry.EntryCategory.ALMOCO, FinancialEntry.EntryCategory.DOACAO}
SAIDA_CATEGORIES = {
    FinancialEntry.EntryCategory.NOTA,
    FinancialEntry.EntryCategory.STAFF,
    FinancialEntry.EntryCategory.DESPESA,
    FinancialEntry.EntryCategory.ESTORNO,
}


class FinancialEntrySerializer(serializers.ModelSerializer):
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
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_value_cents(self, value: int) -> int:
        if value <= 0:
            raise serializers.ValidationError("Valor deve ser maior que zero.")
        return value

    def validate(self, attrs):
        entry_type = attrs.get("entry_type") or getattr(self.instance, "entry_type", None)
        category = attrs.get("category") or getattr(self.instance, "category", None)
        if entry_type == FinancialEntry.EntryType.ENTRADA and category not in ENTRADA_CATEGORIES:
            raise serializers.ValidationError({"category": "Categoria não permitida para entrada."})
        if entry_type == FinancialEntry.EntryType.SAIDA and category not in SAIDA_CATEGORIES:
            raise serializers.ValidationError({"category": "Categoria não permitida para saída."})
        return attrs
