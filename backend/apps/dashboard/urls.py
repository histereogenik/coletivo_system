from django.urls import path

from apps.dashboard.views import DashboardSummaryView

urlpatterns = [
    path("summary/", DashboardSummaryView.as_view(), name="dashboard-summary"),
]
