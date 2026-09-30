# Shared Obrador (Kronos + portal-obrador)

Código único para no desincronizar OCR/parser entre Electron y el portal móvil.

| Archivo | Uso |
|---------|-----|
| `albaranParser.js` | Parseo de texto OCR → borrador recepción |
| `ocrFromFile.js` | Tesseract + PDF.js |
| `ocrDebug.js` | Informe depuración OCR |
| `traceCode.js` | Extracción/normalización de códigos QR |

Los wrappers en `src/` y `portal-obrador/src/` solo reexportan desde aquí.
En el portal, `obradorOcrFromFile.js` configura el worker de PDF.js con Vite (`?url`) antes del reexport.

**Editar siempre estos ficheros** (`shared/obrador/`), no las copias wrapper.
