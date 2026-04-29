import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def backfill_package_entries(apps, schema_editor):
    lunch_model = apps.get_model("lunch", "Lunch")
    package_entry_model = apps.get_model("lunch", "PackageEntry")

    entries = []
    for lunch in lunch_model.objects.filter(package__isnull=False).only("id", "package_id", "date"):
        entries.append(
            package_entry_model(
                package_id=lunch.package_id,
                entry_type="DEBITO",
                origin="LUNCH",
                quantity=1,
                description=f"Uso em almoço - {lunch.date}",
                lunch_id=lunch.id,
            )
        )

    package_entry_model.objects.bulk_create(entries, ignore_conflicts=True)


def remove_backfilled_package_entries(apps, schema_editor):
    package_entry_model = apps.get_model("lunch", "PackageEntry")
    package_entry_model.objects.filter(origin="LUNCH").delete()


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("lunch", "0007_lunch_credit_owner"),
    ]

    operations = [
        migrations.CreateModel(
            name="PackageEntry",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "entry_type",
                    models.CharField(
                        choices=[("CREDITO", "Crédito"), ("DEBITO", "Débito")],
                        max_length=10,
                    ),
                ),
                (
                    "origin",
                    models.CharField(
                        choices=[("MANUAL", "Manual"), ("LUNCH", "Almoço")],
                        max_length=10,
                    ),
                ),
                ("quantity", models.PositiveIntegerField()),
                ("description", models.TextField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="created_package_entries",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "lunch",
                    models.OneToOneField(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="package_entry",
                        to="lunch.lunch",
                    ),
                ),
                (
                    "package",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="entries",
                        to="lunch.package",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at", "-id"],
            },
        ),
        migrations.RunPython(backfill_package_entries, remove_backfilled_package_entries),
    ]
