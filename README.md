# AutonomousDrone

An ESP32-based autonomous drone firmware project featuring RC signal forwarding, IMU-based orientation sensing, and GPS telemetry. The codebase is written in C/C++ targeting the Arduino framework and is split into three independent test modules.

---

##  Project Structure

```
AutonomousDrone/
└── test/
    ├── GPS_NEO6M.c         # GPS telemetry via NEO-6M module (UART)
    ├── MPU6050.c           # IMU orientation sensing (I2C, Kalman filter)
    └── SignalForwarding.c  # 6-channel RC PWM pass-through with neutral adjustment
```

---

##  Modules

### 1. `GPS_NEO6M.c` — GPS Telemetry

Reads NMEA sentences from a **u-blox NEO-6M** GPS module over UART and decodes them using the **TinyGPSPlus** library. Location data is printed to the Serial Monitor every second.

**Reported fields:**
- Latitude / Longitude (6 decimal places, with hemisphere indicator)
- Fix validity
- Satellite count
- Altitude (meters)
- Speed (km/h)
- Course (degrees)
- UTC Date & Time

**Wiring (ESP32):**
| GPS Pin | ESP32 Pin |
|---------|-----------|
| TX      | GPIO 16 (RX2) |
| RX      | GPIO 17 (TX2) |
| VCC     | 3.3V / 5V |
| GND     | GND       |

**Serial baud rates:** GPS → 9600 bps, Debug Monitor → 115200 bps

---

### 2. `MPU6050.c` — IMU Orientation (Pitch & Roll)

Interfaces with an **MPU-6050** 6-axis IMU over I2C using the **MPU6050_light** library (Kalman/complementary filter built-in). Runs a **50 Hz update loop** (every 20 ms) and prints pitch and roll angles to the Serial Monitor.

**Key features:**
- Automatic gyroscope & accelerometer calibration on startup (keep sensor still!)
- Pitch (X-axis) and Roll (Y-axis) output with 1 decimal-place precision
- Robust re-connection loop if the sensor is not found

**Wiring (ESP32 default I2C):**
| MPU6050 Pin | ESP32 Pin |
|-------------|-----------|
| SDA         | GPIO 21   |
| SCL         | GPIO 22   |
| VCC         | 3.3V      |
| GND         | GND       |

---

### 3. `SignalForwarding.c` — 6-Channel RC PWM Pass-Through

Reads 6-channel **PWM signals** from an RC receiver using hardware interrupts, then regenerates identical PWM signals on 6 output pins for ESCs or servos. Uses an ESP32 hardware timer (1 µs resolution) for precise pulse generation at **50 Hz**.

**Features:**
- Interrupt-driven input capture (rising/falling edge, microsecond timing)
- PWM clamping: valid range 1000–2000 µs (out-of-range values snapped to limits)
- Neutral dead-band adjustment (1490–1510 µs → forced to 1500 µs)
- Hardware timer ISR for low-latency output pulse termination
- 4× LED blink startup sequence on GPIO 15
- Serial debug output every 100 ms (all 6 channel values)

**Pin Mapping:**

| Channel | Input (Receiver) | Output (ESC/Servo) |
|---------|------------------|--------------------|
| CH1     | GPIO 34          | GPIO 18            |
| CH2     | GPIO 35          | GPIO 19            |
| CH3     | GPIO 32          | GPIO 21            |
| CH4     | GPIO 33          | GPIO 22            |
| CH5     | GPIO 25          | GPIO 23            |
| CH6     | GPIO 26          | GPIO 27            |

> **Note:** GPIO 34, 35 are input-only pins on the ESP32 — ideal for receiver signals.

---

##  Hardware Requirements

| Component         | Details                          |
|-------------------|----------------------------------|
| Microcontroller   | ESP32 (any dev board)            |
| IMU               | MPU-6050 (I2C)                   |
| GPS               | u-blox NEO-6M (UART/Serial2)     |
| RC Receiver       | Any standard PWM receiver (6ch)  |
| ESCs / Servos     | Standard 50 Hz PWM compatible    |

---

##  Dependencies

| Library          | Module          | Install via Arduino Library Manager |
|------------------|-----------------|--------------------------------------|
| `TinyGPSPlus`    | GPS_NEO6M       | Search "TinyGPSPlus" by Mikal Hart |
| `Wire`           | MPU6050         | Built-in (ESP32 Arduino core)        |
| `MPU6050_light`  | MPU6050         | Search "MPU6050_light" by rfetick  |

---

##  Getting Started

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/AutonomousDrone.git
   ```

2. **Open the desired sketch** from the `test/` folder in the Arduino IDE (or PlatformIO).

3. **Install dependencies** via the Arduino Library Manager (see table above).

4. **Select your board:** `Tools → Board → ESP32 Dev Module`

5. **Wire up** the hardware according to the pin maps above.

6. **Upload** and open the Serial Monitor at **115200 baud**.

---

## Notes

- Each file in `test/` is a **standalone sketch** intended for individual module testing before full integration.
- During MPU6050 calibration, **keep the sensor perfectly still** for accurate offsets.
- The GPS module may take up to **60 seconds** to acquire a satellite fix outdoors.
- The `SignalForwarding` module uses `IRAM_ATTR` on ISRs to ensure they run from internal RAM for real-time reliability.

---

##  License

This project is licensed under the **Apache License 2.0**. See the [LICENSE](LICENSE) file for details.