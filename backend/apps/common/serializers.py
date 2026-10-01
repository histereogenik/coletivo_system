from rest_framework import serializers

from apps.common.models import AuditEvent


class AuditEventSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()
    action_label = serializers.CharField(source="get_action_display", read_only=True)

    class Meta:
        model = AuditEvent
        fields = [
            "id",
            "actor",
            "actor_name",
            "action",
            "action_label",
            "source",
            "entity_type",
            "object_id",
            "object_repr",
            "changes",
            "ip_address",
            "created_at",
        ]

    def get_actor_name(self, instance):
        if not instance.actor:
            return "Sistema ou usuário removido"
        return instance.actor.get_full_name() or instance.actor.get_username()
