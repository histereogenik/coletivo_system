import re

from rest_framework import serializers

from apps.fiscal.models import FiscalDocument

BRAZIL_STATES = {
    "AC",
    "AL",
    "AP",
    "AM",
    "BA",
    "CE",
    "DF",
    "ES",
    "GO",
    "MA",
    "MT",
    "MS",
    "MG",
    "PA",
    "PB",
    "PR",
    "PE",
    "PI",
    "RJ",
    "RN",
    "RS",
    "RO",
    "RR",
    "SC",
    "SP",
    "SE",
    "TO",
}


def only_digits(value):
    return re.sub(r"\D", "", value or "")


class FiscalAddressSerializer(serializers.Serializer):
    street = serializers.CharField(max_length=60)
    number = serializers.CharField(max_length=60)
    complement = serializers.CharField(max_length=60, required=False, allow_blank=True)
    district = serializers.CharField(max_length=60)
    city = serializers.CharField(max_length=60)
    state = serializers.CharField(min_length=2, max_length=2)
    postal_code = serializers.CharField()

    def validate_state(self, value):
        value = value.upper()
        if value not in BRAZIL_STATES:
            raise serializers.ValidationError("Informe uma UF brasileira válida.")
        return value

    def validate_postal_code(self, value):
        value = only_digits(value)
        if len(value) != 8:
            raise serializers.ValidationError("CEP deve possuir 8 dígitos.")
        return value


class FiscalRecipientSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=60, required=False, allow_blank=True)
    tax_id = serializers.CharField(required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    state_registration_indicator = serializers.ChoiceField(
        choices=("1", "2", "9"), required=False, default="9"
    )
    state_registration = serializers.CharField(max_length=20, required=False, allow_blank=True)
    address = FiscalAddressSerializer(required=False)

    def validate_tax_id(self, value):
        value = only_digits(value)
        if value and len(value) not in (11, 14):
            raise serializers.ValidationError("CPF deve ter 11 dígitos e CNPJ, 14 dígitos.")
        return value

    def validate_state_registration(self, value):
        value = only_digits(value)
        if value and len(value) not in range(2, 15):
            raise serializers.ValidationError("Inscrição estadual deve possuir de 2 a 14 dígitos.")
        return value

    def validate(self, attrs):
        tax_id = attrs.get("tax_id", "")
        if len(tax_id) == 14:
            missing = {}
            if not attrs.get("name"):
                missing["name"] = "Razão social é obrigatória para NF-e."
            if not attrs.get("address"):
                missing["address"] = "Endereço estruturado é obrigatório para NF-e."
            indicator = attrs.get("state_registration_indicator", "9")
            if indicator == "1" and not attrs.get("state_registration"):
                missing["state_registration"] = (
                    "Inscrição estadual é obrigatória para contribuinte de ICMS."
                )
            if indicator == "2" and attrs.get("state_registration"):
                missing["state_registration"] = (
                    "Não informe inscrição estadual quando o destinatário for isento."
                )
            if missing:
                raise serializers.ValidationError(missing)
        elif attrs.get("state_registration") or attrs.get("address"):
            raise serializers.ValidationError(
                "Inscrição estadual e endereço estruturado são usados somente na NF-e para CNPJ."
            )
        return attrs


class FiscalEmissionSerializer(serializers.Serializer):
    source_type = serializers.ChoiceField(choices=("LUNCH", "PACKAGE"))
    source_id = serializers.IntegerField(min_value=1)
    recipient = FiscalRecipientSerializer(required=False, default=dict)
    presence = serializers.ChoiceField(choices=(0, 1, 2, 3, 4, 9), required=False, default=1)


class FiscalDocumentSerializer(serializers.ModelSerializer):
    source_type = serializers.CharField(read_only=True)
    source_id = serializers.IntegerField(read_only=True)
    created_by_name = serializers.CharField(source="created_by.get_username", read_only=True)

    class Meta:
        model = FiscalDocument
        fields = [
            "id",
            "reference",
            "document_type",
            "environment",
            "status",
            "source_type",
            "source_id",
            "sale_date",
            "recipient",
            "items",
            "payment_methods",
            "focus_status",
            "number",
            "series",
            "access_key",
            "protocol",
            "xml_url",
            "danfe_url",
            "sefaz_code",
            "error_message",
            "emitted_at",
            "authorized_at",
            "created_by",
            "created_by_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields
