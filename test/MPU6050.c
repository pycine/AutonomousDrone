#include <Wire.h>
#include <MPU6050_light.h>

// Create the MPU6050 object
MPU6050 mpu(Wire);

// Variables to store angles
float pitch = 0;
float roll = 0;

// Timing for the 50Hz loop (20ms)
unsigned long timer = 0;

void setup() {
  Serial.begin(115200);
  Wire.begin(); // Initialize I2C (SDA=21, SCL=22 on default ESP32)

  Serial.println("Initializing MPU6050...");
  
  // Initialize the sensor and wait for it to be ready
  byte status = mpu.begin();
  while(status != 0){ 
    Serial.println("MPU6050 connection failed. Check wiring!");
    delay(5000);
    status = mpu.begin();
  }

  Serial.println("MPU6050 Found!");
  
  // --- Important: Calibrate the sensor ---
  // It calculates offsets for the gyroscope.
  // !!! KEEP THE SENSOR ABSOLUTELY STILL DURING THIS !!!
  Serial.println("Calibrating... Do NOT move the sensor.");
  mpu.calcOffsets(true, true); // Gyro & Accel calibration
  Serial.println("Calibration done! Kalman filter ready.");
  
  delay(1000);
}

void loop() {
  // Update the sensor data at ~50Hz (every 20ms)
  // This is crucial for the filter to work accurately [citation:1].
  if (millis() - timer > 20) { 
    mpu.update(); // Reads new data and updates the internal filter

    // Get the calculated angles
    // Pitch: X-axis rotation (-180 to 180)
    // Roll:  Y-axis rotation (-180 to 180)
    pitch = mpu.getAngleX();
    roll  = mpu.getAngleY();
    
    // Print the angles to the Serial Monitor
    Serial.print("Pitch (X): ");
    Serial.print(pitch, 1); // 1 decimal place
    Serial.print("  |  Roll (Y): ");
    Serial.println(roll, 1);

    timer = millis();
  }
}
