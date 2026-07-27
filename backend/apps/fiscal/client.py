import base64
import json
from dataclasses import dataclass
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.conf import settings


@dataclass
class FocusNFeError(Exception):
    message: str
    status_code: int | None = None
    payload: dict | list | None = None

    def __str__(self):
        return self.message


class FocusNFeClient:
    def __init__(self, *, token=None, base_url=None, timeout=None):
        self.token = token if token is not None else settings.FOCUS_NFE_TOKEN
        self.base_url = (base_url or settings.FOCUS_NFE_BASE_URL).rstrip("/")
        self.timeout = timeout or settings.FOCUS_NFE_TIMEOUT_SECONDS

    def emit(self, document_type, reference, payload):
        endpoint = self._endpoint(document_type)
        return self._request("POST", endpoint, query={"ref": reference}, payload=payload)

    def get(self, document_type, reference):
        endpoint = self._endpoint(document_type)
        return self._request("GET", f"{endpoint}/{reference}")

    def list_webhooks(self):
        return self._request("GET", "/v2/hooks")

    def create_webhook(self, *, cnpj, event, url, authorization_header, authorization):
        return self._request(
            "POST",
            "/v2/hooks",
            payload={
                "cnpj": cnpj,
                "event": event,
                "url": url,
                "authorization_header": authorization_header,
                "authorization": authorization,
            },
        )

    def _endpoint(self, document_type):
        if document_type == "NFE":
            return "/v2/nfe"
        if document_type == "NFCE":
            return "/v2/nfce"
        raise ValueError("Tipo de documento fiscal inválido.")

    def _request(self, method, path, *, query=None, payload=None):
        if not self.token:
            raise FocusNFeError("Token da Focus NFe não configurado.")

        url = f"{self.base_url}{path}"
        if query:
            url = f"{url}?{urlencode(query)}"

        body = None
        if payload is not None:
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8")

        encoded_credentials = base64.b64encode(f"{self.token}:".encode()).decode()
        request = Request(
            url,
            data=body,
            method=method,
            headers={
                "Authorization": f"Basic {encoded_credentials}",
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
        )

        try:
            with urlopen(request, timeout=self.timeout) as response:  # noqa: S310
                return self._decode_response(response.read())
        except HTTPError as exc:
            response_payload = self._decode_response(exc.read())
            raise FocusNFeError(
                self._extract_error_message(response_payload, exc.reason),
                status_code=exc.code,
                payload=response_payload,
            ) from exc
        except (URLError, TimeoutError) as exc:
            raise FocusNFeError("Não foi possível conectar à Focus NFe.") from exc

    @staticmethod
    def _decode_response(raw):
        if not raw:
            return {}
        try:
            return json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return {"raw": raw.decode("utf-8", errors="replace")}

    @staticmethod
    def _extract_error_message(payload, fallback):
        if isinstance(payload, dict):
            for key in ("mensagem", "message", "erro", "error"):
                if payload.get(key):
                    return str(payload[key])
            errors = payload.get("erros") or payload.get("errors")
            if errors:
                return str(errors)
        return str(fallback)
