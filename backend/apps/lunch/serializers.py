from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from apps.common.roles import promote_role
from apps.financial.models import FinancialEntry
from apps.lunch.models import Lunch, Package
from apps.users.models import Member


class PackageSerializer(serializers.ModelSerializer):
    member = serializers.PrimaryKeyRelatedField(queryset=Member.objects.all())
    member_name = serializers.CharField(source="member.full_name", read_only=True)
    unit_value_cents = serializers.IntegerField(required=False)

    class Meta:
        model = Package
        fields = [
            "id",
            "member",
            "member_name",
            "value_cents",
            "unit_value_cents",
            "date",
            "payment_status",
            "payment_mode",
            "quantity",
            "remaining_quantity",
            "expiration",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
        extra_kwargs = {
            "remaining_quantity": {"required": False},
            "status": {"required": False},
        }

    def validate(self, attrs):
        unit_value_cents = (
            attrs.get("unit_value_cents")
            if "unit_value_cents" in attrs
            else getattr(self.instance, "unit_value_cents", None)
        )
        quantity = (
            attrs.get("quantity")
            if "quantity" in attrs
            else getattr(self.instance, "quantity", None)
        )
        value_cents = (
            attrs.get("value_cents")
            if "value_cents" in attrs
            else getattr(self.instance, "value_cents", None)
        )
        remaining_quantity = (
            attrs.get("remaining_quantity")
            if "remaining_quantity" in attrs
            else getattr(self.instance, "remaining_quantity", None)
        )
        expiration = (
            attrs.get("expiration")
            if "expiration" in attrs
            else getattr(self.instance, "expiration", None)
        )

        errors = {}
        if not quantity:
            errors["quantity"] = "Quantidade é obrigatória para pacote."
        if not expiration:
            errors["expiration"] = "Validade do pacote é obrigatória."
        if unit_value_cents is None and value_cents is None:
            errors["unit_value_cents"] = "Informe o valor do almoço."
        if unit_value_cents is not None:
            if unit_value_cents < 0:
                errors["unit_value_cents"] = "Valor deve ser maior ou igual a zero."
            elif quantity:
                expected_total = unit_value_cents * quantity
                if value_cents is not None and value_cents != expected_total:
                    errors["value_cents"] = "Valor total deve corresponder ao valor do almoço."
                attrs["unit_value_cents"] = unit_value_cents
                attrs["value_cents"] = expected_total
        elif value_cents is not None and value_cents < 0:
            errors["value_cents"] = "Valor deve ser maior ou igual a zero."
        elif (
            unit_value_cents is None
            and "quantity" in attrs
            and self.instance
            and self.instance.quantity
        ):
            inferred_unit = self.instance.unit_value_cents
            attrs["unit_value_cents"] = inferred_unit
            attrs["value_cents"] = inferred_unit * quantity
        if remaining_quantity is None:
            remaining_quantity = quantity
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

        if expiration:
            today = timezone.localdate()
            attrs["status"] = (
                Package.PackageStatus.EXPIRADO
                if expiration < today
                else Package.PackageStatus.VALIDO
            )

        attrs["remaining_quantity"] = remaining_quantity
        return attrs

    def create(self, validated_data):
        instance = super().create(validated_data)
        promote_role(instance.member, Member.Role.MENSALISTA)
        self._sync_financial_entry(instance, prev_status=None, prev_value=None, prev_date=None)
        return instance

    def update(self, instance, validated_data):
        prev_status = instance.payment_status
        prev_value = instance.value_cents
        prev_date = instance.date
        instance = super().update(instance, validated_data)
        self._sync_financial_entry(
            instance, prev_status=prev_status, prev_value=prev_value, prev_date=prev_date
        )
        return instance

    def _sync_financial_entry(self, instance, prev_status, prev_value, prev_date):
        entry = getattr(instance, "financial_entry", None)
        is_paid_now = instance.payment_status == Package.PaymentStatus.PAGO
        was_paid = prev_status == Package.PaymentStatus.PAGO

        if is_paid_now and instance.value_cents > 0:
            description = f"Pagamento pacote - {instance.member.full_name} - {instance.date}"
            if entry:
                if (
                    (prev_value != instance.value_cents)
                    or (prev_date != instance.date)
                    or (entry.description != description)
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
                    package=instance,
                )
        elif was_paid and entry:
            entry.delete()


class LunchSerializer(serializers.ModelSerializer):
    member = serializers.PrimaryKeyRelatedField(queryset=Member.objects.all())
    member_name = serializers.CharField(source="member.full_name", read_only=True)
    package = serializers.PrimaryKeyRelatedField(
        queryset=Package.objects.all(),
        required=False,
        allow_null=True,
    )
    use_package = serializers.BooleanField(write_only=True, required=False, default=False)
    package_remaining = serializers.IntegerField(
        source="package.remaining_quantity", read_only=True
    )

    class Meta:
        model = Lunch
        fields = [
            "id",
            "member",
            "member_name",
            "package",
            "use_package",
            "package_remaining",
            "value_cents",
            "date",
            "payment_status",
            "payment_mode",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_value_cents(self, value):
        if value < 0:
            raise serializers.ValidationError("Valor deve ser maior ou igual a zero.")
        return value

    def validate(self, attrs):
        member = attrs.get("member") or getattr(self.instance, "member", None)
        package = (
            attrs.get("package") if "package" in attrs else getattr(self.instance, "package", None)
        )
        use_package = attrs.get("use_package", False)
        date = attrs.get("date") or getattr(self.instance, "date", None)

        if use_package and not package:
            if not member or not date:
                raise serializers.ValidationError(
                    {"package": "Informe integrante e data do almoço."}
                )
            package = (
                Package.objects.filter(
                    member=member,
                    remaining_quantity__gt=0,
                    status=Package.PackageStatus.VALIDO,
                    expiration__gte=date,
                )
                .order_by("date", "id")
                .first()
            )
            if not package:
                raise serializers.ValidationError({"package": "Nenhum pacote válido disponível."})
            attrs["package"] = package

        if package and member and package.member_id != member.id:
            raise serializers.ValidationError({"package": "Pacote não pertence ao integrante."})
        if package and package.remaining_quantity <= 0:
            raise serializers.ValidationError({"package": "Pacote sem saldo."})
        if package and date and package.expiration < date:
            raise serializers.ValidationError({"package": "Pacote expirado para a data do almoço."})
        return attrs

    def create(self, validated_data):
        validated_data.pop("use_package", None)
        with transaction.atomic():
            instance = super().create(validated_data)
            if instance.package_id:
                package = instance.package
                if package.remaining_quantity <= 0:
                    raise serializers.ValidationError({"package": "Pacote sem saldo."})
                package.remaining_quantity -= 1
                package.save(update_fields=["remaining_quantity", "updated_at"])
            promote_role(instance.member, Member.Role.MENSALISTA)
            self._sync_financial_entry(instance, prev_status=None, prev_value=None, prev_date=None)
        return instance

    def update(self, instance, validated_data):
        validated_data.pop("use_package", None)
        prev_status = instance.payment_status
        prev_value = instance.value_cents
        prev_date = instance.date
        old_package = instance.package
        new_package = validated_data.get("package", instance.package)
        if old_package and new_package and old_package.id == new_package.id:
            old_package = None
        with transaction.atomic():
            instance = super().update(instance, validated_data)
            if old_package:
                old_package.remaining_quantity += 1
                old_package.save(update_fields=["remaining_quantity", "updated_at"])
            if new_package and (not old_package or new_package.id != old_package.id):
                if new_package.remaining_quantity <= 0:
                    raise serializers.ValidationError({"package": "Pacote sem saldo."})
                new_package.remaining_quantity -= 1
                new_package.save(update_fields=["remaining_quantity", "updated_at"])
            self._sync_financial_entry(
                instance, prev_status=prev_status, prev_value=prev_value, prev_date=prev_date
            )
        return instance

    def _sync_financial_entry(self, instance, prev_status, prev_value, prev_date):
        entry = getattr(instance, "financial_entry", None)
        is_paid_now = instance.payment_status == Lunch.PaymentStatus.PAGO
        was_paid = prev_status == Lunch.PaymentStatus.PAGO

        if is_paid_now and instance.value_cents > 0:
            label = "Pagamento pacote" if instance.package_id else "Pagamento almoço"
            description = f"{label} - {instance.member.full_name} - {instance.date}"
            if entry:
                if (
                    (prev_value != instance.value_cents)
                    or (prev_date != instance.date)
                    or (entry.description != description)
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
