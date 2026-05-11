import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, AlertCircle, CheckCircle2, Link2, RefreshCw, Search, X } from 'lucide-react';
import { useTheme } from './ThemeContext';
import { useNavigation } from './NavigationContext';
import hojaRutaService from '../services/hojaRutaSupabaseService';
import holdedApi from '../services/holdedApi';

const ALIAS_KEY = 'kronos.equipmentAlias.v1.solucions.font-honrada-catering';
const TARGET_WAREHOUSE_NORM = 'font honrada catering';

function normalizeText(text) {
  const s = String(text || '').toLowerCase().trim();
  if (!s) return '';
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text) {
  return normalizeText(text).split(' ').filter(Boolean);
}

function similarityScore(a, b) {
  const aNorm = normalizeText(a);
  const bNorm = normalizeText(b);
  if (!aNorm || !bNorm) return 0;
  if (aNorm === bNorm) return 1;
  if (aNorm.length >= 5 && bNorm.includes(aNorm)) return 0.98;
  if (bNorm.length >= 5 && aNorm.includes(bNorm)) return 0.98;
  const aTokens = new Set(tokenize(aNorm));
  const bTokens = new Set(tokenize(bNorm));
  if (aTokens.size === 0 || bTokens.size === 0) return 0;
  let inter = 0;
  for (const t of aTokens) if (bTokens.has(t)) inter += 1;
  const union = aTokens.size + bTokens.size - inter;
  return union > 0 ? inter / union : 0;
}

