from django.db import migrations


def copy_legacy_group_permissions(apps, schema_editor):
    ContentType = apps.get_model("contenttypes", "ContentType")
    Group = apps.get_model("auth", "Group")
    Permission = apps.get_model("auth", "Permission")

    content_type = ContentType.objects.filter(
        app_label="authentication",
        model="operatorprofile",
    ).first()
    if not content_type:
        return

    permissions = {
        permission.codename: permission
        for permission in Permission.objects.filter(
            content_type=content_type,
            codename__in=("manage_lunch", "manage_lunches", "manage_packages"),
        )
    }
    legacy_permission = permissions.get("manage_lunch")
    lunches_permission = permissions.get("manage_lunches")
    packages_permission = permissions.get("manage_packages")
    if not all((legacy_permission, lunches_permission, packages_permission)):
        return

    for group in Group.objects.filter(permissions=legacy_permission).distinct():
        group.permissions.add(lunches_permission, packages_permission)


class Migration(migrations.Migration):
    dependencies = [
        ("authentication", "0002_alter_operatorprofile_options"),
    ]

    operations = [
        migrations.RunPython(copy_legacy_group_permissions, migrations.RunPython.noop),
    ]
