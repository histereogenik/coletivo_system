from apps.common.audit import record_audit_event
from apps.common.models import AuditEvent
from apps.users.models import Member

ROLE_PRIORITY = {
    Member.Role.AVULSO: 0,
    Member.Role.MENSALISTA: 1,
    Member.Role.SUSTENTADOR: 2,
}


def promote_role(member: Member, target: str, *, actor=None, request=None) -> Member:
    """
    Promote a member to the target role if it has higher priority than the current one.
    Returns the (possibly updated) member instance.
    """
    current_priority = ROLE_PRIORITY.get(member.role, 0)
    target_priority = ROLE_PRIORITY.get(target, 0)
    if target_priority > current_priority:
        previous_role = member.role
        member.role = target
        update_fields = ["role", "updated_at"]
        if actor is not None:
            member.updated_by = actor
            update_fields.append("updated_by")
        member.save(update_fields=update_fields)
        if request is not None:
            record_audit_event(
                request=request,
                instance=member,
                action=AuditEvent.Action.UPDATE,
                changes={
                    "operation": "automatic_role_promotion",
                    "role": {"before": previous_role, "after": target},
                },
            )
    return member
