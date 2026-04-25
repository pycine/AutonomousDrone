// ========== INPUT PINS (RC Receiver) ==========
const int channel_1_pin = 34;  // Input from receiver
const int channel_2_pin = 35;
const int channel_3_pin = 32;
const int channel_4_pin = 33;
const int channel_5_pin = 25;
const int channel_6_pin = 26;

// ========== OUTPUT PINS (To ESC/Servo) ==========
const int output_1_pin = 18;
const int output_2_pin = 19;
const int output_3_pin = 21;
const int output_4_pin = 22;
const int output_5_pin = 23;
const int output_6_pin = 27;

// ========== PWM Timing Variables ==========
volatile uint32_t current_time;
volatile uint32_t last_channel_1 = 0;
volatile uint32_t last_channel_2 = 0;
volatile uint32_t last_channel_3 = 0;
volatile uint32_t last_channel_4 = 0;
volatile uint32_t last_channel_5 = 0;
volatile uint32_t last_channel_6 = 0;
volatile uint32_t timer_1;
volatile uint32_t timer_2;
volatile uint32_t timer_3;
volatile uint32_t timer_4;
volatile uint32_t timer_5;
volatile uint32_t timer_6;
volatile int ReceiverValue[6];

// ========== Output PWM State ==========
volatile uint32_t output_start_time[6];
volatile bool output_active[6] = {false, false, false, false, false, false};

// ========== LED Pin ==========
const int led_pin = 15;

// ========== Input Interrupt Handler ==========
void IRAM_ATTR channelInterruptHandler() {
  current_time = micros();
  
  // Channel 1
  if (digitalRead(channel_1_pin)) {
    if (last_channel_1 == 0) {
      last_channel_1 = 1;
      timer_1 = current_time;
    }
  } else if (last_channel_1 == 1) {
    last_channel_1 = 0;
    ReceiverValue[0] = current_time - timer_1;
    // Clamp values to valid range (1000-2000 microseconds)
    if (ReceiverValue[0] < 800) ReceiverValue[0] = 1000;
    if (ReceiverValue[0] > 2200) ReceiverValue[0] = 2000;
  }

  // Channel 2
  if (digitalRead(channel_2_pin)) {
    if (last_channel_2 == 0) {
      last_channel_2 = 1;
      timer_2 = current_time;
    }
  } else if (last_channel_2 == 1) {
    last_channel_2 = 0;
    ReceiverValue[1] = current_time - timer_2;
    if (ReceiverValue[1] < 800) ReceiverValue[1] = 1000;
    if (ReceiverValue[1] > 2200) ReceiverValue[1] = 2000;
  }

  // Channel 3
  if (digitalRead(channel_3_pin)) {
    if (last_channel_3 == 0) {
      last_channel_3 = 1;
      timer_3 = current_time;
    }
  } else if (last_channel_3 == 1) {
    last_channel_3 = 0;
    ReceiverValue[2] = current_time - timer_3;
    if (ReceiverValue[2] < 800) ReceiverValue[2] = 1000;
    if (ReceiverValue[2] > 2200) ReceiverValue[2] = 2000;
  }

  // Channel 4
  if (digitalRead(channel_4_pin)) {
    if (last_channel_4 == 0) {
      last_channel_4 = 1;
      timer_4 = current_time;
    }
  } else if (last_channel_4 == 1) {
    last_channel_4 = 0;
    ReceiverValue[3] = current_time - timer_4;
    if (ReceiverValue[3] < 800) ReceiverValue[3] = 1000;
    if (ReceiverValue[3] > 2200) ReceiverValue[3] = 2000;
  }

  // Channel 5
  if (digitalRead(channel_5_pin)) {
    if (last_channel_5 == 0) {
      last_channel_5 = 1;
      timer_5 = current_time;
    }
  } else if (last_channel_5 == 1) {
    last_channel_5 = 0;
    ReceiverValue[4] = current_time - timer_5;
    if (ReceiverValue[4] < 800) ReceiverValue[4] = 1000;
    if (ReceiverValue[4] > 2200) ReceiverValue[4] = 2000;
  }

  // Channel 6
  if (digitalRead(channel_6_pin)) {
    if (last_channel_6 == 0) {
      last_channel_6 = 1;
      timer_6 = current_time;
    }
  } else if (last_channel_6 == 1) {
    last_channel_6 = 0;
    ReceiverValue[5] = current_time - timer_6;
    if (ReceiverValue[5] < 800) ReceiverValue[5] = 1000;
    if (ReceiverValue[5] > 2200) ReceiverValue[5] = 2000;
  }
}

// ========== Output PWM Generation (Using Timer ISR) ==========
hw_timer_t* pwm_timer = NULL;

void IRAM_ATTR onPwmTimer() {
  uint32_t now = micros();
  
  // Update all output pins based on their PWM state
  for (int i = 0; i < 6; i++) {
    if (output_active[i]) {
      // Check if pulse should end
      if ((now - output_start_time[i]) >= ReceiverValue[i]) {
        digitalWrite(output_pins[i], LOW);
        output_active[i] = false;
      }
    }
  }
}

