from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.http import FileResponse, Http404
import os

from rest_framework_simplejwt.views import TokenRefreshView
from monitor.views import MeView, GuardedTokenObtainPairView


def serve_media(request, path):
    """
    Explicitly serve uploaded media files from MEDIA_ROOT.
    Used in production on Render where django.views.static.serve
    may not work reliably under ASGI (Daphne) with DEBUG=False.
    """
    # Resolve and sanitize the file path.
    full_path = os.path.normpath(os.path.join(settings.MEDIA_ROOT, path))
    media_root = os.path.normpath(settings.MEDIA_ROOT)

    # Security: block path traversal attempts (e.g. ../../etc/passwd).
    if not full_path.startswith(media_root + os.sep) and full_path != media_root:
        raise Http404

    if not os.path.isfile(full_path):
        raise Http404

    return FileResponse(open(full_path, "rb"))


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/token/", GuardedTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/me/", MeView.as_view(), name="api_me"),
    path("api/", include("monitor.urls")),
    # Serve uploaded media files (firmware binaries) — works in both dev and production.
    re_path(r"^media/(?P<path>.+)$", serve_media, name="serve_media"),
]
