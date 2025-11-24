from django.http import JsonResponse
from rest_framework import viewsets
from rest_framework.views import APIView

from apps.common.permissions import SuperuserOnly
from apps.users.models import Member
from apps.users.serializers import MemberSerializer


class UserHealthView(APIView):
    """Basic health endpoint for the users service slice."""

    authentication_classes = []
    permission_classes = []

    def get(self, request):
        return JsonResponse({"status": "ok", "service": "users"}, status=200)


class MemberViewSet(viewsets.ModelViewSet):
    queryset = Member.objects.all().order_by("full_name")
    serializer_class = MemberSerializer
    permission_classes = [SuperuserOnly]
