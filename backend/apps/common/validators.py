from rest_framework import serializers

from apps.common.text_limits import MAX_TEXT_LENGTH


def validate_text_length(
    value: str | None,
    *,
    field_label: str,
    max_length: int = MAX_TEXT_LENGTH,
) -> str | None:
    if value is None:
        return None

    cleaned = value.strip()
    if len(cleaned) > max_length:
        raise serializers.ValidationError(
            f"{field_label} deve ter no máximo {max_length} caracteres."
        )

    return cleaned
