from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register("transformers", views.TransformerViewSet, basename="transformer")
router.register("readings", views.ReadingViewSet, basename="reading")
router.register("alerts", views.AlertViewSet, basename="alert")

urlpatterns = [
    path("", include(router.urls)),
    path("health/", views.HealthView.as_view(), name="api_health"),
]
