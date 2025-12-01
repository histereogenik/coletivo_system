from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("lunch", "0002_lunch_remaining_quantity"),
    ]

    operations = [
        migrations.AddField(
            model_name="lunch",
            name="payment_mode",
            field=models.CharField(
                choices=[
                    ("PIX", "Pix"),
                    ("CARTAO", "Cartao"),
                    ("DINHEIRO", "Dinheiro"),
                ],
                default="PIX",
                max_length=10,
            ),
        ),
    ]
