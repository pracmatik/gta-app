# tests/

Regresión automática del motor de cálculo de `index.html`, ejecutada por
GitHub Actions en cada `push`/`pull_request` a `main` (ver
`.github/workflows/ci.yml`).

- `regres.js` — extrae las funciones reales de cálculo de `index.html` (sin
  tocarlo), las ejecuta en un sandbox de Node contra los fixtures de
  `fixtures/` y compara el total obtenido con el total esperado congelado en
  cada fixture. También comprueba que todos los bloques `<script>` del HTML
  compilan sin error de sintaxis.
- `fixtures/*.json` — casos de prueba con datos **inventados** (obras,
  descripciones y precios ficticios, sin relación con clientes reales).

Uso local:

```
node tests/regres.js
```

Este arnés es un espejo simplificado, con datos anonimizados, del arnés de
regresión interno de Pracmatik (que sí usa el corpus de obras reales del
cliente y no se sube a este repositorio público).
