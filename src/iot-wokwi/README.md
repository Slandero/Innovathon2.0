# IoT sin hardware: ESP32 simulado en Wokwi

1. Entra a https://wokwi.com → "New project" → ESP32.
2. Pega `sketch.ino` en el editor y `diagram.json` en la pestaña diagram.json.
3. Cambia `ENDPOINT` por la URL de la Cloud Function `/lectura`.
4. Dale Play. Gira la perilla = cambia el caudal del pozo. El LED rojo prende si pasa el límite.

En la demo: proyectar Wokwi junto al mapa en React y girar la perilla en vivo.
