# Kronos · Módulo de firma: página de evidencias + sello PAdES

## Contexto

Kronos (Electron + React + Supabase) genera PDFs de acuse de recibo firmados con **firma electrónica simple** (DNI en portal + selfie + OTP por SMS). Hoy el PDF final lo produce **pdf-lib**, que dibuja un recuadro verde "Aceptación electrónica (Kronos)" encima de la última página del documento original.

Al revisar un PDF firmado real se han detectado dos problemas que hay que resolver:

1. **Sin firma criptográfica.** `pdfsig` indica "does not contain any signatures". El recuadro es texto plano, así que cualquiera puede editarlo sin que quede rastro.
2. **El sello tapa contenido firmado.** En la última página, el recuadro se superpone al pie de página del documento original (datos del servicio de prevención), y parte de ese contenido deja de verse.

No se cambia el flujo de identificación (DNI, selfie, OTP). Solo cambia **cómo se construye y se cierra el PDF final**.

## Paso 0 · Localizar el código actual

- Buscar en el repo el texto `Aceptación electrónica (Kronos)` y los usos de `pdf-lib` (`PDFDocument.load`, `drawText`, `drawRectangle`).
- Identificar dónde se ejecuta: proceso main de Electron, backend Node o Supabase Edge Function (Deno).
- Identificar dónde se guardan el hash original, el token, la IP, el UA y los timestamps (tabla de Supabase).
- **Antes de tocar nada, resumir en un comentario el flujo actual.**

## Tarea A · Página de evidencias (sustituye al recuadro superpuesto)

1. **Eliminar** el dibujo del recuadro sobre la última página del documento original. Las páginas originales no se modifican.
2. Añadir **una página nueva al final** (`pdfDoc.addPage()`), con el mismo tamaño que la última página del original (normalmente A4).
3. Título de la página: **"Hoja de evidencias de aceptación electrónica"**.
4. Contenido, en este orden:
   - Emisor: razón social **tal como figura en el documento** (p. ej. `SOLUCIONS SOCIALS SCCL`) y el NIF.
   - Documento: título legible (p. ej. "Ficha informativa de riesgos específicos del puesto – Camareros/as sala"), nº de páginas del original y referencia del documento.
   - Declaración aceptada: "Información recibida y aceptada (art. 18 LPRL): Sí".
   - Trabajador: nombre y DNI.
   - Verificaciones: DNI confirmado en portal, foto de identidad recibida, OTP completada, cada una con su timestamp.
   - Teléfono del OTP **enmascarado** (`+34 6•• ••• 412`).
   - Fecha/hora de firma.
   - **SHA-256 completo** del PDF original (64 caracteres, con salto de línea si no cabe).
   - Ref. del documento y token.
   - IP y **User-Agent completo** (con salto de línea).
   - Tipo de firma: "Firma electrónica simple · verificación por SMS · documento sellado electrónicamente por [razón social]".
5. **Fechas:** formatear siempre con `timeZone: 'Europe/Madrid'` y mostrar el offset (p. ej. `22/09/2026 16:33:06 (UTC+02:00)`). El servidor corre en UTC, y las fechas del sello actual salen en UTC sin indicarlo. En la base de datos se guardan en ISO 8601 UTC.
6. Tipografía: la fuente estándar de pdf-lib (Helvetica) no cubre todos los caracteres. Comprobar que se renderizan bien `·`, `•`, acentos y `ñ`. Si no, embeber una fuente TTF con `@pdf-lib/fontkit`.
7. Metadatos del PDF: `setTitle(<título del documento>)`, `setSubject('Acuse de recibo firmado electrónicamente')`, `setKeywords([ref, sha256Original])` y `setProducer('Kronos')`.

## Tarea B · Sello electrónico PAdES

### Librerías

- `@signpdf/signpdf`
- `@signpdf/placeholder-pdf-lib`
- `@signpdf/signer-p12`

Estas librerías son de Node. **Si la generación ocurre en una Supabase Edge Function (Deno), no pasarlas tal cual.** En ese caso, mover el paso de sellado a un endpoint Node (servidor propio o función serverless Node) y dejarlo indicado. **Nunca firmar en el cliente Electron**, porque el certificado no puede salir del servidor.

### Flujo (en este orden, sin saltos)

