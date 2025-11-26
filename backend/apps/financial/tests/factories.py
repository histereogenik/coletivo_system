import factory

from apps.financial.models import FinancialEntry


class FinancialEntryFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = FinancialEntry

    entry_type = FinancialEntry.EntryType.ENTRADA
    category = FinancialEntry.EntryCategory.ALMOCO
    description = factory.Faker("sentence")
    value_cents = 1000
    date = factory.Faker("date_this_year")
