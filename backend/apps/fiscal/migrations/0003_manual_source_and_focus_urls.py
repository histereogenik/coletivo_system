from django.db import migrations, models


def populate_source_kind_and_urls(apps, schema_editor):
    FiscalDocument = apps.get_model("fiscal", "FiscalDocument")
    for document in FiscalDocument.objects.all().iterator():
        document.source_kind = "LUNCH" if document.lunch_id else "PACKAGE"
        base_url = (
            "https://api.focusnfe.com.br"
            if document.environment == "PRODUCTION"
            else "https://homologacao.focusnfe.com.br"
        )
        if document.xml_url and document.xml_url.startswith("/"):
            document.xml_url = f"{base_url}{document.xml_url}"
        if document.danfe_url and document.danfe_url.startswith("/"):
            document.danfe_url = f"{base_url}{document.danfe_url}"
        document.save(update_fields=["source_kind", "xml_url", "danfe_url"])


class Migration(migrations.Migration):
    dependencies = [("fiscal", "0002_fiscalwebhookevent")]

    operations = [
        migrations.AddField(
            model_name="fiscaldocument",
            name="source_kind",
            field=models.CharField(
                blank=True,
                choices=[
                    ("LUNCH", "Almoço avulso"),
                    ("PACKAGE", "Pacote"),
                    ("MANUAL", "Lançamento manual"),
                ],
                max_length=10,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="fiscaldocument",
            name="manual_description",
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AddField(
            model_name="fiscaldocument",
            name="manual_payment_method",
            field=models.CharField(blank=True, max_length=2),
        ),
        migrations.AddField(
            model_name="fiscaldocument",
            name="manual_request_key",
            field=models.UUIDField(blank=True, null=True, unique=True),
        ),
        migrations.AddField(
            model_name="fiscaldocument",
            name="manual_value_cents",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.RunPython(populate_source_kind_and_urls, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="fiscaldocument",
            name="source_kind",
            field=models.CharField(
                choices=[
                    ("LUNCH", "Almoço avulso"),
                    ("PACKAGE", "Pacote"),
                    ("MANUAL", "Lançamento manual"),
                ],
                max_length=10,
            ),
        ),
        migrations.RemoveConstraint(
            model_name="fiscaldocument",
            name="fiscal_document_has_exactly_one_source",
        ),
        migrations.AddConstraint(
            model_name="fiscaldocument",
            constraint=models.CheckConstraint(
                condition=(
                    (
                        models.Q(source_kind="LUNCH")
                        & models.Q(lunch__isnull=False)
                        & models.Q(package__isnull=True)
                        & models.Q(manual_value_cents__isnull=True)
                    )
                    | (
                        models.Q(source_kind="PACKAGE")
                        & models.Q(lunch__isnull=True)
                        & models.Q(package__isnull=False)
                        & models.Q(manual_value_cents__isnull=True)
                    )
                    | (
                        models.Q(source_kind="MANUAL")
                        & models.Q(lunch__isnull=True)
                        & models.Q(package__isnull=True)
                        & models.Q(manual_value_cents__gt=0)
                        & models.Q(manual_request_key__isnull=False)
                    )
                ),
                name="fiscal_document_has_valid_source",
            ),
        ),
    ]
