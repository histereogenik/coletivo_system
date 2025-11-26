import pytest

from apps.agenda.serializers import AgendaEntrySerializer
from apps.duties.tests.factories import DutyFactory
from apps.users.models import Member
from apps.users.tests.factories import MemberFactory


@pytest.mark.django_db
def test_agenda_entry_serializer_creates_with_members_and_valid_times():
    duty = DutyFactory()
    members = [MemberFactory(role=Member.Role.AVULSO), MemberFactory(role=Member.Role.MENSALISTA)]
    duty.members.set(members)
    payload = {
        "date": "2025-12-01",
        "start_time": "10:00",
        "end_time": "11:00",
        "duty": duty.id,
        "status": "PLANEJADO",
        "member_ids": [m.id for m in members],
    }

    serializer = AgendaEntrySerializer(data=payload)
    assert serializer.is_valid(), serializer.errors
    instance = serializer.save()

    assert instance.members.count() == 2
    for m in members:
        m.refresh_from_db()
        assert m.role == Member.Role.SUSTENTADOR

@pytest.mark.django_db
def test_agenda_entry_serializer_rejects_end_before_start():
    duty = DutyFactory()
    payload = {
        "date": "2025-12-01",
        "start_time": "11:00",
        "end_time": "10:00",
        "duty": duty.id,
        "status": "PLANEJADO",
    }

    serializer = AgendaEntrySerializer(data=payload)
    assert not serializer.is_valid()
    assert "end_time" in serializer.errors


@pytest.mark.django_db
def test_agenda_entry_rejects_members_not_in_duty():
    duty = DutyFactory()
    member = MemberFactory()
    # duty.members is empty, should auto-associate member to duty
    payload = {
        "date": "2025-12-02",
        "start_time": "08:00",
        "duty": duty.id,
        "member_ids": [member.id],
    }

    serializer = AgendaEntrySerializer(data=payload)
    assert serializer.is_valid(), serializer.errors
    instance = serializer.save()
    assert instance.members.count() == 1
    duty.refresh_from_db()
    assert duty.members.filter(id=member.id).exists()


@pytest.mark.django_db
def test_agenda_entry_rejects_unknown_member_id():
    duty = DutyFactory()
    payload = {
        "date": "2025-12-03",
        "start_time": "09:00",
        "duty": duty.id,
        "member_ids": [999],
    }

    serializer = AgendaEntrySerializer(data=payload)
    assert not serializer.is_valid()
    assert "member_ids_invalid" in serializer.errors
    invalid_ids = {str(item) for item in serializer.errors["member_ids_invalid"]}
    assert "999" in invalid_ids


@pytest.mark.django_db
def test_agenda_entry_rejects_time_conflict_for_member():
    duty = DutyFactory()
    member = MemberFactory()
    duty.members.add(member)
    # Existing entry 09:00-10:00
    existing_payload = {
        "date": "2025-12-04",
        "start_time": "09:00",
        "end_time": "10:00",
        "duty": duty,
        "status": "PLANEJADO",
    }
    AgendaEntrySerializer().Meta.model.objects.create(**existing_payload).members.add(member)

    # New entry overlapping 09:30-10:30
    payload = {
        "date": "2025-12-04",
        "start_time": "09:30",
        "end_time": "10:30",
        "duty": duty.id,
        "member_ids": [member.id],
    }

    serializer = AgendaEntrySerializer(data=payload)
    assert not serializer.is_valid()
    assert "member_conflicts" in serializer.errors
