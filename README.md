# Pole Transformer Smart Monitoring System

Real-time condition monitoring for single-phase pole-mounted distribution transformers (15 kVA and below). Monitors electrical and thermal parameters, detects faults via Table 3.1 thresholds, and sends SMS alerts via GSM.

## Architecture

- **Firmware (ESP32)**: PZEM-004T energy monitor, MAX31865 oil temperature sensor, SIMCom A7670E LTE/SMS. WiFi primary for backend, LTE fallback.
- **Backend (Django REST + Channels)**: REST API for readings, WebSocket for real-time push.
- **Frontend (React + Vite + Shadcn)**: Live dashboard, condition badges, alerts.

## Quick Start

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
# PostgreSQL required — e.g. Docker:
# docker run --name poletrans-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=poletransmonitor -p 5432:5432 -d postgres:16
cp .env.example .env
# Edit .env (DATABASE_URL, REDIS_URL, SECRET_KEY, etc.)
python manage.py migrate
python manage.py createsuperuser  # optional
python manage.py runserver
# Or with WebSocket: daphne -b 0.0.0.0 -p 8000 config.asgi:application
```

**Note:** Redis must be running for WebSocket support (`redis-server` or Docker).

**Heroku:** See [`docs/DEPLOY_HEROKU_VERCEL.md`](docs/DEPLOY_HEROKU_VERCEL.md). The `backend/` folder includes `Procfile`, `runtime.txt`, Postgres via `DATABASE_URL`, and WhiteNoise for static files.

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
| SIM A7670E | UART1: RX=34, TX=32 |

### MAX31865 (Oil Temperature)

**RTD:** PT100, 3-wire. Firmware uses `MAX31865_3WIRE`, 430Ω reference, 100Ω nominal.

**Module pins → ESP32:**

| MAX31865 | Function | ESP32    |
|----------|----------|----------|
| CLK      | SPI clock | GPIO 18 (SCK)  |
| SDO      | Data out (MISO) | GPIO 19 |
| SDI      | Data in (MOSI)  | GPIO 23 |
| CS       | Chip select     | GPIO 5  |
| VIN      | Power            | 3.3V    |
| GND      | Ground           | GND     |
| RDY      | Ready (optional) | Not connected |

**3-wire PT100 (1 red, 1 black, 1 blue):**

| RTD wire | MAX31865 terminal |
|----------|-------------------|
| Red      | RTD+ (or 1)       |
| Black    | RTD- (or 2)       |
| Blue     | F+ (or 3 / sense) |

If readings are wrong, try swapping Black and Blue between RTD- and F+.

**Troubleshooting:** Readings of about -242°C indicate a fault (open circuit or bad wiring). Check RTD connections; a PT100 at ~25°C should measure ~109Ω.

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



