from ipaddress import ip_address

from django.conf import settings
from django.forms.models import model_to_dict
from django.db import transaction

from apps.common.models import AuditEvent

EXCLUDED_FIELDS = {
    "password",
    "token",
    "secret",
    "email",
    "phone",
    "address",
    "observation",
    "review_notes",
    "recipient",
    "payload",
    "items",
    "payment_methods",
}


def _safe_value(value):
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    if isinstance(value, (list, tuple, set)):
        return [str(item) for item in value]
    return str(value)


def snapshot(instance) -> dict:
    values = model_to_dict(instance)
    return {
        key: _safe_value(value)
        for key, value in values.items()
        if not any(fragment in key.lower() for fragment in EXCLUDED_FIELDS)
    }


def changed_values(before: dict, after: dict) -> dict:
    return {
        key: {"before": before.get(key), "after": after.get(key)}
        for key in sorted(set(before) | set(after))
        if before.get(key) != after.get(key)
    }


def request_metadata(request) -> dict:
    def valid_ip(value):
        if not value:
            return None
        try:
            return str(ip_address(value.strip()))
        except ValueError:
            return None

    remote_address = valid_ip(request.META.get("REMOTE_ADDR"))
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR", "")
    trusted_proxies = {valid_ip(value) for value in settings.AUDIT_TRUSTED_PROXY_IPS}
    trusted_proxies.discard(None)
    client_ip = remote_address
    if remote_address in trusted_proxies and forwarded_for:
        client_ip = valid_ip(forwarded_for.split(",")[0]) or remote_address
    return {
        "request_id": request.headers.get("X-Request-ID", "")[:100],
        "ip_address": client_ip,
        "user_agent": request.headers.get("User-Agent", "")[:255],
    }


def record_audit_event(*, request, instance, action, changes=None, source=AuditEvent.Source.UI):
    return AuditEvent.objects.create(
        actor=request.user if request.user.is_authenticated else None,
        action=action,
        source=source,
        entity_type=instance._meta.label,
        object_id=str(instance.pk),
        object_repr=str(instance)[:255],
        changes=changes or {},
        **request_metadata(request),
    )


class AuthoredAuditViewSetMixin:
    def perform_create(self, serializer):
        with transaction.atomic():
            instance = serializer.save(created_by=self.request.user, updated_by=self.request.user)
            record_audit_event(
                request=self.request,
                instance=instance,
                action=AuditEvent.Action.CREATE,
                changes={"created": snapshot(instance)},
            )

    def perform_update(self, serializer):
        with transaction.atomic():
            before = snapshot(serializer.instance)
            instance = serializer.save(updated_by=self.request.user)
            record_audit_event(
                request=self.request,
                instance=instance,
                action=AuditEvent.Action.UPDATE,
                changes=changed_values(before, snapshot(instance)),
            )

    def perform_destroy(self, instance):
        with transaction.atomic():
            record_audit_event(
                request=self.request,
                instance=instance,
                action=AuditEvent.Action.DELETE,
                changes={"deleted": snapshot(instance)},
            )
            instance.delete()
