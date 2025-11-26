from rest_framework import serializers

from apps.common.roles import promote_role
from apps.financial.models import FinancialEntry
from apps.lunch.models import Lunch
from apps.users.models import Member


class LunchSerializer(serializers.ModelSerializer):
    member = serializers.PrimaryKeyRelatedField(queryset=Member.objects.all())
    member_name = serializers.CharField(source="member.full_name", read_only=True)
    remaining_quantity = serializers.IntegerField(read_only=True)

    class Meta:
        model = Lunch
        fields = [
            "id",
            "member",
            "member_name",
            "value_cents",
            "date",
            "lunch_type",
            "payment_status",
            "quantity",
            "remaining_quantity",
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
        quantity = (
            attrs.get("quantity")
            if "quantity" in attrs
            else getattr(self.instance, "quantity", None)
        )
        package_expiration = (
            attrs.get("package_expiration")
            if "package_expiration" in attrs
            else getattr(self.instance, "package_expiration", None)
        )
        package_status = (
            attrs.get("package_status")
            if "package_status" in attrs
            else getattr(self.instance, "package_status", None)
        )

        if lunch_type == Lunch.LunchType.PACOTE:
            errors = {}
            if not quantity:
                errors["quantity"] = "Quantidade é obrigatória para pacote."
            if not package_expiration:
                errors["package_expiration"] = "Validade do pacote é obrigatória."
            if not package_status:
                errors["package_status"] = "Status do pacote é obrigatório."
            # Keep remaining_quantity within bounds when updating.
            remaining_quantity = (
                attrs.get("remaining_quantity")
                if "remaining_quantity" in attrs
                else getattr(self.instance, "remaining_quantity", None)
            )
            if (
                remaining_quantity is not None
                and quantity is not None
                and remaining_quantity > quantity
            ):
                errors["remaining_quantity"] = (
                    "Saldo de refeições não pode exceder a quantidade do pacote."
                )
            if errors:
                raise serializers.ValidationError(errors)
        else:
            # Clear package-only fields for avulso
            attrs["quantity"] = None
            attrs["package_expiration"] = None
            attrs["package_status"] = None
            attrs["remaining_quantity"] = None

        return attrs

    def create(self, validated_data):
        if validated_data.get("lunch_type") == Lunch.LunchType.PACOTE:
            validated_data.setdefault("remaining_quantity", validated_data.get("quantity"))
        instance = super().create(validated_data)
        if instance.lunch_type == Lunch.LunchType.PACOTE:
            promote_role(instance.member, Member.Role.MENSALISTA)
        self._sync_financial_entry(instance, prev_status=None, prev_value=None, prev_date=None)
        return instance

    def update(self, instance, validated_data):
        if validated_data.get("lunch_type") == Lunch.LunchType.PACOTE:
            validated_data.setdefault("remaining_quantity", validated_data.get("quantity"))
        prev_status = instance.payment_status
        prev_value = instance.value_cents
        prev_date = instance.date
        instance = super().update(instance, validated_data)
        self._sync_financial_entry(instance, prev_status=prev_status, prev_value=prev_value, prev_date=prev_date)
        return instance

    def _sync_financial_entry(self, instance, prev_status, prev_value, prev_date):
        entry = getattr(instance, "financial_entry", None)
        is_paid_now = instance.payment_status == Lunch.PaymentStatus.PAGO
        was_paid = prev_status == Lunch.PaymentStatus.PAGO

        if is_paid_now:
            description = f"Pagamento almoço - {instance.member.full_name} - {instance.date}"
            if entry:
                if (prev_value != instance.value_cents) or (prev_date != instance.date) or (
                    entry.description != description
                ):
                    entry.value_cents = instance.value_cents
                    entry.date = instance.date
                    entry.description = description
                    entry.entry_type = FinancialEntry.EntryType.ENTRADA
                    entry.category = FinancialEntry.EntryCategory.ALMOCO
                    entry.save()
            else:
                FinancialEntry.objects.create(
                    entry_type=FinancialEntry.EntryType.ENTRADA,
                    category=FinancialEntry.EntryCategory.ALMOCO,
                    description=description,
                    value_cents=instance.value_cents,
                    date=instance.date,
                    lunch=instance,
                )
        elif was_paid and entry:
            entry.delete()