// ========== Generate PWM on Output Pins ==========
void generateOutputPWMs() {
  uint32_t now = micros();
  static uint32_t last_frame_time = 0;
  
  // Refresh all outputs at 50Hz (20ms frame rate)
  if ((now - last_frame_time) >= 20000) {
    last_frame_time = now;
    
    for (int i = 0; i < 6; i++) {
      // Start new pulse
      digitalWrite(output_pins[i], HIGH);
      output_start_time[i] = now;
      output_active[i] = true;
    }
  }
}

// ========== Neutral Position Adjustment ==========
void neutralPositionAdjustment() {
  int min = 1490;
  int max = 1510;
  
  if (ReceiverValue[0] < max && ReceiverValue[0] > min) {
    ReceiverValue[0] = 1500;
  } 
  if (ReceiverValue[1] < max && ReceiverValue[1] > min) {
    ReceiverValue[1] = 1500;
  } 
  if (ReceiverValue[3] < max && ReceiverValue[3] > min) {
    ReceiverValue[3] = 1500;
  } 
  if (ReceiverValue[0] == ReceiverValue[1] && 
      ReceiverValue[1] == ReceiverValue[3] && 
      ReceiverValue[3] == ReceiverValue[0]) {
    ReceiverValue[0] = 1500;
    ReceiverValue[1] = 1500;
    ReceiverValue[3] = 1500;
  }
}

// ========== Output Pins Array ==========
const int output_pins[6] = {output_1_pin, output_2_pin, output_3_pin, 
                             output_4_pin, output_5_pin, output_6_pin};

// ========== Setup ==========
void setup() {
  Serial.begin(115200);

  // LED Blink Pattern
  int led_time = 100;
  pinMode(led_pin, OUTPUT);
  for (int i = 0; i < 4; i++) {
    digitalWrite(led_pin, LOW);
    delay(led_time);
    digitalWrite(led_pin, HIGH);
    delay(led_time);
  }
  digitalWrite(led_pin, LOW);
  delay(led_time);

  // Configure Input Pins
  pinMode(channel_1_pin, INPUT_PULLUP);
  pinMode(channel_2_pin, INPUT_PULLUP);
  pinMode(channel_3_pin, INPUT_PULLUP);
  pinMode(channel_4_pin, INPUT_PULLUP);
  pinMode(channel_5_pin, INPUT_PULLUP);
  pinMode(channel_6_pin, INPUT_PULLUP);

  // Configure Output Pins
  for (int i = 0; i < 6; i++) {
    pinMode(output_pins[i], OUTPUT);
    digitalWrite(output_pins[i], LOW);
  }

  // Attach Interrupts for Input Channels
  attachInterrupt(digitalPinToInterrupt(channel_1_pin), channelInterruptHandler, CHANGE);
  attachInterrupt(digitalPinToInterrupt(channel_2_pin), channelInterruptHandler, CHANGE);
  attachInterrupt(digitalPinToInterrupt(channel_3_pin), channelInterruptHandler, CHANGE);
  attachInterrupt(digitalPinToInterrupt(channel_4_pin), channelInterruptHandler, CHANGE);
  attachInterrupt(digitalPinToInterrupt(channel_5_pin), channelInterruptHandler, CHANGE);
  attachInterrupt(digitalPinToInterrupt(channel_6_pin), channelInterruptHandler, CHANGE);

  // Setup Timer for Output PWM Generation
  pwm_timer = timerBegin(0, 80, true);  // Timer 0, prescaler 80 (1us ticks)
  timerAttachInterrupt(pwm_timer, &onPwmTimer, true);
  timerAlarmWrite(pwm_timer, 100, true);  // Interrupt every 100 microseconds
  timerAlarmEnable(pwm_timer);
  
  Serial.println("RC Signal Forwarder Started");
  Serial.println("Input -> Output");
}

// ========== Main Loop ==========
void loop() {
  static uint32_t last_print = 0;
  
  // Apply neutral adjustment
  neutralPositionAdjustment();
  
  // Generate output PWM signals (called every loop)
  generateOutputPWMs();
  
  // Print values every 100ms for debugging
  if (millis() - last_print >= 100) {
    last_print = millis();
    
    Serial.print("CH1:");
    Serial.print(ReceiverValue[0]);
    Serial.print(" CH2:");
    Serial.print(ReceiverValue[1]);
    Serial.print(" CH3:");
    Serial.print(ReceiverValue[2]);
    Serial.print(" CH4:");
    Serial.print(ReceiverValue[3]);
    Serial.print(" CH5:");
    Serial.print(ReceiverValue[4]);
    Serial.print(" CH6:");
    Serial.println(ReceiverValue[5]);
  }
  
  delay(1);  // Small delay to prevent watchdog issues
}
