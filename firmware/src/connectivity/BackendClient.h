#ifndef BACKEND_CLIENT_H
#define BACKEND_CLIENT_H

struct ReadingPayload {
  int transformerId;
  float voltage;
  float current;
  float apparentPower;
  float powerFactor;
  float frequency;
  float oilTemp;
  const char* condition;
};

class BackendClient {
 public:
  void begin(const char* baseUrl, int transformerId);
  bool postReading(const ReadingPayload& payload);
  // Returns HTTP status code; -1 if not attempted (WiFi down)
  int postReadingWithStatus(const ReadingPayload& payload);

 private:
  char baseUrl_[128];
  int transformerId_ = 0;
};

#endif
