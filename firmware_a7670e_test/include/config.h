#ifndef CONFIG_H
#define CONFIG_H

// A7670E UART (ESP32). Hardware: SIM A7670E | UART1: RX=34, TX=32
// Default baud for A7670E is 115200 (Waveshare/SIMCom). Use 9600 only if your module is set to 9600.
#define SIM_RX_PIN  34
#define SIM_TX_PIN  32
#define SIM_BAUD    115200
#define SIM_SWAP_RX_TX  1   // Set to 1 if RX/TX appear swapped (ESP32: 34 is input-only, cannot be TX)
#define SIM_TRY_9600_IF_FAIL  1   // If 1, try 9600 baud after 115200 fails (some boards use 9600)

// Test SMS: set to a number to send a test SMS (e.g. "+639058122818")
#define TEST_SMS_RECIPIENT  "09058122818"
#define TEST_SMS_MESSAGE    "A7670E test from PoleTransMonitor"
#define ENABLE_TEST_SMS     1   // Set to 1 to send test SMS (recipient must be set)

// Modem boot wait (ms). A7670E can take 5–15 s to boot.
#define MODEM_BOOT_MS       12000

#endif
