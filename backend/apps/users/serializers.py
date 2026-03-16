import phonenumbers
from django.utils import timezone
from rest_framework import serializers

from apps.users.models import Member, PublicRegistration, PublicRegistrationChild


def validate_full_name_value(value: str, field_label: str = "Nome completo") -> str:
    cleaned = value.strip()
    if len(cleaned) < 3:
        raise serializers.ValidationError(f"{field_label} deve ter pelo menos 3 caracteres.")
    return cleaned


def normalize_email_value(
    value: str | None,
    *,
    member_instance: Member | None = None,
    registration_instance: PublicRegistration | None = None,
    check_pending_registrations: bool = False,
) -> str | None:
    if value in (None, ""):
        return None

    email = value.lower().strip()

    member_qs = Member.objects.filter(email__iexact=email)
    if member_instance:
        member_qs = member_qs.exclude(pk=member_instance.pk)
    if member_qs.exists():
        raise serializers.ValidationError("Já existe um integrante com este e-mail.")

    if check_pending_registrations:
        registration_qs = PublicRegistration.objects.filter(
            email__iexact=email,
            status=PublicRegistration.Status.PENDENTE,
        )
        if registration_instance:
            registration_qs = registration_qs.exclude(pk=registration_instance.pk)
        if registration_qs.exists():
            raise serializers.ValidationError(
                "Já existe uma inscrição pendente com este e-mail."
            )

    return email


def normalize_phone_value(value: str | None) -> str | None:
    if not value or value.strip() in {"", "+"}:
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
        return validate_full_name_value(value)

    def validate_email(self, value: str | None):
        return normalize_email_value(value, member_instance=self.instance)

    def validate_phone(self, value: str | None):
        return normalize_phone_value(value)

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


class PublicRegistrationChildSerializer(serializers.ModelSerializer):
    class Meta:
        model = PublicRegistrationChild
        fields = ["id", "full_name", "diet", "observations", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]
        extra_kwargs = {
            "diet": {
                "error_messages": {
                    "required": "Este campo é obrigatório.",
                    "invalid_choice": "Escolha uma opção válida.",
                }
            }
        }

    def validate_full_name(self, value: str) -> str:
        return validate_full_name_value(value, field_label="Nome da criança")


class PublicRegistrationSubmitSerializer(serializers.ModelSerializer):
    children = PublicRegistrationChildSerializer(many=True, required=False)

    class Meta:
        model = PublicRegistration
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
            "children",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
        extra_kwargs = {
            "email": {"required": False, "allow_null": True, "allow_blank": True},
            "phone": {"required": False, "allow_null": True, "allow_blank": True},
            "role": {
                "error_messages": {
                    "required": "Este campo é obrigatório.",
                    "invalid_choice": "Escolha uma opção válida.",
                }
            },
            "diet": {
                "error_messages": {
                    "required": "Este campo é obrigatório.",
                    "invalid_choice": "Escolha uma opção válida.",
                }
            },
        }

    def validate_full_name(self, value: str) -> str:
        return validate_full_name_value(value)

    def validate_email(self, value: str | None):
        return normalize_email_value(value, check_pending_registrations=True)

    def validate_phone(self, value: str | None):
        return normalize_phone_value(value)

    def create(self, validated_data):
        children_data = validated_data.pop("children", [])
        validated_data["status"] = PublicRegistration.Status.PENDENTE
        registration = PublicRegistration.objects.create(**validated_data)
        for child_data in children_data:
            PublicRegistrationChild.objects.create(registration=registration, **child_data)
        return registration


class PublicRegistrationAdminSerializer(serializers.ModelSerializer):
    children = PublicRegistrationChildSerializer(many=True, read_only=True)

    class Meta:
        model = PublicRegistration
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
            "status",
            "review_notes",
            "children",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class PublicRegistrationRejectSerializer(serializers.Serializer):
    review_notes = serializers.CharField(required=False, allow_blank=True)
