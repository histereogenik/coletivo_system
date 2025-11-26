from rest_framework import serializers

from apps.agenda.models import AgendaEntry
from apps.common.roles import promote_role
from apps.duties.models import Duty
from apps.users.models import Member


class MemberSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Member
        fields = ["id", "full_name"]


class AgendaEntrySerializer(serializers.ModelSerializer):
    duty = serializers.PrimaryKeyRelatedField(queryset=Duty.objects.all())
    duty_name = serializers.CharField(source="duty.name", read_only=True)
    members = MemberSummarySerializer(many=True, read_only=True)
    member_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
        allow_empty=True,
    )
    members_input = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
        allow_empty=True,
    )

    class Meta:
        model = AgendaEntry
        fields = [
            "id",
            "date",
            "start_time",
            "end_time",
            "duty",
            "duty_name",
            "status",
            "notes",
            "members",
            "member_ids",
            "members_input",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "members", "duty_name"]

    def validate(self, attrs):
        start = attrs.get("start_time") or getattr(self.instance, "start_time", None)
        end = attrs.get("end_time") or getattr(self.instance, "end_time", None)
        if start and end and end <= start:
            raise serializers.ValidationError(
                {"end_time": "Horário de término deve ser após o início."}
            )

        selected_ids = None
        if "member_ids" in attrs:
            selected_ids = attrs.get("member_ids")
            attrs.pop("member_ids", None)
        elif "members_input" in attrs:
            selected_ids = attrs.get("members_input")
            attrs.pop("members_input", None)

        if selected_ids is not None:
            members = list(Member.objects.filter(id__in=selected_ids))
            found_ids = {m.id for m in members}
            missing_ids = [mid for mid in selected_ids if mid not in found_ids]
            if missing_ids:
                raise serializers.ValidationError(
                    {
                        "member_ids": "Alguns IDs de membros não existem.",
                        "members_input": "Alguns IDs de membros não existem.",
                        "member_ids_invalid": missing_ids,
                    }
                )
            attrs["_selected_members"] = members
        else:
            attrs["_selected_members"] = None

        # Check overlapping schedules for selected members on the same date.
        date = attrs.get("date") or getattr(self.instance, "date", None)
        selected_members = attrs.get("_selected_members")
        new_start = start
        new_end = end or start
        conflicts = []
        if date and selected_members:
            for member in selected_members:
                qs = AgendaEntry.objects.filter(date=date, members=member)
                if self.instance:
                    qs = qs.exclude(pk=self.instance.pk)
                for existing in qs:
                    existing_start = existing.start_time
                    existing_end = existing.end_time or existing.start_time
                    # overlap if not (new_end <= existing_start or existing_end <= new_start)
                    if not (new_end <= existing_start or existing_end <= new_start):
                        conflicts.append({"member": member.id, "agenda_entry": existing.id})
            if conflicts:
                raise serializers.ValidationError(
                    {
                        "member_ids": "Conflito de horário para um ou mais membros.",
                        "member_conflicts": conflicts,
                    }
                )
        return attrs

    def _sync_members(self, instance, selected):
        if selected is not None:
            instance.members.set(selected)
            for m in instance.members.all():
                promote_role(m, Member.Role.SUSTENTADOR)

    def create(self, validated_data):
        selected_members = validated_data.pop("_selected_members", None)
        instance = super().create(validated_data)
        if selected_members:
            self._sync_members(instance, selected_members)
            instance.duty.members.add(*selected_members)
            for m in selected_members:
                promote_role(m, Member.Role.SUSTENTADOR)
        return instance

    def update(self, instance, validated_data):
        selected_members = validated_data.pop("_selected_members", None)
        instance = super().update(instance, validated_data)
        if selected_members is not None:
            self._sync_members(instance, selected_members)
            instance.duty.members.add(*selected_members)
            for m in selected_members:
                promote_role(m, Member.Role.SUSTENTADOR)
        return instance
