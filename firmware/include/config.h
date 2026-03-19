#ifndef CONFIG_H
#define CONFIG_H

// Transformer nominal values (15 kVA @ 220V)
#define NOMINAL_VOLTAGE 230.0f
#define NOMINAL_FREQUENCY 60.0f
#define RATED_CURRENT 68.0f
#define RATED_APPARENT_POWER 15000.0f

// WiFi & Backend — configured via config portal (AP "PoleTransMonitor-Setup") on first run or when connection fails.
// These are fallback defaults when nothing is saved in NVS yet.
#define WIFI_SSID "2.4GHz-Band-"
#define WIFI_PASSWORD "#2.4GHz-Band_21"
#define BACKEND_URL "http://192.168.1.5:8000"
#define TRANSFORMER_ID 1

// ESP32 config portal trigger
// Use a physical button wired to this GPIO and `GND`.
// Logic assumes active-low with INPUT_PULLUP (pressed => LOW).
#define PORTAL_BUTTON_GPIO 27
// Hold button for this long (ms) to open the WiFiManager portal.
#define PORTAL_LONG_PRESS_MS 3000

// SIM A7670E SMS (set to 1 to enable)
#define ENABLE_SIM 1
#define SMS_RECIPIENT "+639922790155"
// Send one test SMS when modem is ready (set to 1 to verify SMS path)
#define SEND_TEST_SMS_ON_BOOT 0
#define TEST_SMS_MESSAGE "PoleTransMonitor test - SMS working"
// Reply with transformer status when someone sends the status command via SMS
#define ENABLE_SMS_STATUS_REPLY 1
#define SMS_STATUS_COMMAND "STATUS"   // Incoming SMS body (case-insensitive, trimmed) triggers status reply

// Modem UART (A7670E). Serial2; use 25/26 (free, both bidirectional). Modem TXD->25, RXD<-26
#define SIM_RX_PIN  25
#define SIM_TX_PIN  26
#define SIM_BAUD    115200
#define SIM_PWR_PIN 4    // PWE_EN: LOW 1.5s then HIGH to power on (0 = not used)
#define SIM_SWAP_RX_TX  0   // Set to 1 if RX/TX appear swapped. ESP32: GPIO 34 is input-only (cannot be TX)

// Sampling 
#define SAMPLE_INTERVAL_MS 5000

// Debug output to Serial (set to 0 to disable)
#define DEBUG_SERIAL 1

// Enable TinyGSM AT command debug (requires DEBUG_SERIAL=1)
// Uncomment to see raw AT commands and responses from modem
#define TINY_GSM_DEBUG Serial

#endif
