#ifndef CONFIG_H
#define CONFIG_H

// Transformer nominal values (15 kVA @ 220V)
#define NOMINAL_VOLTAGE 220.0f
#define NOMINAL_FREQUENCY 60.0f
#define RATED_CURRENT 68.0f
#define RATED_APPARENT_POWER 15000.0f

// WiFi
#define WIFI_SSID "2.4GHz-Band"
#define WIFI_PASSWORD "#2.4GHz-Band_21"

// Backend
#define BACKEND_URL "http://192.168.1.6:8000"
#define TRANSFORMER_ID 1

// SIM A7670E SMS (set to 1 to enable)
#define ENABLE_SIM 1
#define SMS_RECIPIENT "+639922790155"

// Modem UART (A7670E). Match your wiring. RX=25 (ESP32 RX <- modem TX), TX=26 (ESP32 TX -> modem RX).
#define SIM_RX_PIN  25
#define SIM_TX_PIN  26
#define SIM_BAUD    9600
// A7670E power enable: connect PWE_EN to this GPIO. Pulse LOW 1.5s then HIGH to power on. Set 0 if modem is always on.
#define SIM_PWR_PIN 4
#define SIM_SWAP_RX_TX  0   // Set to 1 if RX/TX appear swapped. ESP32: GPIO 34 is input-only (cannot be TX)

// Sampling 
#define SAMPLE_INTERVAL_MS 5000

// Debug output to Serial (set to 0 to disable)
#define DEBUG_SERIAL 1

// Enable TinyGSM AT command debug (requires DEBUG_SERIAL=1)
// Uncomment to see raw AT commands and responses from modem
#define TINY_GSM_DEBUG Serial

#endif
