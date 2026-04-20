from django.contrib import admin
from django.urls import path, include

from rest_framework_simplejwt.views import TokenRefreshView
from monitor.views import MeView, GuardedTokenObtainPairView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/token/", GuardedTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/me/", MeView.as_view(), name="api_me"),
    path("api/", include("monitor.urls")),
]
