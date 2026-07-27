from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.fiscal.client import FocusNFeClient, FocusNFeError


class Command(BaseCommand):
    help = "Configura de forma idempotente o webhook fiscal da Focus NFe."

    def add_arguments(self, parser):
        parser.add_argument("--event", default="nfe")

    def handle(self, *args, **options):
        required = {
            "FOCUS_NFE_TOKEN": settings.FOCUS_NFE_TOKEN,
            "FISCAL_ISSUER_CNPJ": settings.FISCAL_ISSUER_CNPJ,
            "FOCUS_WEBHOOK_URL": settings.FOCUS_WEBHOOK_URL,
            "FOCUS_WEBHOOK_SECRET": settings.FOCUS_WEBHOOK_SECRET,
        }
        missing = [name for name, value in required.items() if not value]
        if missing:
            raise CommandError(f"Configuração ausente: {', '.join(missing)}")

        event = options["event"]
        client = FocusNFeClient()
        try:
            hooks = client.list_webhooks()
            if not isinstance(hooks, list):
                hooks = hooks.get("hooks", []) if isinstance(hooks, dict) else []
            exists = any(
                hook.get("cnpj") == settings.FISCAL_ISSUER_CNPJ
                and hook.get("event") == event
                and hook.get("url") == settings.FOCUS_WEBHOOK_URL
                for hook in hooks
            )
            if exists:
                self.stdout.write(self.style.SUCCESS("Webhook já estava configurado."))
                return
            client.create_webhook(
                cnpj=settings.FISCAL_ISSUER_CNPJ,
                event=event,
                url=settings.FOCUS_WEBHOOK_URL,
                authorization_header=settings.FOCUS_WEBHOOK_AUTHORIZATION_HEADER,
                authorization=settings.FOCUS_WEBHOOK_SECRET,
            )
        except FocusNFeError as exc:
            raise CommandError(f"A Focus recusou a configuração: {exc.message}") from exc

        self.stdout.write(self.style.SUCCESS("Webhook configurado com sucesso."))
