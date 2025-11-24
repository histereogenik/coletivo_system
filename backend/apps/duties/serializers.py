from rest_framework import serializers

from apps.duties.models import Duty
from apps.users.models import Member


class DutySerializer(serializers.ModelSerializer):
    members = serializers.PrimaryKeyRelatedField(
        queryset=Member.objects.all(),
        many=True,
        required=False,
        allow_empty=True,
    )

    class Meta:
        model = Duty
        fields = [
            "id",
            "name",
            "remuneration_cents",
            "members",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_name(self, value: str) -> str:
        cleaned = value.strip()
        if len(cleaned) < 2:
            raise serializers.ValidationError("Nome da função deve ter pelo menos 2 caracteres.")
        return cleaned

    def validate_remuneration_cents(self, value: int) -> int:
        if value < 0:
            raise serializers.ValidationError("Remuneração não pode ser negativa.")
        return value
