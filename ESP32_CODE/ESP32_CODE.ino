#include <WiFi.h>
#include <FirebaseESP32.h>
#include <DHT.h>
#include <addons/TokenHelper.h>  // Para tokenStatusCallback

// WiFi
#define WIFI_SSID "lucky-mochitta 2.4"
#define WIFI_PASSWORD "34335846"

// Firebase
#define FIREBASE_HOST "house-iot-e4af8-default-rtdb.firebaseio.com/"
#define FIREBASE_AUTH "KCfXecRPDKIPFQgqE2MsQXLK6kYzuSDQ9d1cMbl0"

// Pines sensores
#define DHT_PIN 23
#define DHT_TYPE DHT11
#define PIR_PIN 22

// Pines LEDs
#define LED_COUNT 4
const int LED_PINS[LED_COUNT] = {2, 4, 5, 18};

// Pines motor
#define MOTOR_PIN_A 13
#define MOTOR_PIN_B 12

#define BUZZER_PIN 19


// Objetos y estados
FirebaseData fbdo;
FirebaseConfig config;
FirebaseAuth auth;
DHT dht(DHT_PIN, DHT_TYPE);

bool ledState[LED_COUNT] = {false};
float temperature = 0.0;
float humidity = 0.0;
bool motion = false;
bool firebaseReady = false;
bool motorRunning = false;
unsigned long motorStartTime = 0;
String motorDirection = "stop";
bool alarmActive = false;


void setupWiFi() {
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int tries = 0;
  while (WiFi.status() != WL_CONNECTED && tries < 20) {
    delay(500);
    tries++;
  }
  if (WiFi.status() != WL_CONNECTED) {
    ESP.restart();
  }
}

void setupFirebase() {
  config.api_key = "";  // No se usa si hay legacy_token
  config.database_url = String("https://") + FIREBASE_HOST;
  config.signer.tokens.legacy_token = FIREBASE_AUTH;
  config.token_status_callback = tokenStatusCallback;
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
  delay(1000);
  firebaseReady = Firebase.ready();
}

void setup() {
  Serial.begin(115200);
  Serial.println("Iniciando sensores...");
  dht.begin();
  delay(2000);

  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);  // Iniciar apagado


  float test = dht.readTemperature();
  if (isnan(test)) {
    Serial.println("⚠️ DHT11 no está respondiendo.");
  } else {
    Serial.println("✅ DHT11 conectado correctamente.");
  }

  pinMode(PIR_PIN, INPUT);

  for (int i = 0; i < LED_COUNT; i++) {
    pinMode(LED_PINS[i], OUTPUT);
    digitalWrite(LED_PINS[i], LOW);
  }

  pinMode(MOTOR_PIN_A, OUTPUT);
  pinMode(MOTOR_PIN_B, OUTPUT);
  digitalWrite(MOTOR_PIN_A, LOW);
  digitalWrite(MOTOR_PIN_B, LOW);

  setupWiFi();
  setupFirebase();
}

void loop() {
  static unsigned long lastRead = 0;
  static unsigned long lastCmd = 0;
  static unsigned long lastMotorCheck = 0;

  if (!firebaseReady) return;

  if (millis() - lastRead > 5000) {
    readSensors();
    lastRead = millis();
  }

  if (millis() - lastCmd > 1000) {
    checkLedCommands();
    lastCmd = millis();
  }

  if (millis() - lastMotorCheck > 1000) {
    checkMotorCommand();
    lastMotorCheck = millis();
  }
}

void readSensors() {
  float t = dht.readTemperature();
  float h = dht.readHumidity();

  // Leer PIR
  bool pir = digitalRead(PIR_PIN);
  motion = pir;

  if (!isnan(t)) temperature = t;
  if (!isnan(h)) humidity = h;

  Serial.printf("Temp: %.1f Hum: %.1f Motion: %s\n", temperature, humidity, motion ? "true" : "false");

  // Actualizar datos en Firebase
  if (!Firebase.setFloat(fbdo, "/Sensores/temperatura", temperature))
    Serial.println("Error enviando temperatura: " + fbdo.errorReason());

  if (!Firebase.setFloat(fbdo, "/Sensores/humedad", humidity))
    Serial.println("Error enviando humedad: " + fbdo.errorReason());

  if (!Firebase.setBool(fbdo, "/Sensores/motion", motion))
    Serial.println("Error enviando motion: " + fbdo.errorReason());

  // Verificar estado de alarma
  if (Firebase.getBool(fbdo, "/Alarm/active")) {
    alarmActive = fbdo.boolData();
  } else {
    Serial.println("Error leyendo estado de alarma: " + fbdo.errorReason());
  }

  // Activar buzzer solo si alarma está activa y hay movimiento
  if (alarmActive && motion) {
    digitalWrite(BUZZER_PIN, HIGH);
    Serial.println("🔔 Buzzer activado por movimiento");
  } else {
    digitalWrite(BUZZER_PIN, LOW);
  }
}


void checkLedCommands() {
  for (int i = 0; i < LED_COUNT; i++) {
    String path = "/Leds/" + String(i) + "/state";

    if (Firebase.getBool(fbdo, path)) {
      bool state = fbdo.boolData();
      if (ledState[i] != state) {
        ledState[i] = state;
        digitalWrite(LED_PINS[i], state ? HIGH : LOW);
        Serial.printf("LED %d: %s\n", i, state ? "ON" : "OFF");
      }
    } else {
      Serial.printf("Error leyendo LED %d: %s\n", i, fbdo.errorReason().c_str());
    }
  }
}

void checkMotorCommand() {
  // 1. Si el motor está en marcha, verifica si ya pasaron 3 segundos
  if (motorRunning) {
    if (millis() - motorStartTime >= 1000) {
      digitalWrite(MOTOR_PIN_A, LOW);
      digitalWrite(MOTOR_PIN_B, LOW);
      motorRunning = false;
      motorDirection = "stop";

      // Actualiza el comando en Firebase a "stop"
      Firebase.setString(fbdo, "/Curtain/command", "stop");

      Serial.println("Motor detenido automáticamente después de 3s");
    }
    return;  // Ignora nuevos comandos mientras está ejecutando
  }

  // 2. Solo se ejecuta si el motor está libre
  if (Firebase.getString(fbdo, "/Curtain/command")) {
    String cmd = fbdo.stringData();

    // Solo ejecutar si el comando es diferente del anterior y válido
    if (cmd == "down" && motorDirection != "down") {
      motorDirection = "down";
      digitalWrite(MOTOR_PIN_A, LOW);
      digitalWrite(MOTOR_PIN_B, HIGH);
      motorStartTime = millis();
      motorRunning = true;
      Serial.println("Persiana bajando (3s)");
    } else if (cmd == "up" && motorDirection != "up") {
      motorDirection = "up";
      digitalWrite(MOTOR_PIN_A, HIGH);
      digitalWrite(MOTOR_PIN_B, LOW);
      motorStartTime = millis();
      motorRunning = true;
      Serial.println("Persiana subiendo (3s)");
    }
    // Si el comando es "stop" pero no venía de movimiento, solo detiene
    else if (cmd == "stop") {
      digitalWrite(MOTOR_PIN_A, LOW);
      digitalWrite(MOTOR_PIN_B, LOW);
      motorDirection = "stop";
      motorRunning = false;
      Serial.println("Motor detenido manualmente");
    }
  } else {
    Serial.println("Error leyendo comando del motor: " + fbdo.errorReason());
  }
}


