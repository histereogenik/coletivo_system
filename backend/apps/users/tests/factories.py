import factory

from apps.users.models import Member


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
