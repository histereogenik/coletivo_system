from importlib import import_module

import pytest
from django.apps import apps as django_apps
from django.contrib.auth.models import Group, Permission
from django.contrib.contenttypes.models import ContentType

from apps.authentication.models import OperatorProfile


@pytest.mark.django_db
def test_legacy_group_lunch_permission_is_split_into_both_new_permissions():
    content_type = ContentType.objects.get_for_model(OperatorProfile)
    legacy_permission, _ = Permission.objects.get_or_create(
        content_type=content_type,
        codename="manage_lunch",
        defaults={"name": "Pode gerenciar almocos e pacotes"},
    )
    lunches_permission = Permission.objects.get(
        content_type=content_type,
        codename="manage_lunches",
    )
    packages_permission = Permission.objects.get(
        content_type=content_type,
        codename="manage_packages",
    )
    group = Group.objects.create(name="operacao-legada")
    group.permissions.add(legacy_permission)

    migration = import_module(
        "apps.authentication.migrations.0003_copy_legacy_group_permissions"
    )
    migration.copy_legacy_group_permissions(django_apps, None)

    assert group.permissions.filter(pk=lunches_permission.pk).exists()
    assert group.permissions.filter(pk=packages_permission.pk).exists()
