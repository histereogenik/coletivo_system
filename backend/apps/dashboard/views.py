from datetime import timedelta

from django.db import models
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.financial.models import FinancialEntry
from apps.lunch.models import Lunch
from apps.users.models import Member


class DashboardSummaryView(APIView):
    permission_classes = []  # Public GET

    def get(self, request):
        today = timezone.now().date()
        start_month = today.replace(day=1)

        # Monthly balance
        monthly_entries = FinancialEntry.objects.filter(date__gte=start_month, date__lte=today)
        entradas = (
            monthly_entries.filter(entry_type=FinancialEntry.EntryType.ENTRADA).aggregate(
                total=models.Sum("value_cents")
            )["total"]
            or 0
        )
        saidas = (
            monthly_entries.filter(entry_type=FinancialEntry.EntryType.SAIDA).aggregate(
                total=models.Sum("value_cents")
            )["total"]
            or 0
        )
        monthly_balance = entradas - saidas

        # Members stats
        total_members = Member.objects.count()
        total_sustentadores = Member.objects.filter(role=Member.Role.SUSTENTADOR).count()
        total_mensalistas = Member.objects.filter(role=Member.Role.MENSALISTA).count()
        total_avulsos = Member.objects.filter(role=Member.Role.AVULSO).count()

        # Lunch stats
        last_30_start = today - timedelta(days=29)
        lunches_last_30 = Lunch.objects.filter(date__gte=last_30_start, date__lte=today)
        total_lunches_last_30 = lunches_last_30.count()
        avg_lunches_last_30 = total_lunches_last_30 / 30.0

        total_lunches_open = Lunch.objects.filter(
            payment_status=Lunch.PaymentStatus.EM_ABERTO
        ).count()
        total_lunches = Lunch.objects.count()

        lunches_today = Lunch.objects.select_related("member").filter(date=today)
        lunches_today_paid = lunches_today.filter(payment_status=Lunch.PaymentStatus.PAGO)
        total_lunches_today = lunches_today.count()
        total_paid_today = (
            lunches_today_paid.aggregate(total=models.Sum("value_cents"))["total"] or 0
        )
        lunches_today_items = [
            {
                "id": lunch.id,
                "member_name": lunch.member.full_name,
                "payment_status": lunch.payment_status,
                "value_cents": lunch.value_cents,
                "has_package": bool(lunch.package_id),
            }
            for lunch in lunches_today.order_by("member__full_name", "id")
        ]

        data = {
            "monthly_balance_cents": monthly_balance,
            "entradas_cents": entradas,
            "saidas_cents": saidas,
            "members": {
                "total": total_members,
                "sustentadores": total_sustentadores,
                "mensalistas": total_mensalistas,
                "avulsos": total_avulsos,
            },
            "lunches": {
                "average_daily_last_30_days": avg_lunches_last_30,
                "total_last_30_days": total_lunches_last_30,
                "total_em_aberto": total_lunches_open,
                "total": total_lunches,
                "today_total": total_lunches_today,
                "today_paid_cents": total_paid_today,
                "today_items": lunches_today_items,
            },
        }
        return Response(data)
