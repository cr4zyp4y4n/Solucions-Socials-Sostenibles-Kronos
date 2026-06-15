export function filterEmpleadosPanel(empleados, resumenPorEmpleado, { search = '', estadoFilter = 'todos' } = {}) {
  const q = String(search || '').trim().toLowerCase();
  return (empleados || []).filter((emp) => {
    const r = resumenPorEmpleado[emp.id] || {};
    if (estadoFilter === 'trabajando' && !r.trabajandoAhora) return false;
    if (estadoFilter === 'baja' && !r.estaDeBaja) return false;
    if (estadoFilter === 'vacaciones' && !r.estaEnVacaciones) return false;
    if (estadoFilter === 'activos' && (r.estaDeBaja || r.estaEnVacaciones)) return false;
    if (!q) return true;
    const nombre = String(emp.nombreCompleto || emp.name || '').toLowerCase();
    const email = String(emp.email || '').toLowerCase();
    return nombre.includes(q) || email.includes(q);
  });
}

export function sortEmpleadosPanel(empleados, resumenPorEmpleado) {
  return [...empleados].sort((a, b) => {
    const ra = resumenPorEmpleado[a.id] || {};
    const rb = resumenPorEmpleado[b.id] || {};
    if (ra.trabajandoAhora && !rb.trabajandoAhora) return -1;
    if (!ra.trabajandoAhora && rb.trabajandoAhora) return 1;
    if (ra.estaDeBaja && !rb.estaDeBaja) return -1;
    if (!ra.estaDeBaja && rb.estaDeBaja) return 1;
    const ha = parseFloat(ra.horasTotales || 0);
    const hb = parseFloat(rb.horasTotales || 0);
    return hb - ha;
  });
}

export function computePanelStats(empleados, resumenPorEmpleado) {
  let trabajando = 0;
  let deBaja = 0;
  let enVacaciones = 0;
  let horasMes = 0;
  (empleados || []).forEach((emp) => {
    const r = resumenPorEmpleado[emp.id] || {};
    if (r.trabajandoAhora) trabajando += 1;
    if (r.estaDeBaja) deBaja += 1;
    if (r.estaEnVacaciones) enVacaciones += 1;
    horasMes += parseFloat(r.horasTotales || 0);
  });
  return {
    total: empleados?.length || 0,
    trabajando,
    deBaja,
    enVacaciones,
    horasMes: horasMes.toFixed(1)
  };
}

export function empleadoEstadoFlow(resumen) {
  if (!resumen) return { key: 'neutral', label: 'Sin datos' };
  if (resumen.trabajandoAhora) return { key: 'trabajando', label: 'Trabajando' };
  if (resumen.estaDeBaja) return { key: 'baja', label: 'De baja' };
  if (resumen.estaEnVacaciones) return { key: 'vacaciones', label: 'Vacaciones' };
  if (resumen.diasTrabajados > 0) return { key: 'ok', label: 'Al día' };
  return { key: 'neutral', label: 'Sin fichajes' };
}

export function estadoPanelColor(key, colors) {
  switch (key) {
    case 'trabajando': return colors.warning;
    case 'baja': return colors.error;
    case 'vacaciones': return colors.info;
    case 'ok': return colors.success;
    default: return colors.textSecondary;
  }
}
