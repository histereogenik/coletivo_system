import factory

from apps.duties.models import Duty
from apps.users.tests.factories import MemberFactory


class DutyFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Duty
        skip_postgeneration_save = True

    name = factory.Faker("job")
    remuneration_cents = 0

    @factory.post_generation
    def members(self, create, extracted, **kwargs):
        if not create:
            return
        if extracted:
            for member in extracted:
                self.members.add(member)
