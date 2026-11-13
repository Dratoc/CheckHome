---
name: nueva-rama
description: Crea una rama de trabajo nueva desde main actualizado con el nombre correcto. Úsala al empezar cualquier tarea de código.
---
1. Pregunta (o deduce) el tipo: feat, fix, chore, db, infra o docs, y una descripción de 2-4 palabras.
2. Verifica que no haya cambios sin guardar (`git status`). Si los hay, avisa antes de seguir.
3. `git switch main && git pull --ff-only`
4. `git switch -c <tipo>/<descripcion-en-kebab-case>`
5. Confirma el nombre de la rama creada.
