import re

import phonenumbers
from django.utils import timezone
from rest_framework import serializers

from apps.users.models import Member

PHONE_REGEX = re.compile(r"^[0-9+().\-\s]{7,20}$")


class MemberSerializer(serializers.ModelSerializer):
    responsible_name = serializers.SerializerMethodField(read_only=True)
    has_package = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Member
        fields = [
            "id",
            "full_name",
            "is_child",
            "responsible",
            "responsible_name",
            "phone",
            "email",
            "address",
            "heard_about",
            "role",
            "diet",
            "observations",
            "has_package",
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
            "email": {"required": False, "allow_null": True, "allow_blank": True},
            "responsible": {"required": False, "allow_null": True},
            "role": {
                "required": False,
                "allow_null": True,
                "error_messages": {
                    "required": "Campo obrigatório.",
                    "invalid_choice": "Escolha uma opção válida.",
                },
            },
            "diet": {
                "required": False,
                "error_messages": {
                    "required": "Campo obrigatório.",
                    "invalid_choice": "Escolha uma opção válida.",
                },
            },
        }

    def validate_full_name(self, value: str) -> str:
        cleaned = value.strip()
        if len(cleaned) < 3:
            raise serializers.ValidationError("Nome completo deve ter pelo menos 3 caracteres.")
        return cleaned

    def validate_email(self, value: str):
        if value in (None, ""):
            return None
        email = value.lower().strip()
        qs = Member.objects.filter(email__iexact=email)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Já existe um membro com este e-mail.")
        return email

    def validate_phone(self, value: str):
        if not value or value.strip() in {"+", ""}:
            return None
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

    def get_responsible_name(self, obj: Member):
        return obj.responsible.full_name if obj.responsible else None

    def get_has_package(self, obj: Member) -> bool:
        from apps.lunch.models import Package

        today = timezone.localdate()
        return obj.packages.filter(
            remaining_quantity__gt=0,
            status=Package.PackageStatus.VALIDO,
            expiration__gte=today,
        ).exists()

    def validate(self, attrs):
        is_child = attrs.get("is_child", getattr(self.instance, "is_child", False))
        responsible = attrs.get("responsible", getattr(self.instance, "responsible", None))

        errors = {}
        if is_child:
            if not responsible:
                errors["responsible"] = "Selecione um responsável."
            # For children, clear optional fields
            attrs["email"] = None
            attrs["phone"] = None
            attrs["heard_about"] = ""
            attrs["role"] = None
        else:
            attrs["responsible"] = None
            role_value = attrs.get("role", getattr(self.instance, "role", None))
            if not role_value:
                errors["role"] = "Este campo é obrigatório."

        diet_value = attrs.get("diet", getattr(self.instance, "diet", None))
        if not diet_value:
            errors["diet"] = "Este campo é obrigatório."

        if errors:
            raise serializers.ValidationError(errors)
        return attrs
