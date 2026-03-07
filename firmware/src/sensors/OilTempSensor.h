#ifndef OIL_TEMP_SENSOR_H
#define OIL_TEMP_SENSOR_H

class OilTempSensor {
 public:
  void begin(int csPin = 5);
  float readCelsius();
  bool read(float& tempC);

 private:
  bool initialized_ = false;
  int csPin_ = 5;
};

#endif
