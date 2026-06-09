from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("lunch", "0009_lunch_package_beneficiary_and_packageentry_beneficiary"),
    ]

    operations = [
        migrations.AlterField(
            model_name="package",
            name="status",
            field=models.CharField(
                choices=[
                    ("VALIDO", "Válido"),
                    ("EXPIRADO", "Expirado"),
                    ("ESGOTADO", "Esgotado"),
                ],
                max_length=10,
            ),
        ),
    ]
