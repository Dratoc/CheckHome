---
name: chequeo-costo-azure
description: Revisa que los recursos de Azure del proyecto sigan en costo cero y recuerda el vencimiento de la prueba. Úsala antes de cualquier despliegue o una vez por semana.
---
Solo comandos de lectura:
1. `az account show` (confirma suscripción).
2. `az resource list --tag proyecto=app-hogar -o table` y revisa el SKU de cada uno.
3. `az consumption usage list --top 20 -o table` (si está disponible) para ver consumo.
4. Marca en rojo cualquier recurso fuera de capa gratuita o sin etiqueta.
5. Indica cuántos días faltan para el 13 dic 2026.
6. Entrega un resumen corto: todo OK / qué hay que revisar.
