import React from 'react';
import { Plus, RefreshCw, Upload, Users, X, XCircle } from 'feather-icons-react';
import { useTheme } from '../ThemeContext';
import holdedEmployeesService from '../../services/holdedEmployeesService';
import {
  FIRMA_DOCUMENTO_GRUPOS,
  getFirmaDocPrepHint
} from '../../constants/firmaDocumentos';
import { getFirmaEmpresaNombre } from '../../constants/firmaEmpresas';
import { FirmaButton, FirmaCard, FirmaFieldLabel, FirmaInput, FirmaSelect, FirmaTextarea } from './FirmaUi';

export default function FirmaNewPackForm({
  selectedEntity,
  onEntityChange,
  holdedEmployees,
  holdedLoading,
  holdedError,
  holdedSearch,
  onHoldedSearchChange,
  onReloadHolded,
  selectedHoldedId,
  onSelectHoldedId,
  selectedHoldedEmployee,
  envioForm,
  onEnvioFormChange,
  packItems,
  onPackItemsChange,
  onSave,
  saving
}) {
  const { colors } = useTheme();

  return (
    <div style={{ display: 'grid', gap: 18, maxWidth: 720 }}>
      <FirmaCard>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <Users size={20} color={colors.primary} />
          <div>
            <div style={{ fontSize: 17, fontWeight: 800 }}>Empleado</div>
            <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
              Datos desde Holded para el pack y el SMS de verificación
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <FirmaSelect
              value={selectedEntity}
              onChange={(e) => onEntityChange(e.target.value)}
              style={{ width: 'auto', minWidth: 140, fontWeight: 700 }}
            >
              <option value="EI_SSS">EI_SSS</option>
              <option value="MENJAR_DHORT">MENJAR_DHORT</option>
            </FirmaSelect>
            <FirmaButton onClick={onReloadHolded} disabled={holdedLoading}>
              <RefreshCw size={15} />
              {holdedLoading ? 'Cargando…' : 'Recargar Holded'}
            </FirmaButton>
          </div>

          <div>
            <FirmaFieldLabel>Buscar empleado</FirmaFieldLabel>
            <FirmaInput
              value={holdedSearch}
              onChange={(e) => onHoldedSearchChange(e.target.value)}
              placeholder="Nombre, DNI, email o teléfono…"
            />
          </div>

          <div>
            <FirmaFieldLabel>Seleccionar</FirmaFieldLabel>
            <FirmaSelect
              value={selectedHoldedId}
              onChange={(e) => onSelectHoldedId(e.target.value)}
            >
              <option value="">{holdedLoading ? 'Cargando…' : 'Elige un empleado'}</option>
              {holdedEmployeesService.searchEmployees(holdedEmployees, holdedSearch)
                .slice(0, 200)
                .map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.nombreCompleto}
                    {emp.dni ? ` · ${emp.dni}` : ''}
                    {emp.telefono ? ` · ${emp.telefono}` : ''}
                  </option>
                ))}
            </FirmaSelect>
            {holdedError ? (
              <div style={{ marginTop: 8, fontSize: 12, color: colors.error, fontWeight: 700 }}>
                {holdedError}
              </div>
            ) : null}
          </div>

          {selectedHoldedEmployee ? (
            <EmployeePreview colors={colors} employee={selectedHoldedEmployee} entity={selectedEntity} />
          ) : null}
        </div>
      </FirmaCard>

      <FirmaCard>
        <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>Documentos del pack</div>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: colors.textSecondary, lineHeight: 1.45 }}>
          Por defecto se generan desde Holded. Solo sube PDF propio si necesitas sustituir uno (p. ej. contrato de asesoría).
        </p>

        <div style={{ display: 'grid', gap: 10, marginBottom: 14 }}>
          <div>
            <FirmaFieldLabel>Nombre del pack</FirmaFieldLabel>
            <FirmaInput
              value={envioForm.nombre}
              onChange={(e) => onEnvioFormChange({ nombre: e.target.value })}
              placeholder="Pack de contratación"
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
            <div>
              <FirmaFieldLabel>Fecha inicio</FirmaFieldLabel>
              <FirmaInput
                type="date"
                value={envioForm.fechaInicio}
                onChange={(e) => onEnvioFormChange({ fechaInicio: e.target.value })}
              />
            </div>
            <div>
              <FirmaFieldLabel>Fecha fin</FirmaFieldLabel>
              <FirmaInput
                type="date"
                value={envioForm.fechaFin}
                onChange={(e) => onEnvioFormChange({ fechaFin: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <FirmaFieldLabel>Lista de documentos</FirmaFieldLabel>
          <FirmaButton
            size="sm"
            onClick={() => onPackItemsChange([...packItems, {
              key: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
              tipoDocumento: 'otro',
              file: null,
              episRows: [{ equipo: '', marca: '', modelo: '' }]
            }])}
          >
            <Plus size={14} />
            Añadir
          </FirmaButton>
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          {packItems.map((item, idx) => (
            <div
              key={item.key}
              style={{
                padding: 14,
                borderRadius: 12,
                border: `1px solid ${colors.border}`,
                background: colors.background
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) auto',
                  gap: 10,
                  alignItems: 'start'
                }}
              >
                <div style={{ display: 'grid', gap: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: colors.textSecondary }}>
                    DOC {idx + 1}
                  </div>
                  <FirmaSelect
                    value={item.tipoDocumento}
                    onChange={(e) => onPackItemsChange(
                      packItems.map((it) => (it.key === item.key ? { ...it, tipoDocumento: e.target.value } : it))
                    )}
                    style={{ fontSize: 13 }}
                  >
                    {FIRMA_DOCUMENTO_GRUPOS.map((grupo) => (
                      <optgroup key={grupo.key} label={grupo.label}>
                        {grupo.tipos.map((tipo) => (
                          <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </FirmaSelect>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <label
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: `1px solid ${colors.border}`,
                        background: colors.surface,
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 700
                      }}
                    >
                      <Upload size={14} />
                      {item.file ? 'PDF propio' : 'PDF opcional'}
                      <input
                        type="file"
                        accept="application/pdf"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          onPackItemsChange(
                            packItems.map((it) => (it.key === item.key ? { ...it, file } : it))
                          );
                        }}
                      />
                    </label>
                    {item.file ? (
                      <FirmaButton
                        size="sm"
                        variant="ghost"
                        onClick={() => onPackItemsChange(
                          packItems.map((it) => (it.key === item.key ? { ...it, file: null } : it))
                        )}
                      >
                        <X size={14} />
                      </FirmaButton>
                    ) : null}
                  </div>
                </div>
                <FirmaButton
                  size="sm"
                  variant="ghost"
                  disabled={packItems.length <= 1}
                  onClick={() => onPackItemsChange(packItems.filter((it) => it.key !== item.key))}
                >
                  <XCircle size={16} />
                </FirmaButton>
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: colors.textSecondary, lineHeight: 1.4 }}>
                {item.file ? (
                  <span style={{ color: colors.primary }}>
                    PDF propio ({(item.file.size / 1024).toFixed(0)} KB)
                  </span>
                ) : (
                  <span style={{ color: colors.success }}>Se generará desde Holded</span>
                )}
                {getFirmaDocPrepHint(item.tipoDocumento) ? (
                  <div style={{ marginTop: 4 }}>{getFirmaDocPrepHint(item.tipoDocumento)}</div>
                ) : null}
              </div>
              {item.tipoDocumento === 'epis' && !item.file ? (
                <EpisEditor
                  item={item}
                  packItems={packItems}
                  onPackItemsChange={onPackItemsChange}
                  colors={colors}
                />
              ) : null}
            </div>
          ))}
        </div>

        <div style={{ marginTop: 14 }}>
          <FirmaFieldLabel>Notas internas</FirmaFieldLabel>
          <FirmaTextarea
            rows={2}
            value={envioForm.notasInternas}
            onChange={(e) => onEnvioFormChange({ notasInternas: e.target.value })}
          />
        </div>

        <FirmaButton
          variant="primary"
          disabled={saving || !selectedHoldedEmployee}
          onClick={onSave}
          style={{ width: '100%', marginTop: 18, padding: '12px 16px' }}
        >
          <Plus size={16} />
          {saving ? 'Generando PDFs y enlace…' : 'Generar pack y enlace'}
        </FirmaButton>
      </FirmaCard>
    </div>
  );
}