function loadAliasMap() {
  try {
    const raw = localStorage.getItem(ALIAS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveAliasMap(map) {
  try {
    localStorage.setItem(ALIAS_KEY, JSON.stringify(map || {}));
  } catch {
    // noop
  }
}

function getProductId(p) {
  return String(p?.id || p?._id || '').trim();
}

export default function HojaRutaEquipamientoLinkPage() {
  const { colors } = useTheme();
  const { navigateTo } = useNavigation();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [hoja, setHoja] = useState(null);

  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [products, setProducts] = useState([]);
  const [warehouseStock, setWarehouseStock] = useState({});

  const [aliasMap, setAliasMap] = useState(() => loadAliasMap());
  const [picker, setPicker] = useState({ normKey: null, query: '' }); // { normKey, query }

  const [hojaId] = useState(() => {
    const storedHojaId = String(localStorage.getItem('selectedHojaRutaId') || '').trim();
    if (storedHojaId) {
      localStorage.removeItem('selectedHojaRutaId');
    }
    return storedHojaId;
  });

  const reload = async () => {
    if (!hojaId) {
      setError('No hay hoja seleccionada. Vuelve a Hoja de Ruta y abre la vinculación desde una hoja.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [h, ws, ps] = await Promise.all([
        hojaRutaService.getHojaRuta(hojaId),
        holdedApi.getWarehouses('solucions'),
        holdedApi.getAllProducts('solucions')
      ]);
      setHoja(h);
      setWarehouses(Array.isArray(ws) ? ws : []);
      setProducts(Array.isArray(ps) ? ps : []);
    } catch (e) {
      setError(e?.message || 'Error cargando datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!Array.isArray(warehouses) || warehouses.length === 0) return;
    const target = warehouses.find((w) => normalizeText(w?.name) === TARGET_WAREHOUSE_NORM);
    if (!target?.id) {
      setError('No se ha encontrado el almacén "Font Honrada (Càtering)" en Holded.');
      return;
    }
    setWarehouseId(String(target.id));
  }, [warehouses]);

  useEffect(() => {
    const run = async () => {
      if (!warehouseId) return;
      setLoading(true);
      setError('');
      try {
        const res = await holdedApi.getWarehouseStock(warehouseId, 'solucions');
        const list = res?.warehouse?.products;
        const map = {};
        if (Array.isArray(list)) {
          for (const row of list) {
            const pid = String(row?.product_id || '').trim();
            if (!pid) continue;
            map[pid] = typeof row?.stock === 'number' ? row.stock : Number(row?.stock || 0);
          }
        }
        setWarehouseStock(map);
      } catch (e) {
        setError(e?.message || 'Error cargando stock del almacén');
        setWarehouseStock({});
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [warehouseId]);

  const items = useMemo(() => {
    const list = Array.isArray(hoja?.equipamiento) ? hoja.equipamiento : [];
    const term = normalizeText(search);
    if (!term) return list;
    return list.filter((it) => normalizeText(it?.item).includes(term));
  }, [hoja, search]);

  const summary = useMemo(() => {
    const list = Array.isArray(hoja?.equipamiento) ? hoja.equipamiento : [];
    let confirmed = 0;
    for (const it of list) {
      const norm = normalizeText(it?.item);
      if (norm && aliasMap[norm]) confirmed += 1;
    }
    return { total: list.length, confirmed, pending: Math.max(0, list.length - confirmed) };
  }, [hoja, aliasMap]);

  const byProductId = useMemo(() => {
    const map = new Map();
    for (const p of products) {
      const pid = getProductId(p);
      if (pid) map.set(pid, p);
    }
    return map;
  }, [products]);

  const allowedProductIds = useMemo(() => new Set(Object.keys(warehouseStock || {})), [warehouseStock]);

  const allowedProducts = useMemo(() => {
    if (!Array.isArray(products) || products.length === 0) return [];
    if (!allowedProductIds || allowedProductIds.size === 0) return [];
    return products.filter((p) => {
      const pid = getProductId(p);
      return pid && allowedProductIds.has(pid);
    });
  }, [products, allowedProductIds]);

  const onPick = (rawName, pid) => {
    const normKey = normalizeText(rawName);
    if (!normKey) return;
    const next = { ...aliasMap, [normKey]: pid };
    saveAliasMap(next);
    setAliasMap(next);
    setPicker({ normKey: null, query: '' });
  };

  const onClear = (rawName) => {
    const normKey = normalizeText(rawName);
    if (!normKey) return;
    const next = { ...aliasMap };
    delete next[normKey];
    saveAliasMap(next);
    setAliasMap(next);
  };

  return (
    <div style={{ padding: 28, maxWidth: 1400, margin: '0 auto', color: colors.text }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              if (hojaId) {
                localStorage.setItem('selectedHojaRutaId', hojaId);
              }
              navigateTo('hoja-ruta');
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 12px',
              borderRadius: 10,
              border: `1px solid ${colors.border}`,
              background: colors.card,
              color: colors.text,
              cursor: 'pointer',
              fontWeight: 700
            }}
          >
            <ArrowLeft size={16} />
            Volver
          </motion.button>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Vinculación de Equipamiento</h1>
              <span style={{
                fontSize: 12,
                padding: '6px 10px',
                borderRadius: 999,
                border: `1px solid ${colors.border}`,
                background: colors.surface,
                color: colors.textSecondary,
                fontWeight: 700
              }}>
                Inventario: Solucions · Almacén: Font Honrada (Càtering)
              </span>
            </div>
            <div style={{ marginTop: 4, color: colors.textSecondary, fontSize: 13 }}>
              {hoja?.cliente ? <b style={{ color: colors.text }}>{hoja.cliente}</b> : 'Hoja'} · {summary.confirmed} OK · {summary.pending} pendientes
            </div>
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={reload}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 12px',
            borderRadius: 10,
            border: `1px solid ${colors.border}`,
            background: colors.card,
            color: colors.text,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
            fontWeight: 700
          }}
        >
          <RefreshCw size={16} />
          Recargar
        </motion.button>
      </div>

      {error ? (
        <div style={{
          padding: 14,
          borderRadius: 10,
          background: `${colors.error}15`,
          border: `1px solid ${colors.error}33`,
          color: colors.error,
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 10
        }}>
          <AlertCircle size={18} />
          {error}
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 12px',
          border: `1px solid ${colors.border}`,
          background: colors.card,
          borderRadius: 10,
          flex: '1 1 360px',
          minWidth: 280
        }}>
          <Search size={16} color={colors.textSecondary} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar en equipamiento…"
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: colors.text,
              fontSize: 14
            }}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 12 }}>
        {items.map((it, idx) => {
          const raw = String(it?.item || '').trim();
          const norm = normalizeText(raw);
          const linkedId = norm ? aliasMap[norm] : null;
          const product = linkedId ? byProductId.get(String(linkedId)) : null;
          const stock = linkedId ? warehouseStock?.[String(linkedId)] : null;
          const ok = !!product;

          const suggestions = (() => {
            if (!raw || allowedProducts.length === 0) return [];
            // REQUERIMIENTO: sugerir SOLO productos del almacén (160)
            return allowedProducts
              .map((p) => {
                const pid = getProductId(p);
                const name = String(p?.name || '').trim();
                return { pid, name, score: similarityScore(raw, name) };
              })
              .filter((s) => s.pid && s.name)
              .sort((a, b) => b.score - a.score)
              .slice(0, 8);
          })();

          return (
            <div key={it?.id || idx} style={{
              padding: 14,
              borderRadius: 12,
              border: `1px solid ${colors.border}`,
              background: colors.card,
              position: 'relative',
              overflow: 'visible'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: colors.text, wordBreak: 'break-word' }}>
                    {raw || '(sin nombre)'}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12, color: colors.textSecondary }}>
                    {it?.cantidad ? <>Cantidad: <b style={{ color: colors.text }}>{it.cantidad}</b></> : 'Cantidad: -'}
                    {it?.nota ? <> · Nota: <i>{it.nota}</i></> : null}
                  </div>
                </div>

                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 800,
                  padding: '6px 10px',
                  borderRadius: 999,
                  background: ok ? `${colors.primary}18` : `${colors.error}18`,
                  border: `1px solid ${(ok ? colors.primary : colors.error)}33`,
                  color: ok ? colors.primary : colors.error,
                  whiteSpace: 'nowrap'
                }}>
                  {ok ? <CheckCircle2 size={16} /> : <Link2 size={16} />}
                  {ok ? 'Enlazado' : 'Pendiente'}
                </span>
              </div>

              <div style={{ marginTop: 10 }}>
                {ok ? (
                  <div style={{ fontSize: 13, color: colors.textSecondary }}>
                    Producto: <b style={{ color: colors.text }}>{String(product?.name || '').trim()}</b>
                    {stock !== undefined && stock !== null ? <> · Stock: <b style={{ color: colors.text }}>{stock}</b></> : null}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: colors.textSecondary }}>
                    Selecciona el producto correcto del inventario.
                  </div>
                )}
              </div>

              <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setPicker((p) => ({ normKey: norm || null, query: p.normKey === norm ? p.query : '' }))}
                  style={{
                    flex: '1 1 320px',
                    minWidth: 260,
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: `1px solid ${colors.border}`,
                    background: colors.surface,
                    color: colors.text,
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 700,
                    textAlign: 'left'
                  }}
                >
                  {ok ? 'Cambiar producto…' : 'Seleccionar producto…'}
                </motion.button>

                {ok ? (
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => onClear(raw)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: `1px solid ${colors.border}`,
                      background: colors.surface,
                      color: colors.textSecondary,
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 700
                    }}
                  >
                    Quitar
                  </motion.button>
                ) : null}
              </div>

              {picker.normKey && picker.normKey === norm && (
                <div style={{
                  position: 'absolute',
                  left: 14,
                  right: 14,
                  top: 118,
                  zIndex: 50,
                  padding: 12,
                  borderRadius: 12,
                  border: `1px solid ${colors.border}`,
                  background: colors.surface,
                  boxShadow: `0 18px 55px rgba(0,0,0,0.35)`,
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    marginBottom: 10
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: `1px solid ${colors.border}`,
                      background: colors.card,
                      flex: 1
                    }}>
                      <Search size={16} color={colors.textSecondary} />
                      <input
                        value={picker.query}
                        onChange={(e) => setPicker((p) => ({ ...p, query: e.target.value }))}
                        placeholder="Buscar producto…"
                        style={{
                          width: '100%',
                          border: 'none',
                          outline: 'none',
                          background: 'transparent',
                          color: colors.text,
                          fontSize: 14
                        }}
                        autoFocus
                      />
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setPicker({ normKey: null, query: '' })}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: `1px solid ${colors.border}`,
                        background: colors.card,
                        color: colors.textSecondary,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title="Cerrar"
                    >
                      <X size={16} />
                    </motion.button>
                  </div>

                  <div style={{ maxHeight: 260, overflowY: 'auto', overflowX: 'hidden' }}>
                    {(() => {
                      const term = normalizeText(picker.query);
                      const base = allowedProducts;
                      const filtered = term
                        ? base.filter((p) => normalizeText(String(p?.name || '')).includes(term))
                        : base;
                      const ranked = filtered
                        .map((p) => {
                          const pid = getProductId(p);
                          const name = String(p?.name || '').trim();
                          return { pid, name, score: similarityScore(raw, name) };
                        })
                        .filter((r) => r.pid && r.name)
                        .sort((a, b) => b.score - a.score)
                        .slice(0, 14);

                      if (ranked.length === 0) {
                        return <div style={{ padding: 10, color: colors.textSecondary, fontSize: 13 }}>No hay resultados.</div>;
                      }

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {ranked.map((opt) => (
                            <motion.button
                              key={opt.pid}
                              whileHover={{}}
                              whileTap={{ scale: 0.99 }}
                              onClick={() => onPick(raw, opt.pid)}
                              style={{
                                textAlign: 'left',
                                padding: '10px 12px',
                                borderRadius: 12,
                                border: `1px solid ${colors.border}`,
                                background: colors.card,
                                color: colors.text,
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                                gap: 12,
                                alignItems: 'center',
                                width: '100%',
                                minWidth: 0,
                                overflow: 'hidden'
                              }}
                              title={opt.pid}
                            >
                              <span style={{ fontWeight: 800, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {opt.name}
                              </span>
                              <span style={{
                                fontSize: 12,
                                fontWeight: 900,
                                color: opt.score >= 0.92 ? colors.primary : colors.textSecondary,
                                whiteSpace: 'nowrap'
                              }}>
                                {opt.score >= 0.92 ? '✓' : ''}{opt.score.toFixed(2)}
                              </span>
                            </motion.button>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

