from rest_framework import serializers

from apps.duties.models import Duty
from apps.users.models import Member


class MemberSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Member
        fields = ["id", "full_name"]


class DutySerializer(serializers.ModelSerializer):
    members = MemberSummarySerializer(many=True, read_only=True)
    member_ids = serializers.PrimaryKeyRelatedField(
        queryset=Member.objects.all(),
        many=True,
        write_only=True,
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
            "member_ids",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "members"]

    def validate_name(self, value: str) -> str:
        cleaned = value.strip()
        if len(cleaned) < 2:
            raise serializers.ValidationError("Nome da função deve ter pelo menos 2 caracteres.")
        return cleaned

    def validate_remuneration_cents(self, value: int) -> int:
        if value < 0:
            raise serializers.ValidationError("Remuneração não pode ser negativa.")
        return value

    def create(self, validated_data):
        members = validated_data.pop("members", [])
        member_ids = validated_data.pop("member_ids", [])
        duty = super().create(validated_data)
        if member_ids:
            duty.members.set(member_ids)
        return duty

    def update(self, instance, validated_data):
        member_ids = validated_data.pop("member_ids", None)
        duty = super().update(instance, validated_data)
        if member_ids is not None:
            duty.members.set(member_ids)
        return duty
