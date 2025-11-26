import factory

from apps.agenda.models import AgendaEntry
from apps.duties.tests.factories import DutyFactory


class AgendaEntryFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = AgendaEntry
        skip_postgeneration_save = True

    date = factory.Faker("date_this_month")
    start_time = factory.Faker("time_object")
    end_time = None
    duty = factory.SubFactory(DutyFactory)

    @factory.post_generation
    def members(self, create, extracted, **kwargs):
        if not create:
            return
        if extracted:
            for member in extracted:
                self.members.add(member)
