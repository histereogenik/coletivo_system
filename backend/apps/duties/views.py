from rest_framework import viewsets

from apps.common.permissions import SuperuserOnly
from apps.duties.models import Duty
from apps.duties.serializers import DutySerializer


class DutyViewSet(viewsets.ModelViewSet):
    queryset = Duty.objects.prefetch_related("members").order_by("name")
    serializer_class = DutySerializer
    permission_classes = [SuperuserOnly]
