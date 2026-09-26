// Chihuahua Esponja — tanque inteligente de agua de lluvia (ESP32 simulado en Wokwi)
// Sensor ultrasónico HC-SR04 = nivel del tanque (en Wokwi se mueve con un deslizador)
// Potenciómetro = sensor de turbidez (NTU)
// LED azul  = tanque casi lleno
// LED verde = agua apta para uso doméstico no potable (después de filtro + UV)
// LED rojo  = agua turbia: la válvula de desvío (primer lavado) manda el agua al jardín / pozo de absorción

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

const char* WIFI_SSID = "Wokwi-GUEST";
const char* WIFI_PASS = "";
const char* ENDPOINT  = "https://REEMPLAZAR.cloudfunctions.net/lecturaTanque";
const char* TANQUE_ID = "CUU-CASA-001";

const int PIN_TRIG = 5, PIN_ECHO = 18, PIN_TURBIDEZ = 34;
const int PIN_LLENO = 25, PIN_APTA = 26, PIN_DESVIO = 27;

const float ALTURA_TANQUE_CM = 200.0;   // tanque de 5,000 L aprox.
const float CAPACIDAD_L      = 5000.0;
const float NTU_MAX          = 100.0;
const float NTU_USO_DOMESTICO = 5.0;    // umbral de referencia para agua clara
const unsigned long INTERVALO_MS = 5000;

unsigned long ultimoEnvio = 0;

float leerDistanciaCm() {
  digitalWrite(PIN_TRIG, LOW);  delayMicroseconds(2);
  digitalWrite(PIN_TRIG, HIGH); delayMicroseconds(10);
  digitalWrite(PIN_TRIG, LOW);
  return pulseIn(PIN_ECHO, HIGH, 30000) / 58.0;
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_TRIG, OUTPUT); pinMode(PIN_ECHO, INPUT);
  pinMode(PIN_LLENO, OUTPUT); pinMode(PIN_APTA, OUTPUT); pinMode(PIN_DESVIO, OUTPUT);
  WiFi.begin(WIFI_SSID, WIFI_PASS, 6);
  Serial.print("Conectando a WiFi");
  while (WiFi.status() != WL_CONNECTED) { delay(250); Serial.print("."); }
  Serial.println(" listo");
}

void loop() {
  if (millis() - ultimoEnvio < INTERVALO_MS) return;
  ultimoEnvio = millis();

  float distancia = constrain(leerDistanciaCm(), 0, ALTURA_TANQUE_CM);
  float nivelPct  = (ALTURA_TANQUE_CM - distancia) / ALTURA_TANQUE_CM * 100.0;
  float litros    = nivelPct / 100.0 * CAPACIDAD_L;
  float ntu       = analogRead(PIN_TURBIDEZ) / 4095.0 * NTU_MAX;

  bool apta   = ntu <= NTU_USO_DOMESTICO;
  const char* estado = apta ? "APTA_USO_DOMESTICO" : (ntu <= 50 ? "SOLO_RIEGO" : "DESVIO");

  digitalWrite(PIN_LLENO, nivelPct >= 90 ? HIGH : LOW);
  digitalWrite(PIN_APTA, apta ? HIGH : LOW);
  digitalWrite(PIN_DESVIO, strcmp(estado, "DESVIO") == 0 ? HIGH : LOW);

  String json = String("{\"tanqueId\":\"") + TANQUE_ID +
                "\",\"nivel_pct\":" + String(nivelPct, 1) +
                ",\"litros\":" + String(litros, 0) +
                ",\"turbidez_ntu\":" + String(ntu, 1) +
                ",\"estado\":\"" + estado + "\"}";
  Serial.println(json);

  WiFiClientSecure cliente;
  cliente.setInsecure();  // suficiente para la demo
  HTTPClient http;
  http.begin(cliente, ENDPOINT);
  http.addHeader("Content-Type", "application/json");
  Serial.printf("HTTP %d\n", http.POST(json));
  http.end();
}
