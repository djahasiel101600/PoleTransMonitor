from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r"ws/monitor/(?P<transformer_id>\d+)/$", consumers.MonitorConsumer.as_asgi()),
]
