# SOP-OBR-05 — Expedició amb check de sortida

**Estat:** borrador · **Mòdul:** Kronos Expedicions / Portal  
**Objectiu:** Sortida de lot envasat amb verificació obligatòria i client.

## Passos (resum)

1. Identificar lot (càmera QR, enganxar codi o portal `?expedir=1`).
2. Client (autocompletat), comanda Holded opcional.
3. Marcar **producte verificat abans de sortir** (obligatori).
4. Registrar → lot `expedit`.

## Registres

`obrador_expedicions` (`check_sortida = true`), `obrador_clients` (upsert).
