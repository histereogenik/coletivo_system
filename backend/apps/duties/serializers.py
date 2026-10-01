from rest_framework import serializers

from apps.common.roles import promote_role
from apps.duties.models import Duty
from apps.users.models import Member


class MemberSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Member
        fields = ["id", "full_name"]


class DutyOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Duty
        fields = ["id", "name"]


class DutySerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source="created_by.get_username", read_only=True)
    updated_by_name = serializers.CharField(source="updated_by.get_username", read_only=True)
    members = MemberSummarySerializer(many=True, read_only=True)
    member_ids = serializers.PrimaryKeyRelatedField(
        queryset=Member.objects.all(),
        many=True,
        write_only=True,
        required=False,
        allow_empty=True,
    )
    members_input = serializers.PrimaryKeyRelatedField(
        source="members",
        queryset=Member.objects.all(),
        many=True,
        write_only=True,
        required=False,
        allow_empty=True,
        help_text="Alias para member_ids; aceita lista de IDs.",
    )

    class Meta:
        model = Duty
        fields = [
            "id",
            "name",
            "remuneration_cents",
            "members",
            "member_ids",
            "members_input",
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
            "members",
            "created_by",
            "created_by_name",
            "updated_by",
            "updated_by_name",
        ]

    def validate_name(self, value: str) -> str:
        cleaned = value.strip()
        if len(cleaned) < 2:
            raise serializers.ValidationError("Nome da função deve ter pelo menos 2 caracteres.")
        return cleaned

    def validate_remuneration_cents(self, value: int) -> int:
        if value < 0:
            raise serializers.ValidationError("Remuneração não pode ser negativa.")
        return value

    def _promote_members(self, duty):
        request = self.context.get("request")
        actor = request.user if request and request.user.is_authenticated else None
        for member in duty.members.all():
            promote_role(
                member,
                Member.Role.SUSTENTADOR,
                actor=actor,
                request=request,
            )

    def create(self, validated_data):
        member_ids = validated_data.pop("member_ids", None)
        members_from_alias = validated_data.pop("members", None)  # from members_input
        selected = member_ids if member_ids is not None else members_from_alias
        duty = super().create(validated_data)
        if selected:
            duty.members.set(selected)
            self._promote_members(duty)
        return duty

    def update(self, instance, validated_data):
        member_ids = validated_data.pop("member_ids", None)
        members_from_alias = validated_data.pop("members", None)  # from members_input
        selected = member_ids if member_ids is not None else members_from_alias
        duty = super().update(instance, validated_data)
        if selected is not None:
            duty.members.set(selected)
            self._promote_members(duty)
        return duty
