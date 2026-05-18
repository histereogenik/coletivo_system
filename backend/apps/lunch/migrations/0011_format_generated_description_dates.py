from django.db import migrations


def format_date(value):
    return value.strftime("%d/%m/%Y")


def format_generated_description_dates(apps, schema_editor):
    package_entry_model = apps.get_model("lunch", "PackageEntry")
    financial_entry_model = apps.get_model("financial", "FinancialEntry")
    credit_entry_model = apps.get_model("credits", "CreditEntry")

    package_entries = package_entry_model.objects.filter(
        origin="LUNCH",
        lunch__isnull=False,
    ).select_related("lunch")
    for entry in package_entries:
        entry.description = f"Uso em almoço - {format_date(entry.lunch.date)}"
        entry.save(update_fields=["description"])

    lunch_financial_entries = financial_entry_model.objects.filter(
        lunch__isnull=False,
        description__startswith="Pagamento almoço - ",
    ).select_related("lunch", "lunch__member")
    for entry in lunch_financial_entries:
        entry.description = (
            f"Pagamento almoço - {entry.lunch.member.full_name} - "
            f"{format_date(entry.lunch.date)}"
        )
        entry.save(update_fields=["description"])

    package_financial_entries = financial_entry_model.objects.filter(
        package__isnull=False,
        description__startswith="Pagamento pacote - ",
    ).select_related("package", "package__member")
    for entry in package_financial_entries:
        entry.description = (
            f"Pagamento pacote - {entry.package.member.full_name} - "
            f"{format_date(entry.package.date)}"
        )
        entry.save(update_fields=["description"])

    agenda_credit_entries = credit_entry_model.objects.filter(
        origin="AGENDA",
        agenda_entry__isnull=False,
    ).select_related("agenda_entry", "agenda_entry__duty")
    for entry in agenda_credit_entries:
        entry.description = (
            f"Crédito por trabalho - {entry.agenda_entry.duty.name} - "
            f"{format_date(entry.agenda_entry.date)}"
        )
        entry.save(update_fields=["description"])

    lunch_credit_entries = credit_entry_model.objects.filter(
        origin="LUNCH",
        lunch__isnull=False,
    ).select_related("lunch", "lunch__member")
    for entry in lunch_credit_entries:
        entry.description = (
            f"Almoço com crédito - {entry.lunch.member.full_name} - "
            f"{format_date(entry.lunch.date)}"
        )
        entry.save(update_fields=["description"])


class Migration(migrations.Migration):

    dependencies = [
        ("credits", "0001_initial"),
        ("financial", "0005_alter_financialentry_description"),
        ("lunch", "0010_alter_package_status"),
    ]

    operations = [
        migrations.RunPython(format_generated_description_dates, migrations.RunPython.noop),
    ]
