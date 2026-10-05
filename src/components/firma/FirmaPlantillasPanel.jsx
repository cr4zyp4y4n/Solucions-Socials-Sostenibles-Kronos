import React, { useMemo, useState } from 'react';
import { Eye, MapPin, Trash2, Type, Upload } from 'feather-icons-react';
import { useTheme } from '../ThemeContext';
import { FIRMA_DOCUMENTO_GRUPOS, getFirmaDocumentoLabel } from '../../constants/firmaDocumentos';
import { getFirmaEmpresaNombre } from '../../constants/firmaEmpresas';
import { normalizeCamposPosicion } from '../../utils/firmaPlantillaFill';
import { FirmaButton, FirmaCard, FirmaFieldLabel, FirmaSelect } from './FirmaUi';

export default function FirmaPlantillasPanel({
  plantillas,
  loading,
  selectedEntity,
  onEntityChange,
  onUpload,
  onDelete,
  onVer,
  onEditSello,
  onEditCampos,
  uploadingTipo
}) {
  const { colors } = useTheme();
  const [tipoNuevo, setTipoNuevo] = useState('riesgos_psicosociales');
  const [fileNuevo, setFileNuevo] = useState(null);

  const filtradas = useMemo(
    () => (plantillas || []).filter((p) => p.entity_key === selectedEntity),
    [plantillas, selectedEntity]
  );

  return (
    <div style={{ display: 'grid', gap: 18, maxWidth: 720 }}>
      <FirmaCard>
        <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>Plantillas PDF</div>
        <p style={{ margin: '0 0 12px', fontSize: 13, color: colors.textSecondary, lineHeight: 1.45 }}>
          Una plantilla por tipo de documento y empresa. En <b>Nuevo pack</b>, si no subes PDF,
          Kronos usa esta plantilla; si no hay, genera desde Holded (cuando aplica).
          Con el icono de texto eliges qué campos rellenar (Nombre, Mail, Teléfono, Fecha nacimiento…);
          si no colocas ninguno, la plantilla se usa tal cual. Con el pin colocas el sello de aceptación.
        </p>
        <FirmaSelect
          value={selectedEntity}
          onChange={(e) => onEntityChange(e.target.value)}
          style={{ width: 'auto', minWidth: 160, fontWeight: 700 }}
        >
          <option value="EI_SSS">EI_SSS — {getFirmaEmpresaNombre('EI_SSS')}</option>
          <option value="MENJAR_DHORT">MENJAR_DHORT — {getFirmaEmpresaNombre('MENJAR_DHORT')}</option>
        </FirmaSelect>
      </FirmaCard>

      <FirmaCard>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>Subir / reemplazar</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
          <div>
            <FirmaFieldLabel>Tipo</FirmaFieldLabel>
            <FirmaSelect value={tipoNuevo} onChange={(e) => setTipoNuevo(e.target.value)}>
              {FIRMA_DOCUMENTO_GRUPOS.map((grupo) => (
                <optgroup key={grupo.key} label={grupo.label}>
                  {grupo.tipos.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </FirmaSelect>
          </div>
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 12px',
              borderRadius: 8,
              border: `1px solid ${colors.border}`,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 700
            }}
          >
            <Upload size={14} />
            {fileNuevo ? fileNuevo.name : 'Elegir PDF'}
            <input
              type="file"
              accept="application/pdf"
              style={{ display: 'none' }}
              onChange={(e) => setFileNuevo(e.target.files?.[0] || null)}
            />
          </label>
          <FirmaButton
            disabled={!fileNuevo || uploadingTipo}
            onClick={async () => {
              await onUpload({ tipoDocumento: tipoNuevo, file: fileNuevo });
              setFileNuevo(null);
            }}
          >
            {uploadingTipo === tipoNuevo ? 'Guardando…' : 'Guardar plantilla'}
          </FirmaButton>
        </div>
      </FirmaCard>

      <FirmaCard>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>
          Guardadas ({filtradas.length})
        </div>
        {loading ? (
          <div style={{ color: colors.textSecondary, fontSize: 13 }}>Cargando…</div>
        ) : filtradas.length === 0 ? (
          <div style={{ color: colors.textSecondary, fontSize: 13 }}>
            Ninguna plantilla para esta empresa. Sube una arriba o marca «Guardar como plantilla»
            al crear un pack con PDF propio.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {filtradas.map((p) => {
              const nCampos = Object.keys(normalizeCamposPosicion(p.campos_posicion)).length;
              return (
                <div
                  key={p.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: `1px solid ${colors.border}`,
                    background: colors.surface
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 13 }}>
                      {getFirmaDocumentoLabel(p.tipo_documento)}
                      {p.sello_posicion ? (
                        <span
                          style={{
                            marginLeft: 8,
                            fontSize: 11,
                            fontWeight: 700,
                            color: colors.success || '#2e7d32'
                          }}
                        >
                          · sello OK
                          {Array.isArray(p.sello_posicion) && p.sello_posicion.length > 1
                            ? ` (${p.sello_posicion.length} pág.)`
                            : ''}
                        </span>
                      ) : null}
                      {nCampos > 0 ? (
                        <span
                          style={{
                            marginLeft: 8,
                            fontSize: 11,
                            fontWeight: 700,
                            color: '#1565c0'
                          }}
                        >
                          · campos OK ({nCampos})
                        </span>
                      ) : null}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: colors.textSecondary,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {p.file_name}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <FirmaButton size="sm" variant="ghost" onClick={() => onVer(p)} title="Ver PDF">
                      <Eye size={14} />
                    </FirmaButton>
                    {onEditCampos ? (
                      <FirmaButton
                        size="sm"
                        variant="ghost"
                        onClick={() => onEditCampos(p)}
                        title="Posicionar Nombre / Apellidos / DNI"
                      >
                        <Type size={14} />
                      </FirmaButton>
                    ) : null}
                    {onEditSello ? (
                      <FirmaButton
                        size="sm"
                        variant="ghost"
                        onClick={() => onEditSello(p)}
                        title="Posicionar sello de aceptación"
                      >
                        <MapPin size={14} />
                      </FirmaButton>
                    ) : null}
                    <FirmaButton
                      size="sm"
                      variant="ghost"
                      onClick={() => onDelete(p)}
                      title="Eliminar plantilla"
                    >
                      <Trash2 size={14} />
                    </FirmaButton>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </FirmaCard>
    </div>
  );
}
