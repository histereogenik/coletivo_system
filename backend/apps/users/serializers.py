import re

import phonenumbers
from rest_framework import serializers

from apps.users.models import Member

PHONE_REGEX = re.compile(r"^[0-9+().\-\s]{7,20}$")


class MemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = Member
        fields = [
            "id",
            "full_name",
            "phone",
            "email",
            "address",
            "heard_about",
            "role",
            "diet",
            "observations",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
        extra_kwargs = {
            "full_name": {
                "error_messages": {
                    "required": "Campo obrigatório.",
                    "blank": "Nome não pode ficar em branco.",
                }
            },
            "email": {
                "error_messages": {
                    "required": "Campo obrigatório.",
                    "invalid": "Informe um e-mail válido.",
                }
            },
            "role": {
                "error_messages": {
                    "required": "Campo obrigatório.",
                    "invalid_choice": "Escolha uma opção válida.",
                }
            },
            "diet": {
                "error_messages": {
                    "required": "Campo obrigatório.",
                    "invalid_choice": "Escolha uma opção válida.",
                }
            },
        }

    def validate_full_name(self, value: str) -> str:
        cleaned = value.strip()
        if len(cleaned) < 3:
            raise serializers.ValidationError("Nome completo deve ter pelo menos 3 caracteres.")
        return cleaned

    def validate_email(self, value: str) -> str:
        email = value.lower().strip()
        qs = Member.objects.filter(email__iexact=email)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Já existe um membro com este e-mail.")
        return email

    def validate_phone(self, value: str) -> str:
        if not value:
            return value

        # Se começar com "+", assume formato internacional; caso contrário, tenta BR como padrão.
        region = None if value.strip().startswith("+") else "BR"
        try:
            parsed = phonenumbers.parse(value, region)
        except phonenumbers.NumberParseException as exc:
            raise serializers.ValidationError(
                "Telefone inválido. Use o formato internacional com código do país."
            ) from exc

        if not phonenumbers.is_valid_number(parsed):
            raise serializers.ValidationError(
                "Telefone inválido. Use o formato internacional com código do país."
            )

        return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)

    def validate(self, attrs):
        # Ensure role/diet provided; choices safeguard values but we confirm presence.
        for field in ("role", "diet"):
            if not attrs.get(field) and not getattr(self.instance, field, None):
                raise serializers.ValidationError({field: "Este campo é obrigatório."})
        return attrs
