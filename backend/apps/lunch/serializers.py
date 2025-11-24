from rest_framework import serializers

from apps.lunch.models import Lunch
from apps.users.models import Member


class LunchSerializer(serializers.ModelSerializer):
    member = serializers.PrimaryKeyRelatedField(queryset=Member.objects.all())

    class Meta:
        model = Lunch
        fields = [
            "id",
            "member",
            "value_cents",
            "date",
            "lunch_type",
            "payment_status",
            "quantity",
            "package_expiration",
            "package_status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_value_cents(self, value):
        if value <= 0:
            raise serializers.ValidationError("Valor deve ser maior que zero.")
        return value

    def validate(self, attrs):
        lunch_type = attrs.get("lunch_type") or getattr(self.instance, "lunch_type", None)
        quantity = attrs.get("quantity") if "quantity" in attrs else getattr(self.instance, "quantity", None)
        package_expiration = (
            attrs.get("package_expiration")
            if "package_expiration" in attrs
            else getattr(self.instance, "package_expiration", None)
        )
        package_status = (
            attrs.get("package_status") if "package_status" in attrs else getattr(self.instance, "package_status", None)
        )

        if lunch_type == Lunch.LunchType.PACOTE:
            errors = {}
            if not quantity:
                errors["quantity"] = "Quantidade é obrigatória para pacote."
            if not package_expiration:
                errors["package_expiration"] = "Validade do pacote é obrigatória."
            if not package_status:
                errors["package_status"] = "Status do pacote é obrigatório."
            if errors:
                raise serializers.ValidationError(errors)
        else:
            # Clear package-only fields for avulso
            attrs["quantity"] = None
            attrs["package_expiration"] = None
            attrs["package_status"] = None

        return attrs
