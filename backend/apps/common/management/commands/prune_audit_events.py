from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.common.models import AuditEvent


class Command(BaseCommand):
    help = "Remove eventos de auditoria mais antigos que a retencao configurada."

    def add_arguments(self, parser):
        parser.add_argument("--days", type=int, default=settings.AUDIT_RETENTION_DAYS)
        parser.add_argument(
            "--confirm",
            action="store_true",
            help="Confirma a exclusao. Sem esta opcao, executa apenas uma simulacao.",
        )

    def handle(self, *args, **options):
        days = options["days"]
        if days < 1:
            raise CommandError("O periodo de retencao deve ser de pelo menos 1 dia.")

        cutoff = timezone.now() - timedelta(days=days)
        queryset = AuditEvent.objects.filter(created_at__lt=cutoff)
        count = queryset.count()
        if not options["confirm"]:
            message = (
                f"Simulacao: {count} evento(s) anterior(es) a "
                f"{cutoff.isoformat()} seriam removidos."
            )
            self.stdout.write(
                message
            )
            return

        deleted, _ = queryset.delete()
        self.stdout.write(self.style.SUCCESS(f"{deleted} evento(s) de auditoria removido(s)."))
