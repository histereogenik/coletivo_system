from dataclasses import dataclass


@dataclass(frozen=True)
class Capability:
    key: str
    label: str
    permission: str
    route: str


CAPABILITIES = (
    Capability("lunches", "Almoços", "authentication.manage_lunches", "/painel/almocos"),
    Capability("packages", "Pacotes", "authentication.manage_packages", "/painel/pacotes"),
    Capability("financial", "Financeiro", "authentication.manage_financial", "/painel/financeiro"),
    Capability("fiscal", "Notas fiscais", "authentication.manage_fiscal", "/painel/notas-fiscais"),
    Capability("credits", "Trocas e créditos", "authentication.manage_credits", "/painel/creditos"),
    Capability("agenda", "Agenda", "authentication.manage_agenda", "/painel/agenda"),
    Capability("members", "Integrantes", "authentication.manage_members", "/painel/integrantes"),
    Capability("duties", "Funções", "authentication.manage_duties", "/painel/funcoes"),
)

CAPABILITY_BY_KEY = {capability.key: capability for capability in CAPABILITIES}
ALL_CAPABILITY_KEYS = tuple(CAPABILITY_BY_KEY)


def get_user_capabilities(user) -> list[str]:
    if user.is_superuser:
        return list(ALL_CAPABILITY_KEYS)
    return [capability.key for capability in CAPABILITIES if user.has_perm(capability.permission)]


def set_user_capabilities(user, keys: list[str]) -> None:
    from django.contrib.auth.models import Permission

    permission_names = [CAPABILITY_BY_KEY[key].permission.split(".", 1)[1] for key in keys]
    permissions = Permission.objects.filter(
        content_type__app_label="authentication",
        codename__in=permission_names,
    )
    user.user_permissions.set(permissions)
    for cache_name in ("_perm_cache", "_user_perm_cache", "_group_perm_cache"):
        if hasattr(user, cache_name):
            delattr(user, cache_name)
