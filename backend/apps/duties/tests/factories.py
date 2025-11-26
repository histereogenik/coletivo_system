import factory

from apps.duties.models import Duty


class DutyFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Duty
        skip_postgeneration_save = True

    name = factory.Faker("job")
    remuneration_cents = 0
