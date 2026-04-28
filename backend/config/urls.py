from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

from rest_framework_simplejwt.views import TokenRefreshView
from monitor.views import MeView, GuardedTokenObtainPairView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/token/", GuardedTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/me/", MeView.as_view(), name="api_me"),
    path("api/", include("monitor.urls")),
]

# Serve uploaded firmware binaries in development.
# In production on Render, configure a persistent disk or cloud storage.
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
