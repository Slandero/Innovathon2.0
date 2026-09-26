# Tanque inteligente de lluvia — ESP32 simulado en Wokwi

1. https://wokwi.com → New project → ESP32.
2. Pega `sketch.ino` y `diagram.json`.
3. Cambia `ENDPOINT` por la URL de la Cloud Function `lecturaTanque`.
4. Play:
   - Haz clic en el sensor ultrasónico y mueve el deslizador de distancia → cambia el nivel del tanque.
   - Gira la perilla → cambia la turbidez del agua.
   - Mira los LEDs: azul = lleno, verde = apta, rojo = desvío.
