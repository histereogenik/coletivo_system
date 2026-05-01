from datetime import date

import pytest
from rest_framework import serializers

from apps.agenda.serializers import AgendaEntrySerializer
from apps.credits.models import CreditEntry
from apps.credits.services import get_credit_balance
from apps.credits.tests.factories import CreditEntryFactory
from apps.duties.tests.factories import DutyFactory
from apps.financial.models import FinancialEntry
from apps.lunch.models import Lunch
from apps.lunch.serializers import LunchSerializer
from apps.users.models import Member
from apps.users.tests.factories import MemberFactory


@pytest.mark.django_db
def test_concluding_agenda_creates_credit_entries_for_each_member():
    duty = DutyFactory(remuneration_cents=1800)
    members = [MemberFactory(), MemberFactory()]
    payload = {
        "date": "2026-03-27",
        "start_time": "09:00",
        "end_time": "11:00",
        "duty": duty.id,
        "status": "CONCLUIDO",
        "member_ids": [member.id for member in members],
    }

    serializer = AgendaEntrySerializer(data=payload)
    assert serializer.is_valid(), serializer.errors
    instance = serializer.save()

    entries = CreditEntry.objects.filter(agenda_entry=instance).order_by("owner_id")
    assert entries.count() == 2
    assert all(entry.origin == CreditEntry.Origin.AGENDA for entry in entries)
    assert all(entry.entry_type == CreditEntry.EntryType.CREDITO for entry in entries)
    assert all(entry.value_cents == 1800 for entry in entries)


@pytest.mark.django_db
def test_repeated_agenda_save_does_not_duplicate_credits():
    duty = DutyFactory(remuneration_cents=1500)
    member = MemberFactory()
    serializer = AgendaEntrySerializer(
        data={
            "date": "2026-03-27",
            "start_time": "08:00",
            "end_time": "10:00",
            "duty": duty.id,
            "status": "CONCLUIDO",
            "member_ids": [member.id],
        }
    )
    assert serializer.is_valid(), serializer.errors
    instance = serializer.save()

    update_serializer = AgendaEntrySerializer(instance, data={"notes": "Atualizado"}, partial=True)
    assert update_serializer.is_valid(), update_serializer.errors
    update_serializer.save()

    assert CreditEntry.objects.filter(agenda_entry=instance).count() == 1


@pytest.mark.django_db
def test_agenda_credit_is_removed_when_status_is_reverted():
    duty = DutyFactory(remuneration_cents=1700)
    member = MemberFactory()
    serializer = AgendaEntrySerializer(
        data={
            "date": "2026-03-27",
            "start_time": "08:00",
            "end_time": "10:00",
            "duty": duty.id,
            "status": "CONCLUIDO",
            "member_ids": [member.id],
        }
    )
    assert serializer.is_valid(), serializer.errors
    instance = serializer.save()
    assert CreditEntry.objects.filter(agenda_entry=instance).count() == 1

    update_serializer = AgendaEntrySerializer(
        instance,
        data={"status": "PLANEJADO"},
        partial=True,
    )
    assert update_serializer.is_valid(), update_serializer.errors
    update_serializer.save()

    assert CreditEntry.objects.filter(agenda_entry=instance).count() == 0


@pytest.mark.django_db
def test_agenda_credit_is_updated_when_duty_changes():
    duty = DutyFactory(remuneration_cents=1200)
    updated_duty = DutyFactory(remuneration_cents=2500)
    member = MemberFactory()
    serializer = AgendaEntrySerializer(
        data={
            "date": "2026-03-27",
            "start_time": "08:00",
            "end_time": "10:00",
            "duty": duty.id,
            "status": "CONCLUIDO",
            "member_ids": [member.id],
        }
    )
    assert serializer.is_valid(), serializer.errors
    instance = serializer.save()

    update_serializer = AgendaEntrySerializer(
        instance,
        data={"duty": updated_duty.id},
        partial=True,
    )
    assert update_serializer.is_valid(), update_serializer.errors
    update_serializer.save()

    credit_entry = CreditEntry.objects.get(agenda_entry=instance, owner=member)
    assert credit_entry.value_cents == 2500


