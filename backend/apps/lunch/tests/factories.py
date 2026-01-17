import factory

from apps.lunch.models import Lunch, Package
from apps.users.tests.factories import MemberFactory


class LunchFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Lunch

    member = factory.SubFactory(MemberFactory)
    value_cents = 2500
    date = factory.Faker("date_this_year")
    payment_status = Lunch.PaymentStatus.PAGO
    payment_mode = Lunch.PaymentMode.PIX
    package = None


class PackageFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Package

    member = factory.SubFactory(MemberFactory)
    value_cents = 10000
    date = factory.Faker("date_this_year")
    payment_status = Package.PaymentStatus.PAGO
    payment_mode = Package.PaymentMode.PIX
    quantity = 10
    remaining_quantity = 10
    expiration = factory.Faker("date_this_year")
    status = Package.PackageStatus.VALIDO