function EmployeePreview({ colors, employee, entity }) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 12,
        border: `1px solid ${colors.primary}33`,
        background: `${colors.primary}0a`,
        fontSize: 13,
        lineHeight: 1.55
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 8 }}>{employee.nombreCompleto}</div>
      <div><b>Empresa:</b> {getFirmaEmpresaNombre(entity)}</div>
      <div><b>DNI:</b> {employee.dni || '—'}</div>
      <div><b>Puesto:</b> {employee.contratoPuesto || employee.puesto || '—'}</div>
      <div><b>Teléfono OTP:</b> {employee.telefono || '—'}</div>
      <div><b>Email:</b> {employee.email || '—'}</div>
    </div>
  );
}

function EpisEditor({ item, packItems, onPackItemsChange, colors }) {
  return (
    <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
      <div style={{ fontSize: 11, fontWeight: 800 }}>Equipos EPI</div>
      {(item.episRows || []).map((row, rowIdx) => (
        <div
          key={`${item.key}-epi-${rowIdx}`}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr) auto',
            gap: 6
          }}
        >
          {['equipo', 'marca', 'modelo'].map((field) => (
            <input
              key={field}
              placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
              value={row[field]}
              onChange={(e) => onPackItemsChange(
                packItems.map((it) => {
                  if (it.key !== item.key) return it;
                  const episRows = [...(it.episRows || [])];
                  episRows[rowIdx] = { ...episRows[rowIdx], [field]: e.target.value };
                  return { ...it, episRows };
                })
              )}
              style={{
                padding: 8,
                borderRadius: 8,
                border: `1px solid ${colors.border}`,
                background: colors.surface,
                color: colors.text,
                fontSize: 11
              }}
            />
          ))}
          <button
            type="button"
            disabled={(item.episRows || []).length <= 1}
            onClick={() => onPackItemsChange(
              packItems.map((it) => {
                if (it.key !== item.key) return it;
                return { ...it, episRows: it.episRows.filter((_, i) => i !== rowIdx) };
              })
            )}
            style={{
              width: 32,
              borderRadius: 8,
              border: `1px solid ${colors.border}`,
              background: colors.surface,
              cursor: 'pointer'
            }}
          >
            <X size={12} />
          </button>
        </div>
      ))}
      <FirmaButton
        size="sm"
        onClick={() => onPackItemsChange(
          packItems.map((it) => {
            if (it.key !== item.key) return it;
            return {
              ...it,
              episRows: [...(it.episRows || []), { equipo: '', marca: '', modelo: '' }]
            };
          })
        )}
      >
        + EPI
      </FirmaButton>
    </div>
  );
}
