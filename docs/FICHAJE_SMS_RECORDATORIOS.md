# Recordatorios SMS de fichaje (piloto Lizeth)

Avisa por SMS si alguien no ficha **entrada** o **salida** a la hora esperada.  
Corre en **Supabase** (pg_cron + Edge Function). **Kronos no tiene que estar abierto.**

## Piloto acordado

| Campo | Valor |
|--------|--------|
| Persona | Lizeth Cifuentes (Holded: **ANGIE LIZETH**) |
| Holded ID | `67ad13cdfcf0a25c3408e132` |
| Móvil | `603121839` (de Holded) |
| Horario | Lun–Vie **09:00–17:00** (Europe/Madrid) |
| Tolerancia | **15 min** → SMS a las **09:15** (entrada) y **17:15** (salida) |
| Canal | Portal firma → Twilio (`https://firma.solucionssocials.org/api/firma/sms`) |

> En Holded hay **dos** fichas “ANGIE LIZETH”. Usamos la de email personal (`aliz.cifu@…`) con móvil. La de `gestio@solucionssocials.org` no tiene teléfono.

## 1. Tablas en Supabase

Ejecuta en el SQL Editor:

1. `database/create_fichajes_sms_recordatorios.sql`

Queda la fila de Lizeth con ID y móvil ya rellenados y `activo = false`.

## 2. Activar cuando el worker esté listo

```sql
UPDATE public.fichajes_sms_horarios
SET activo = true
WHERE empleado_id = '67ad13cdfcf0a25c3408e132';
```

## 3. Desplegar Edge Function

Desde la carpeta `seleccion-proveedores` (con [Supabase CLI](https://supabase.com/docs/guides/cli) logueado):

```bash
supabase functions deploy fichaje-sms-recordatorios --project-ref zalnsacawwekmibhoiba
```

Secrets (Dashboard → Edge Functions → Secrets, o CLI):

```bash
supabase secrets set FIRMA_SMS_API_BASE=https://firma.solucionssocials.org
supabase secrets set FIRMA_SMS_API_SECRET=EL_MISMO_SECRETO_DEL_PORTAL
```

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` ya los inyecta Supabase.

## 4. Activar cron

1. En Vault (o SQL de `database/cron_fichaje_sms_recordatorios.sql`):
   - `project_url` = `https://zalnsacawwekmibhoiba.supabase.co`
   - `service_role_key` = service role del proyecto
2. Ejecuta `database/cron_fichaje_sms_recordatorios.sql`

El job se llama `fichaje-sms-recordatorios-cada-5min`.

## 5. Probar a mano (antes del cron)

```bash
curl -X POST "https://zalnsacawwekmibhoiba.supabase.co/functions/v1/fichaje-sms-recordatorios" \
  -H "Authorization: Bearer TU_ANON_O_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d "{}"
```

O Dashboard → Edge Functions → Invoke.

Comprueba `fichajes_sms_envios` y que el móvil reciba el SMS (solo si ya pasó la hora límite y no hay fichaje).

## Comportamiento

- No envía en **vacaciones** ni **bajas** (tablas existentes).
- Máximo **1 SMS por tipo y día** (`entrada_olvidada` / `salida_olvidada`).
- Solo filas con `activo = true`.
- **Salida (2 pasos):** a `hora_salida + tolerancia` (ej. **17:15**) → solo SMS para que cierre la persona. A `+5 min` más (ej. **17:20**) → si sigue abierto, cierre automático con hora **17:20**. También cierra fichajes abiertos de **días anteriores**.
- SQL RPC ampliada: `database/alter_cerrar_fichaje_automaticamente_hora_salida.sql` (ejecutar y **redeploy** de la Edge Function).

## Ampliar a más gente

Insertar otra fila en `fichajes_sms_horarios` con su `empleado_id`, teléfono y horario. No hace falta tocar código.
