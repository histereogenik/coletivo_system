import factory

from apps.lunch.models import Lunch
from apps.users.tests.factories import MemberFactory


class LunchFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Lunch

    member = factory.SubFactory(MemberFactory)
    value_cents = 2500
    date = factory.Faker("date_this_year")
    lunch_type = Lunch.LunchType.AVULSO
    payment_status = Lunch.PaymentStatus.PAGO
