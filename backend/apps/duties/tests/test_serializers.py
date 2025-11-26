import pytest

from apps.duties.serializers import DutySerializer
from apps.users.tests.factories import MemberFactory


@pytest.mark.django_db
def test_duty_serializer_valid_payload():
    members = [MemberFactory(), MemberFactory()]
    payload = {
        "name": "Cozinha",
        "remuneration_cents": 1500,
        "member_ids": [m.id for m in members],
    }

    serializer = DutySerializer(data=payload)
    assert serializer.is_valid(), serializer.errors
    instance = serializer.save()

    assert instance.name == "Cozinha"
    assert instance.remuneration_cents == 1500
    assert instance.members.count() == 2


@pytest.mark.django_db
def test_duty_serializer_rejects_negative_remuneration():
    payload = {"name": "Limpeza", "remuneration_cents": -10}

    serializer = DutySerializer(data=payload)
    assert not serializer.is_valid()
    assert "remuneration_cents" in serializer.errors


def test_duty_serializer_rejects_short_name():
    payload = {"name": "A", "remuneration_cents": 0}

    serializer = DutySerializer(data=payload)
    assert not serializer.is_valid()
    assert "name" in serializer.errors
