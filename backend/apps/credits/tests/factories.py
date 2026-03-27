import factory

from apps.credits.models import CreditEntry
from apps.users.tests.factories import MemberFactory


class CreditEntryFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = CreditEntry

    owner = factory.SubFactory(MemberFactory)
    beneficiary = factory.SelfAttribute("owner")
    entry_type = CreditEntry.EntryType.CREDITO
    origin = CreditEntry.Origin.MANUAL
    value_cents = 1000
    description = factory.Faker("sentence")

