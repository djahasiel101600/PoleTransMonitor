#ifndef OIL_TEMP_SENSOR_H
#define OIL_TEMP_SENSOR_H

#include <Arduino.h>

class OilTempSensor {
 public:
  void begin(int csPin = 5);
  float readCelsius();
  bool read(float& tempC);
  // Returns MAX31865 fault register (0 = no fault)
  uint8_t readFault();

 private:
  bool initialized_ = false;
  int csPin_ = 5;
};

#endif
