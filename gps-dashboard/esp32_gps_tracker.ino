/*
 * ESP32 GPS Tracker — WiFi Edition
 * 
 * Reads GPS data from a GPS module via Serial2 and sends it
 * to the GPS Dashboard server over WiFi via HTTP POST.
 * 
 * Wiring:
 *   GPS TX -> ESP32 GPIO 9  (Serial2 RX)
 *   GPS RX -> ESP32 GPIO 10 (Serial2 TX)
 * 
 * SETUP:
 *   1. Update WIFI_SSID and WIFI_PASSWORD below
 *   2. Update SERVER_URL to your PC's IP address running the dashboard
 *   3. Upload to ESP32
 *   4. Start the dashboard server: node server.js
 *   5. Open http://localhost:3000 in your browser
 */

#include <TinyGPSPlus.h>
#include <WiFi.h>
#include <HTTPClient.h>

// ===== CONFIGURATION - UPDATE THESE =====
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* SERVER_URL    = "http://YOUR_PC_IP:3000/api/gps";
// =========================================

TinyGPSPlus gps;
#define gpsSerial Serial2

unsigned long lastSend = 0;
const unsigned long SEND_INTERVAL = 1500; // Send every 1.5 seconds

void setup() {
  Serial.begin(115200);
  gpsSerial.begin(9600, SERIAL_8N1, 9, 10);
  
  Serial.println("\n================================");
  Serial.println("  ESP32 GPS Tracker - WiFi");
  Serial.println("================================\n");
  
  // Connect to WiFi
  Serial.printf("Connecting to WiFi: %s", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✓ WiFi Connected!");
    Serial.print("  IP Address: ");
    Serial.println(WiFi.localIP());
    Serial.printf("  Sending data to: %s\n\n", SERVER_URL);
  } else {
    Serial.println("\n✗ WiFi connection failed!");
    Serial.println("  GPS data will only be shown on Serial.");
    Serial.println("  Check SSID and password.\n");
  }
  
  Serial.println("Waiting for GPS fix and satellites...\n");
}

void loop() {
  // Read GPS data
  while (gpsSerial.available() > 0) {
    if (gps.encode(gpsSerial.read())) {
      // Only send at interval to avoid flooding
      if (millis() - lastSend >= SEND_INTERVAL) {
        lastSend = millis();
        displayLocationInfo();
        sendToServer();
      }
    }
  }

  // Check for GPS module
  if (millis() > 5000 && gps.charsProcessed() < 10) {
    Serial.println(F("No GPS detected: check wiring."));
    while (true);
  }
}

void sendToServer() {
  if (WiFi.status() != WL_CONNECTED) {
    // Try to reconnect
    WiFi.reconnect();
    return;
  }
  
  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  
  // Build JSON payload
  char json[512];
  snprintf(json, sizeof(json),
    "{"
      "\"lat\":%.6f,"
      "\"lng\":%.6f,"
      "\"alt\":%.2f,"
      "\"speed\":%.2f,"
      "\"course\":%.2f,"
      "\"satellites\":%d,"
      "\"valid\":%s,"
      "\"date\":\"%02d/%02d/%04d\","
      "\"time\":\"%02d:%02d:%02d\""
    "}",
    gps.location.lat(),
    gps.location.lng(),
    gps.altitude.meters(),
    gps.speed.kmph(),
    gps.course.deg(),
    gps.satellites.value(),
    gps.location.isValid() ? "true" : "false",
    gps.date.isValid() ? gps.date.day() : 0,
    gps.date.isValid() ? gps.date.month() : 0,
    gps.date.isValid() ? gps.date.year() : 0,
    gps.time.isValid() ? gps.time.hour() : 0,
    gps.time.isValid() ? gps.time.minute() : 0,
    gps.time.isValid() ? gps.time.second() : 0
  );
  
  int httpCode = http.POST(json);
  
  if (httpCode == 200) {
    Serial.println("→ Data sent to dashboard ✓");
  } else {
    Serial.printf("→ Send failed (HTTP %d)\n", httpCode);
  }
  
  http.end();
}

void displayLocationInfo() {
  Serial.println(F("-------------------------------------"));
  Serial.println("\n Location Info:");

  Serial.print("Latitude:  ");
  Serial.print(gps.location.lat(), 6);
  Serial.print(" ");
  Serial.println(gps.location.rawLat().negative ? "S" : "N");

  Serial.print("Longitude: ");
  Serial.print(gps.location.lng(), 6);
  Serial.print(" ");
  Serial.println(gps.location.rawLng().negative ? "W" : "E");

  Serial.print("Fix Quality: ");
  Serial.println(gps.location.isValid() ? "Valid" : "Invalid");

  Serial.print("Satellites: ");
  Serial.println(gps.satellites.value());

  Serial.print("Altitude:   ");
  Serial.print(gps.altitude.meters());
  Serial.println(" m");

  Serial.print("Speed:      ");
  Serial.print(gps.speed.kmph());
  Serial.println(" km/h");

  Serial.print("Course:     ");
  Serial.print(gps.course.deg());
  Serial.println("°");

  Serial.print("Date:       ");
  if (gps.date.isValid()) {
    Serial.printf("%02d/%02d/%04d\n", gps.date.day(), gps.date.month(), gps.date.year());
  } else {
    Serial.println("Invalid");
  }

  Serial.print("Time (UTC): ");
  if (gps.time.isValid()) {
    Serial.printf("%02d:%02d:%02d\n", gps.time.hour(), gps.time.minute(), gps.time.second());
  } else {
    Serial.println("Invalid");
  }

  Serial.println(F("-------------------------------------"));
}
