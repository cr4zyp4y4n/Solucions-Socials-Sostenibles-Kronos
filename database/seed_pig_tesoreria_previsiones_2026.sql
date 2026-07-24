-- Seed previsiones TESORERÍA 2026 (valores Lizeth / PIG99%LISTO + ACOL para cuadrar total).

do $$
begin
  if exists (select 1 from public.pig_tesoreria_previsiones where year = 2026 limit 1) then
    raise notice 'pig_tesoreria_previsiones 2026 ya tiene datos; seed omitido.';
    return;
  end if;

  insert into public.pig_tesoreria_previsiones
    (year, bloque, sort_order, concepto, ingreso_previsto, observacion)
  values
    -- Ingresos por subv
    (2026, 'ingresos_por_subv', 1, 'E.I L2 01/09/25 - 31/12/25', 15613.27,
      'IMPULSEM 10.000 A IDONI 10 MESES, SE IMPUTA DE 01/01 AL 01/10 DE 2026'),
    (2026, 'ingresos_por_subv', 2, 'ACOL 11/2023 - 12/2024', 25017.03, ''),
    (2026, 'ingresos_por_subv', 3, 'E.I L1 01/07/24 - 30/06/25', 4200.00,
      'OBSERVACION DE SUBVENCIONES QUE FALTA DINERO POR INGRESAR E IMPUTAR'),
    (2026, 'ingresos_por_subv', 4, 'E.I L2 01/09/23 - 30/09/24', 1706.29,
      'A espera de que acepten a David puede ser 1.300 aproximadamente adicional'),
    (2026, 'ingresos_por_subv', 5, 'INVES (INVERSIÓN) 10/12/25 - 09/12/2026', 19750.00,
      'A LA ESPERA DE INGRESO YA SE ENVIO REQUERIMIENTO'),
    (2026, 'ingresos_por_subv', 6, 'E.I L1 01/07/25 - 31/12/25', 3360.51,
      'SOLICITARON REQUERIMIENTO (SE ENCUENTRA EN REVISIÓN)'),
    -- Por aprobar
    (2026, 'por_aprobar', 1, 'E.I L1 ESTRUCTURALES 01/01/26 - 31/12/26', 33610.44,
      'RESOLUCIÓN PROVISIONAL POR ESTE IMPORTE, FALTA RESOLUCIÓN FINAL'),
    (2026, 'por_aprobar', 2, 'ENFORTIM APROVADO ESPERA RESOLUCION FINAL 14/12/26 - 13/12/27', 6300.00, ''),
    (2026, 'por_aprobar', 3, 'CAMBIO CLIMATICO 14/12/2026 AL 31/03/2028', 80000.00,
      'RESOLUCIÓN PROVISIONAL POR ESTE IMPORTE, SE DEBE ENVIAR REFORMULACIÓN'),
    (2026, 'por_aprobar', 4, 'IMPULSEM 2.026 - 2.027', null,
      'POSTULACIÓN (NO TENEMOS AUN RESOLUCIÓN PROVISIONAL)'),
    (2026, 'por_aprobar', 5, 'E.I L2 ESTRUCTURAL 01/01/26 al 31/08/2026', 52793.44,
      'BRUNO DEBE POSTULARSE'),
    (2026, 'por_aprobar', 6, 'SINGULAR 26/27', null, '');
end $$;
