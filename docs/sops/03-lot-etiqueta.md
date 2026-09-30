# SOP-OBR-03 — Creació de lot i etiqueta QR

**Estat:** borrador · **Mòdul:** Kronos Lots  
**Objectiu:** Obrir lot de producció amb N recepcions, temp. cocció, mostra i generar etiqueta QR.

## Passos (resum)

1. **Lots** → Nou lot: producte, recepcions aptes, operari, kg, temp. ≥ mínim, mostra guardada.
2. Crear → RPC genera lot + etiqueta (`envasat`).
3. Imprimir etiqueta; comprovar URL traça (`OBRADOR_TRACE_BASE_URL`).

## Registres

`obrador_lots`, `obrador_lot_recepcions`, `obrador_etiquetes`.
