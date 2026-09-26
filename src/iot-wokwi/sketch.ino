// Pozo Vivo — medidor de caudal simulado en Wokwi (ESP32)
// La perilla (potenciómetro) simula el sensor de flujo: girarla = cambiar el caudal del pozo.
// Cada 5 s envía la lectura a la Cloud Function y enciende el LED si el pozo se pasa del límite.

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

const char* WIFI_SSID = "Wokwi-GUEST";   // red con internet que da Wokwi
const char* WIFI_PASS = "";

// Reemplazar con la URL de la Cloud Function /lectura cuando exista
const char* ENDPOINT = "https://REEMPLAZAR.cloudfunctions.net/lectura";
const char* POZO_ID  = "CHIH-001";

const int PIN_SENSOR = 34;
const int PIN_LED    = 2;
const float CAUDAL_MAX_LPS   = 60.0;  // tope físico de la bomba simulada
const float CAUDAL_LIMITE_LPS = 40.0; // límite de la concesión (para el LED local)
const unsigned long INTERVALO_MS = 5000;

float volumenAcumuladoM3 = 0;
unsigned long ultimoEnvio = 0;

void setup() {
  Serial.begin(115200);
  pinMode(PIN_LED, OUTPUT);
  WiFi.begin(WIFI_SSID, WIFI_PASS, 6);
  Serial.print("Conectando a WiFi");
  while (WiFi.status() != WL_CONNECTED) { delay(250); Serial.print("."); }
  Serial.println(" listo");
}

void loop() {
  if (millis() - ultimoEnvio < INTERVALO_MS) return;
  ultimoEnvio = millis();

  float caudalLps = analogRead(PIN_SENSOR) / 4095.0 * CAUDAL_MAX_LPS;
  volumenAcumuladoM3 += caudalLps * (INTERVALO_MS / 1000.0) / 1000.0;
  digitalWrite(PIN_LED, caudalLps > CAUDAL_LIMITE_LPS ? HIGH : LOW);

  String json = String("{\"pozoId\":\"") + POZO_ID +
                "\",\"caudal_lps\":" + String(caudalLps, 2) +
                ",\"volumen_m3\":" + String(volumenAcumuladoM3, 3) + "}";
  Serial.println(json);

  WiFiClientSecure cliente;
  cliente.setInsecure();  // suficiente para la demo; en producción validar certificado
  HTTPClient http;
  http.begin(cliente, ENDPOINT);
  http.addHeader("Content-Type", "application/json");
  int codigo = http.POST(json);
  Serial.printf("HTTP %d\n", codigo);
  http.end();
}
