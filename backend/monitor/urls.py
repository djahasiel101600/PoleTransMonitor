from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register("transformers", views.TransformerViewSet, basename="transformer")
router.register("readings", views.ReadingViewSet, basename="reading")
router.register("alerts", views.AlertViewSet, basename="alert")
router.register("contacts", views.SmsRecipientViewSet, basename="contact")
router.register("users", views.UserViewSet, basename="user")

urlpatterns = [
    path("", include(router.urls)),
    path("health/", views.HealthView.as_view(), name="api_health"),
    path("register/", views.RegisterView.as_view(), name="api_register"),
]