1. Cargar el PDF original y calcular `sha256Original` sobre los bytes originales.
2. Añadir la página de evidencias (Tarea A) y los metadatos.
3. `pdflibAddPlaceholder({ pdfDoc, reason, contactInfo, name, location })`
   - `reason`: "Acuse de recibo art. 18 LPRL – ref. <ref>"
   - `name`: razón social
   - `location`: "Barcelona"
4. `pdfDoc.save({ useObjectStreams: false })`. Es obligatorio para el placeholder.
5. `signpdf.sign(pdfBuffer, new P12Signer(p12Buffer, { passphrase }))`.
6. Calcular `sha256Firmado` sobre el buffer final.
7. Guardar en Supabase: `sha256_original`, `sha256_firmado`, `signed_at` (ISO UTC), el número de serie y el emisor del certificado usado.
8. Subir el PDF final a Storage.

**Regla crítica:** después del paso 5 no se puede modificar el PDF (nada de pdf-lib ni de metadatos). Cualquier cambio invalida la firma.

### Certificado

- **Producción:** certificado de **sello electrónico** de la cooperativa (persona jurídica). Lo gestiona dirección; no es tarea de Cursor.
- **Desarrollo:** generar un P12 autofirmado:

  ```bash
  openssl req -x509 -newkey rsa:2048 -keyout dev.key -out dev.crt -days 365 -nodes -subj "/CN=Kronos DEV/O=SSS DEV"
  openssl pkcs12 -export -out dev.p12 -inkey dev.key -in dev.crt -passout pass:devpass
  ```

- El P12 y su contraseña van en **variables de entorno o secretos** (`KRONOS_SEAL_P12_BASE64`, `KRONOS_SEAL_P12_PASS`). Nunca en el repo; añadir `*.p12` a `.gitignore`.

### Fuera de alcance (fase posterior)

- Sello de tiempo de una TSA (RFC 3161 / PAdES-T).
- Re-sellar documentos firmados antes de este cambio: se quedan como están.

## Criterios de aceptación

- [ ] `pdfsig documento.pdf` muestra 1 firma y "Signature is Valid" (con el certificado de desarrollo, "Certificate issuer isn't trusted" es lo esperado).
- [ ] Si se modifica un solo byte del PDF final con un editor hex, `pdfsig` marca la firma como inválida.
- [ ] Las páginas 1..N del PDF final se ven idénticas a las del original. Comprobarlo con `pdftoppm -r 80` de ambos y comparar las imágenes.
- [ ] La página de evidencias es la última (N+1) y no queda nada dibujado sobre páginas originales.
- [ ] Hash original y User-Agent aparecen completos y legibles, sin texto cortado fuera de márgenes.
- [ ] Las fechas salen en hora de Madrid con offset. Probar con una firma a hora conocida.
- [ ] En Supabase quedan guardados `sha256_original` y `sha256_firmado`, y este último coincide con `sha256sum` del archivo descargado de Storage.
- [ ] Ningún secreto del certificado aparece en logs ni en el cliente.
- [ ] `qpdf --check documento.pdf` no reporta errores.

---

## Estado implementación (código)

Implementado en `portal-firma`:

- `lib/pdfSign.ts` → `sealPdfWithEvidence` (hoja de evidencias + PAdES ETSI.CAdES.detached)
- `app/firmar/[token]/accept/route.ts` → usa el nuevo sellado (`runtime = 'nodejs'`)
- `database/alter_firma_documentos_pades_seal.sql` → columnas de hash/cert
- Smoke test: `npx tsx scripts/smoke-seal-pades.ts` (requiere `tmp-seal-test/dev.p12`)

**Pendiente operativo:** ejecutar el SQL en Supabase; en Netlify configurar sellos FNMT:

- `KRONOS_SEAL_P12_BASE64_SOLUCIONS` + `KRONOS_SEAL_P12_PASS_SOLUCIONS` (packs `EI_SSS`)
- `KRONOS_SEAL_P12_BASE64_MENJAR` + `KRONOS_SEAL_P12_PASS_MENJAR` (packs `MENJAR_DHORT`)
- Opcional fallback: `KRONOS_SEAL_P12_BASE64` + `KRONOS_SEAL_P12_PASS`

Desplegar portal-firma y validar con `pdfsig`.
