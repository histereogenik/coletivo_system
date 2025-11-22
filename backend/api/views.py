from django.http import JsonResponse
from rest_framework.views import APIView


class HealthCheckView(APIView):
    """Basic health endpoint to verify service availability."""

    authentication_classes = []
    permission_classes = []

    def get(self, request):
        return JsonResponse({"status": "ok"}, status=200)
