from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Sum
from rest_framework import serializers

from apps.agenda.models import AgendaEntry
from apps.credits.models import CreditEntry
from apps.lunch.models import Lunch
from apps.users.models import Member

User = get_user_model()


def get_credit_summary(owner_id: int, *, exclude_entry_id: int | None = None) -> dict[str, int]:
    queryset = CreditEntry.objects.filter(owner_id=owner_id)
    if exclude_entry_id is not None:
        queryset = queryset.exclude(id=exclude_entry_id)

    credit_total = (
        queryset.filter(entry_type=CreditEntry.EntryType.CREDITO).aggregate(total=Sum("value_cents"))[
            "total"
        ]
        or 0
    )
    debit_total = (
        queryset.filter(entry_type=CreditEntry.EntryType.DEBITO).aggregate(total=Sum("value_cents"))[
            "total"
        ]
        or 0
    )
    return {
        "credits_cents": credit_total,
        "debits_cents": debit_total,
        "balance_cents": credit_total - debit_total,
    }


def get_credit_balance(owner_id: int, *, exclude_entry_id: int | None = None) -> int:
    return get_credit_summary(owner_id, exclude_entry_id=exclude_entry_id)["balance_cents"]


def lock_members(member_ids: list[int] | set[int]) -> None:
    ids = sorted({member_id for member_id in member_ids if member_id})
    if not ids:
        return
    list(Member.objects.select_for_update().filter(id__in=ids).order_by("id"))


def ensure_credit_balance(
    owner_id: int,
    required_cents: int,
    *,
    exclude_entry_id: int | None = None,
    field_name: str = "credit_owner",
) -> None:
    balance = get_credit_balance(owner_id, exclude_entry_id=exclude_entry_id)
    if balance < required_cents:
        raise serializers.ValidationError(
            {field_name: ["Saldo de créditos insuficiente para este lançamento."]}
        )


def sync_agenda_credit_entries(
    agenda_entry: AgendaEntry,
    *,
    actor: User | None = None,
) -> None:
    existing_entries = {
        entry.owner_id: entry
        for entry in CreditEntry.objects.filter(
            agenda_entry=agenda_entry,
            origin=CreditEntry.Origin.AGENDA,
            entry_type=CreditEntry.EntryType.CREDITO,
        ).select_related("owner")
    }

    remuneration_cents = agenda_entry.duty.remuneration_cents
    should_generate = (
        agenda_entry.status == AgendaEntry.Status.CONCLUIDO and remuneration_cents > 0
    )

    if not should_generate:
        for entry in existing_entries.values():
            entry.delete()
        return

    selected_members = list(agenda_entry.members.all())
    desired_owner_ids = {member.id for member in selected_members}

    description = f"Crédito por trabalho - {agenda_entry.duty.name} - {agenda_entry.date}"

    for member in selected_members:
        entry = existing_entries.pop(member.id, None)
        if entry:
            fields_to_update: list[str] = []
            if entry.beneficiary_id != member.id:
                entry.beneficiary = member
                fields_to_update.append("beneficiary")
            if entry.value_cents != remuneration_cents:
                entry.value_cents = remuneration_cents
                fields_to_update.append("value_cents")
            if entry.description != description:
                entry.description = description
                fields_to_update.append("description")
            if actor and entry.created_by_id != actor.id:
                entry.created_by = actor
                fields_to_update.append("created_by")
            if fields_to_update:
                fields_to_update.append("updated_at")
                entry.save(update_fields=fields_to_update)
            continue

        CreditEntry.objects.create(
            owner=member,
            beneficiary=member,
            entry_type=CreditEntry.EntryType.CREDITO,
            origin=CreditEntry.Origin.AGENDA,
            value_cents=remuneration_cents,
            description=description,
            agenda_entry=agenda_entry,
            created_by=actor,
        )

    for owner_id, entry in existing_entries.items():
        if owner_id not in desired_owner_ids:
            entry.delete()


def sync_lunch_credit_entry(
    lunch: Lunch,
    *,
    actor: User | None = None,
) -> None:
    current_entry = getattr(lunch, "credit_entry", None)
    should_use_credit = (
        lunch.payment_mode == Lunch.PaymentMode.TROCA
        and lunch.credit_owner_id is not None
        and lunch.package_id is None
        and lunch.value_cents > 0
    )

    if not should_use_credit:
        if current_entry:
            current_entry.delete()
        return

    owner_ids = {lunch.credit_owner_id}
    if current_entry and current_entry.owner_id:
        owner_ids.add(current_entry.owner_id)

    lock_members(owner_ids)

    exclude_entry_id = None
    if current_entry and current_entry.owner_id == lunch.credit_owner_id:
        exclude_entry_id = current_entry.id

    ensure_credit_balance(
        lunch.credit_owner_id,
        lunch.value_cents,
        exclude_entry_id=exclude_entry_id,
    )

    description = f"Almoço com crédito - {lunch.member.full_name} - {lunch.date}"

    if current_entry:
        fields_to_update: list[str] = []
        if current_entry.owner_id != lunch.credit_owner_id:
            current_entry.owner = lunch.credit_owner
            fields_to_update.append("owner")
        if current_entry.beneficiary_id != lunch.member_id:
            current_entry.beneficiary = lunch.member
            fields_to_update.append("beneficiary")
        if current_entry.value_cents != lunch.value_cents:
            current_entry.value_cents = lunch.value_cents
            fields_to_update.append("value_cents")
        if current_entry.description != description:
            current_entry.description = description
            fields_to_update.append("description")
        if actor and current_entry.created_by_id != actor.id:
            current_entry.created_by = actor
            fields_to_update.append("created_by")
        if fields_to_update:
            fields_to_update.append("updated_at")
            current_entry.save(update_fields=fields_to_update)
        return

    CreditEntry.objects.create(
        owner=lunch.credit_owner,
        beneficiary=lunch.member,
        entry_type=CreditEntry.EntryType.DEBITO,
        origin=CreditEntry.Origin.LUNCH,
        value_cents=lunch.value_cents,
        description=description,
        lunch=lunch,
        created_by=actor,
    )


@transaction.atomic
def create_manual_credit_entry(
    *,
    owner: Member,
    beneficiary: Member | None,
    value_cents: int,
    description: str,
    created_by: User,
    entry_type: str,
) -> CreditEntry:
    lock_members([owner.id])
    if entry_type == CreditEntry.EntryType.DEBITO:
        ensure_credit_balance(owner.id, value_cents, field_name="owner")

    resolved_beneficiary = owner if entry_type == CreditEntry.EntryType.CREDITO else beneficiary

    return CreditEntry.objects.create(
        owner=owner,
        beneficiary=resolved_beneficiary,
        entry_type=entry_type,
        origin=CreditEntry.Origin.MANUAL,
        value_cents=value_cents,
        description=description,
        created_by=created_by,
    )
