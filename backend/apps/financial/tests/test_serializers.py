import pytest

from apps.financial.models import FinancialEntry
from apps.financial.serializers import FinancialEntrySerializer


@pytest.mark.django_db
def test_financial_entry_serializer_creates_entry():
    payload = {
        "entry_type": FinancialEntry.EntryType.ENTRADA,
        "category": FinancialEntry.EntryCategory.ALMOCO,
        "description": "Pagamento almoço",
        "value_cents": 2500,
        "date": "2025-12-10",
    }

    serializer = FinancialEntrySerializer(data=payload)
    assert serializer.is_valid(), serializer.errors
    instance = serializer.save()

    assert instance.value_cents == 2500
    assert instance.entry_type == FinancialEntry.EntryType.ENTRADA


@pytest.mark.django_db
def test_financial_entry_serializer_rejects_wrong_category_for_type():
    payload = {
        "entry_type": FinancialEntry.EntryType.ENTRADA,
        "category": FinancialEntry.EntryCategory.DESPESA,
        "description": "Despesa indevida",
        "value_cents": 1000,
        "date": "2025-12-10",
    }

    serializer = FinancialEntrySerializer(data=payload)
    assert not serializer.is_valid()
    assert "category" in serializer.errors
