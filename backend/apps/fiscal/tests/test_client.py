import base64
import json
from unittest.mock import patch

import pytest
from django.test import override_settings

from apps.fiscal.client import FocusNFeClient, FocusNFeError


class FakeResponse:
    def __init__(self, payload):
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return None

    def read(self):
        return json.dumps(self.payload).encode()


@override_settings(FOCUS_NFE_TOKEN="secret-token")
def test_client_uses_company_token_as_basic_authentication():
    client = FocusNFeClient(base_url="https://example.test")

    response_data = FakeResponse({"status": "autorizado"})
    with patch("apps.fiscal.client.urlopen", return_value=response_data) as mocked:
        response = client.emit("NFCE", "reference-1", {"items": []})

    request = mocked.call_args.args[0]
    expected = base64.b64encode(b"secret-token:").decode()
    assert request.headers["Authorization"] == f"Basic {expected}"
    assert request.full_url == "https://example.test/v2/nfce?ref=reference-1"
    assert response == {"status": "autorizado"}


@override_settings(FOCUS_NFE_TOKEN="")
def test_client_rejects_missing_token_without_network_call():
    client = FocusNFeClient(base_url="https://example.test")

    with pytest.raises(FocusNFeError, match="Token da Focus NFe não configurado"):
        client.get("NFE", "reference-1")
