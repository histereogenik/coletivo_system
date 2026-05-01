from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("lunch", "0008_packageentry"),
    ]

    operations = [
        migrations.AddField(
            model_name="lunch",
            name="package_beneficiary",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.deletion.PROTECT,
                related_name="benefited_package_lunches",
                to="users.member",
            ),
        ),
        migrations.AddField(
            model_name="packageentry",
            name="beneficiary",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.deletion.PROTECT,
                related_name="benefited_package_entries",
                to="users.member",
            ),
        ),
    ]