@pytest.mark.django_db
def test_lunch_paid_with_credit_creates_debit_and_no_financial_entry():
    owner = MemberFactory()
    consumer = MemberFactory()
    CreditEntryFactory(owner=owner, beneficiary=owner, value_cents=4000)
    payload = {
        "member": consumer.id,
        "credit_owner": owner.id,
        "value_cents": 1800,
        "date": date.today(),
        "payment_status": Lunch.PaymentStatus.EM_ABERTO,
        "payment_mode": Lunch.PaymentMode.TROCA,
    }

    serializer = LunchSerializer(data=payload)
    assert serializer.is_valid(), serializer.errors
    lunch = serializer.save()

    credit_entry = CreditEntry.objects.get(lunch=lunch)
    assert credit_entry.entry_type == CreditEntry.EntryType.DEBITO
    assert credit_entry.owner == owner
    assert credit_entry.beneficiary == consumer
    assert get_credit_balance(owner.id) == 2200
    assert FinancialEntry.objects.filter(lunch=lunch).count() == 0
    assert lunch.payment_status == Lunch.PaymentStatus.PAGO


@pytest.mark.django_db
def test_lunch_with_credit_requires_sufficient_balance():
    owner = MemberFactory()
    consumer = MemberFactory()
    CreditEntryFactory(owner=owner, beneficiary=owner, value_cents=1000)
    payload = {
        "member": consumer.id,
        "credit_owner": owner.id,
        "value_cents": 1800,
        "date": date.today(),
        "payment_status": Lunch.PaymentStatus.PAGO,
        "payment_mode": Lunch.PaymentMode.TROCA,
    }

    serializer = LunchSerializer(data=payload)
    assert serializer.is_valid(), serializer.errors

    with pytest.raises(serializers.ValidationError) as excinfo:
        serializer.save()

    assert "credit_owner" in excinfo.value.detail
    assert CreditEntry.objects.filter(origin=CreditEntry.Origin.LUNCH).count() == 0


@pytest.mark.django_db
def test_sustentador_lunch_with_credit_creates_debt_without_balance():
    member = MemberFactory(role=Member.Role.SUSTENTADOR)
    payload = {
        "member": member.id,
        "credit_owner": member.id,
        "value_cents": 1800,
        "date": date.today(),
        "payment_status": Lunch.PaymentStatus.EM_ABERTO,
        "payment_mode": Lunch.PaymentMode.TROCA,
    }

    serializer = LunchSerializer(data=payload)
    assert serializer.is_valid(), serializer.errors
    lunch = serializer.save()

    credit_entry = CreditEntry.objects.get(lunch=lunch)
    assert credit_entry.entry_type == CreditEntry.EntryType.DEBITO
    assert credit_entry.owner == member
    assert credit_entry.beneficiary == member
    assert get_credit_balance(member.id) == -1800
    assert FinancialEntry.objects.filter(lunch=lunch).count() == 0
    assert lunch.payment_status == Lunch.PaymentStatus.PAGO


@pytest.mark.django_db
def test_agenda_credit_offsets_existing_sustentador_debt():
    member = MemberFactory(role=Member.Role.SUSTENTADOR)
    lunch_serializer = LunchSerializer(
        data={
            "member": member.id,
            "credit_owner": member.id,
            "value_cents": 1800,
            "date": date.today(),
            "payment_status": Lunch.PaymentStatus.PAGO,
            "payment_mode": Lunch.PaymentMode.TROCA,
        }
    )
    assert lunch_serializer.is_valid(), lunch_serializer.errors
    lunch_serializer.save()
    assert get_credit_balance(member.id) == -1800

    duty = DutyFactory(remuneration_cents=2500)
    agenda_serializer = AgendaEntrySerializer(
        data={
            "date": "2026-03-27",
            "start_time": "09:00",
            "end_time": "11:00",
            "duty": duty.id,
            "status": "CONCLUIDO",
            "member_ids": [member.id],
        }
    )
    assert agenda_serializer.is_valid(), agenda_serializer.errors
    agenda_entry = agenda_serializer.save()

    assert CreditEntry.objects.filter(
        owner=member,
        agenda_entry=agenda_entry,
        entry_type=CreditEntry.EntryType.CREDITO,
        value_cents=2500,
    ).count() == 1
    assert get_credit_balance(member.id) == 700


