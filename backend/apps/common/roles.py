from apps.users.models import Member


ROLE_PRIORITY = {
    Member.Role.AVULSO: 0,
    Member.Role.MENSALISTA: 1,
    Member.Role.SUSTENTADOR: 2,
}


def promote_role(member: Member, target: str) -> Member:
    """
    Promote a member to the target role if it has higher priority than the current one.
    Returns the (possibly updated) member instance.
    """
    current_priority = ROLE_PRIORITY.get(member.role, 0)
    target_priority = ROLE_PRIORITY.get(target, 0)
    if target_priority > current_priority:
        member.role = target
        member.save(update_fields=["role"])
    return member
