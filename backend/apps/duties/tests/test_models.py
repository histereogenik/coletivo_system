import pytest

from apps.duties.tests.factories import DutyFactory
from apps.users.tests.factories import MemberFactory


@pytest.mark.django_db
def test_duty_defaults_and_str():
    duty = DutyFactory(name="Cozinha", remuneration_cents=0)
    assert duty.remuneration_cents == 0
    assert str(duty) == "Cozinha"


@pytest.mark.django_db
def test_duty_allows_multiple_members():
    members = [MemberFactory(), MemberFactory()]
    duty = DutyFactory(remuneration_cents=1500)
    duty.members.set(members)

    assert duty.members.count() == 2
    assert duty.remuneration_cents == 1500
