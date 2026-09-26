"""Rutas de camión de respaldo (OSM de Chihuahua no trae relaciones route=bus).

Cada ruta son puntos (lng, lat) que el motor une con el camino más corto sobre la red real
y luego regresa, formando un circuito. Ajusten los puntos a las rutas reales que conozcan.
"""

# Nombres reales de rutas de Chihuahua; trazos APROXIMADOS por sus avenidas principales (no oficiales).
RUTAS = [
    {
        "id": "BI", "nombre": "Bowí ITCH II · Circuito Universitario", "color": "#0E9F8E",
        "puntos": [(-106.0767, 28.6364), (-106.0769, 28.6542), (-106.0917, 28.6672), (-106.1106, 28.6836), (-106.1077, 28.7084)],
    },
    {
        "id": "BU", "nombre": "Bowí UACH II · Circuito Universitario", "color": "#3D5AFE",
        "puntos": [(-106.0767, 28.6364), (-106.0776, 28.6436), (-106.0887, 28.6539), (-106.0913, 28.6563), (-106.1253, 28.6447)],
    },
    {
        "id": "C1", "nombre": "Circunvalación 1 · Sube Zarco", "color": "#8E44AD",
        "puntos": [(-106.0767, 28.6364), (-106.0776, 28.6436), (-106.0769, 28.6542), (-106.0659, 28.6734), (-106.0527, 28.64), (-106.062, 28.6212)],
    },
    {
        "id": "C2", "nombre": "Circunvalación 2 · Baja Mirador", "color": "#7C5CFF",
        "puntos": [(-106.0767, 28.6364), (-106.0822, 28.6311), (-106.1146, 28.6245), (-106.1253, 28.6447), (-106.0913, 28.6563)],
    },
    {
        "id": "T2", "nombre": "Tec II · Colón", "color": "#C5221F",
        "puntos": [(-106.0659, 28.6734), (-106.0769, 28.6542), (-106.0917, 28.6672), (-106.1177, 28.6957), (-106.1077, 28.7084)],
    },
    {
        "id": "15", "nombre": "Ruta 15 · Villa Juárez – Reloj", "color": "#34A853",
        "puntos": [(-106.088, 28.592), (-106.085, 28.61), (-106.08, 28.625), (-106.0767, 28.6364)],
    },
    {
        "id": "PA", "nombre": "Panamericana · San Felipe", "color": "#D81B60",
        "puntos": [(-106.0406, 28.623), (-106.0452, 28.6358), (-106.0527, 28.64), (-106.0767, 28.6364)],
    },
    {
        "id": "MV", "nombre": "Mármol · Vistas Cerro Grande", "color": "#7B61FF",
        "puntos": [(-106.0541, 28.5918), (-106.062, 28.6212), (-106.0722, 28.6269), (-106.0767, 28.6364)],
    },
    {
        "id": "RS", "nombre": "Riberas del Sacramento · Directo", "color": "#6D4C41",
        "puntos": [(-106.105, 28.715), (-106.096, 28.695), (-106.086, 28.67), (-106.0769, 28.6542), (-106.0767, 28.6364)],
    },
]