@pytest.mark.django_db
def test_lunch_rejects_package_and_credit_together():
    owner = MemberFactory()
    consumer = MemberFactory()
    package_owner = MemberFactory()
    package = package_owner.packages.create(
        unit_value_cents=1200,
        value_cents=6000,
        date=date.today(),
        payment_status="PAGO",
        payment_mode="PIX",
        quantity=5,
        remaining_quantity=5,
        expiration=date.today(),
        status="VALIDO",
    )
    serializer = LunchSerializer(
        data={
            "member": consumer.id,
            "credit_owner": owner.id,
            "package": package.id,
            "value_cents": 1200,
            "date": date.today(),
            "payment_status": Lunch.PaymentStatus.PAGO,
            "payment_mode": Lunch.PaymentMode.TROCA,
        }
    )

    assert not serializer.is_valid()
    assert "credit_owner" in serializer.errors


@pytest.mark.django_db
def test_updating_credit_lunch_synchronizes_debit_and_owner():
    first_owner = MemberFactory()
    second_owner = MemberFactory()
    consumer = MemberFactory()
    CreditEntryFactory(owner=first_owner, beneficiary=first_owner, value_cents=2500)
    CreditEntryFactory(owner=second_owner, beneficiary=second_owner, value_cents=3000)
    serializer = LunchSerializer(
        data={
            "member": consumer.id,
            "credit_owner": first_owner.id,
            "value_cents": 1000,
            "date": date.today(),
            "payment_status": Lunch.PaymentStatus.PAGO,
            "payment_mode": Lunch.PaymentMode.TROCA,
        }
    )
    assert serializer.is_valid(), serializer.errors
    lunch = serializer.save()

    update_serializer = LunchSerializer(
        lunch,
        data={"credit_owner": second_owner.id, "value_cents": 1500},
        partial=True,
    )
    assert update_serializer.is_valid(), update_serializer.errors
    update_serializer.save()

    lunch.refresh_from_db()
    credit_entry = CreditEntry.objects.get(lunch=lunch)
    assert credit_entry.owner == second_owner
    assert credit_entry.value_cents == 1500
    assert get_credit_balance(first_owner.id) == 2500
    assert get_credit_balance(second_owner.id) == 1500


@pytest.mark.django_db
def test_switching_from_cash_to_credit_removes_financial_entry():
    owner = MemberFactory()
    consumer = MemberFactory()
    CreditEntryFactory(owner=owner, beneficiary=owner, value_cents=3000)
    serializer = LunchSerializer(
        data={
            "member": consumer.id,
            "value_cents": 1200,
            "date": date.today(),
            "payment_status": Lunch.PaymentStatus.PAGO,
            "payment_mode": Lunch.PaymentMode.PIX,
        }
    )
    assert serializer.is_valid(), serializer.errors
    lunch = serializer.save()
    assert FinancialEntry.objects.filter(lunch=lunch).count() == 1

    update_serializer = LunchSerializer(
        lunch,
        data={"payment_mode": Lunch.PaymentMode.TROCA, "credit_owner": owner.id},
        partial=True,
    )
    assert update_serializer.is_valid(), update_serializer.errors
    update_serializer.save()

    assert FinancialEntry.objects.filter(lunch=lunch).count() == 0
    assert CreditEntry.objects.filter(lunch=lunch).count() == 1
