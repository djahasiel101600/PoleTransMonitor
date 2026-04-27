#ifndef PZEM_SENSOR_H
#define PZEM_SENSOR_H

struct PzemReading
{
  float voltage;
  float current;
  float power;
  float energy;
  float powerFactor;
  float frequency;
  bool valid;
};

class PzemSensor
{
public:
  void begin(int rxPin = 16, int txPin = 17);
  bool read(PzemReading &out);
  bool resetEnergy();

private:
  bool initialized_ = false;
  int rxPin_;
  int txPin_;
};

#endif
