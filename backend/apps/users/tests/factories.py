import factory

from apps.users.models import Member, PublicRegistration, PublicRegistrationChild


class MemberFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Member

    full_name = factory.Faker("name")
    phone = factory.Faker("numerify", text="+55###########")  # keep <= 20 chars
    email = factory.Sequence(lambda n: f"user{n}@example.com")
    address = factory.Faker("address")
    heard_about = factory.Faker("sentence")
    role = Member.Role.MENSALISTA
    diet = Member.Diet.CARNIVORO
    observations = factory.Faker("sentence")


class PublicRegistrationFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = PublicRegistration

    full_name = factory.Faker("name")
    phone = factory.Faker("numerify", text="+55###########")
    email = factory.Sequence(lambda n: f"registration{n}@example.com")
    address = factory.Faker("address")
    heard_about = factory.Faker("sentence")
    role = Member.Role.AVULSO
    diet = Member.Diet.CARNIVORO
    observations = factory.Faker("sentence")
    status = PublicRegistration.Status.PENDENTE
    review_notes = ""


class PublicRegistrationChildFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = PublicRegistrationChild

    registration = factory.SubFactory(PublicRegistrationFactory)
    full_name = factory.Faker("name")
    diet = Member.Diet.CARNIVORO
    observations = factory.Faker("sentence")
