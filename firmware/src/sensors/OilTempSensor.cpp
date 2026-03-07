#include "OilTempSensor.h"
#include <Adafruit_MAX31865.h>
#include <SPI.h>

#define RREF 430.0f
#define RNOMINAL 100.0f

static Adafruit_MAX31865* rtd = nullptr;

void OilTempSensor::begin(int csPin) {
  csPin_ = csPin;
  if (!rtd) {
    rtd = new Adafruit_MAX31865(csPin);
  }
  rtd->begin(MAX31865_3WIRE);
  initialized_ = true;
}

float OilTempSensor::readCelsius() {
  if (!initialized_ || !rtd) return NAN;
  return rtd->temperature(RNOMINAL, RREF);
}

bool OilTempSensor::read(float& tempC) {
  tempC = readCelsius();
  return initialized_ && !isnan(tempC);
}
