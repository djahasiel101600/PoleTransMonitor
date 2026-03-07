# Pole Transformer Smart Monitoring System

Real-time condition monitoring for single-phase pole-mounted distribution transformers (15 kVA and below). Monitors electrical and thermal parameters, detects faults via Table 3.1 thresholds, and sends SMS alerts via GSM.

## Architecture

- **Firmware (ESP32)**: PZEM-004T energy monitor, MAX31865 oil temperature sensor, SIM7600 LTE/SMS. WiFi primary for backend, LTE fallback.
- **Backend (Django REST + Channels)**: REST API for readings, WebSocket for real-time push.
- **Frontend (React + Vite + Shadcn)**: Live dashboard, condition badges, alerts.

## Quick Start

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env (REDIS_URL, SECRET_KEY, etc.)
python manage.py migrate
python manage.py createsuperuser  # optional
python manage.py runserver
# Or with WebSocket: daphne -b 0.0.0.0 -p 8000 config.asgi:application
```

**Note:** Redis must be running for WebSocket support (`redis-server` or Docker).

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

### Firmware (PlatformIO)

```bash
cd firmware
# Install PlatformIO CLI: pip install platformio
pio run
pio run -t upload
pio device monitor
```

Edit `firmware/include/config.h` with WiFi, backend URL, transformer ID, and SMS recipient.

## Hardware Wiring

| Component   | Connection        |
|------------|--------------------|
| PZEM-004T  | UART2: RX=16, TX=17 |
| MAX31865   | SPI: MOSI=23, MISO=19, SCK=18, CS=5 |
| SIM7600    | UART1: RX=34, TX=32 |

## Threshold Reference (Table 3.1)

| Parameter      | Normal      | Warning              | Critical       |
|----------------|-------------|----------------------|----------------|
| Oil temp       | 50–75°C     | 75–90°C (heavy peak) | >95°C (danger) |
| Voltage        | ±7% nominal | —                    | Outside ±7%    |
| Current        | ≤100% rated | 100–125% overload    | >125% severe   |
| Apparent power | ≤100%       | 100–125% heavy       | >125% severe   |
| Frequency      | ±1 Hz       | —                    | Outside ±2 Hz  |
| Power factor   | ≥0.85       | 0.70–0.85 poor       | <0.70 critical |

## Project Structure

```
PoleTransMonitor/
├── firmware/          # ESP32 PlatformIO
│   ├── include/
│   ├── src/
│   │   ├── sensors/
│   │   ├── connectivity/
│   │   └── fault/
│   └── platformio.ini
├── backend/           # Django REST + Channels
├── frontend/          # React + Vite + Shadcn
└── README.md
```

## License

MIT
