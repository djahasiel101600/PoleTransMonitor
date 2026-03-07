#ifndef CONFIG_H
#define CONFIG_H

// Transformer nominal values (15 kVA @ 220V)
#define NOMINAL_VOLTAGE 220.0f
#define NOMINAL_FREQUENCY 60.0f
#define RATED_CURRENT 68.0f
#define RATED_APPARENT_POWER 15000.0f

// WiFi
#define WIFI_SSID "YOUR_SSID"
#define WIFI_PASSWORD "YOUR_PASSWORD"

// Backend
#define BACKEND_URL "http://192.168.1.100:8000"
#define TRANSFORMER_ID 1

// SIM7600 SMS
#define SMS_RECIPIENT "+639123456789"

// Sampling
#define SAMPLE_INTERVAL_MS 5000

#endif
