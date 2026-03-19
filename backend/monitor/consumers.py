import json
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from channels.generic.websocket import AsyncJsonWebsocketConsumer


def broadcast_reading(reading):
    channel_layer = get_channel_layer()
    group_name = f"monitor_{reading.transformer_id}"
    payload = {
        "type": "reading_update",
        "reading": {
            "id": reading.id,
            "transformer_id": reading.transformer_id,
            "timestamp": reading.timestamp.isoformat(),
            "voltage": reading.voltage,
            "current": reading.current,
            "apparent_power": reading.apparent_power,
            "real_power": reading.real_power,
            "power_factor": reading.power_factor,
            "frequency": reading.frequency,
            "oil_temp": reading.oil_temp,
            "energy_kwh": reading.energy_kwh,
            "condition": reading.condition,
        },
    }
    async_to_sync(channel_layer.group_send)(group_name, payload)


class MonitorConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.transformer_id = self.scope["url_route"]["kwargs"]["transformer_id"]
        self.group_name = f"monitor_{self.transformer_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def reading_update(self, event):
        await self.send_json(event)
