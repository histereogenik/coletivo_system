from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("authentication", "0003_copy_legacy_group_permissions"),
    ]

    operations = [
        migrations.AddField(
            model_name="operatorprofile",
            name="auth_version",
            field=models.PositiveIntegerField(default=1),
        ),
    ]
