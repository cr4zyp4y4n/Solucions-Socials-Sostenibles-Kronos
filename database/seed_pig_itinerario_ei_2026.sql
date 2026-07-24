-- Seed itinerario E.I 2026 (valores Lizeth / PIG99%LISTO).
-- Idempotente: solo inserta si el año 2026 aún no tiene filas.

do $$
begin
  if exists (select 1 from public.pig_itinerario_ei where year = 2026 limit 1) then
    raise notice 'pig_itinerario_ei 2026 ya tiene datos; seed omitido.';
    return;
  end if;

  insert into public.pig_itinerario_ei
    (year, semestre, sort_order, linea, trabajador, fecha, jornada, num_orden, observaciones)
  values
    -- 1r semestre
    (2026, 1, 1, 'ESTRUCTURA', 'ANGIE LIZETH CIFUENTES BENAVIDES', '1/1/2026', '40H', '1', ''),
    (2026, 1, 2, 'IDONI', 'BELINDA ELIZABETH CUBAS CASTELLANOS', '1/1/2026', '40H', '2', ''),
    (2026, 1, 3, 'KOIKI', 'AHMAD FAHED ALHAMDO', '01-01-26 AL 18-03-26', '40H', '3', ''),
    (2026, 1, 4, 'KOIKI', 'AHMAD FAHED ALHAMDO', '19-03-26 AL 29-05-2026', '32.5H', '3', ''),
    (2026, 1, 5, 'KOIKI', 'MARYELIN ADRIANA PAEZ PEÑA', '14/5/2026', '20H', '4', ''),
    (2026, 1, 6, 'ESTRUCTURA', 'JUAN SEBASTIAN RUIZ BARRERA', '01/01/2026 AL 13/07/2026', '20H', '5', ''),
    (2026, 1, 7, 'CATERING', 'DAVID LOPEZ GOMIZ', '1/1/2026', '20H', '6', ''),
    (2026, 1, 8, 'IDONI', 'LOLA IZQUIERDO BENEDICO', '01/01/2026 AL 02/07/2026', '27H', '7', ''),
    (2026, 1, 9, 'IDONI', 'GIOVANA ELVIRA LAMAURE PARRA', '1/1/2026', '24H', '8', ''),
    (2026, 1, 10, 'CATERING', 'BENJAMIN MARTINEZ', '1/1/2026', 'FD', '9', ''),
    (2026, 1, 11, 'CATERING', 'ENCARNACIÓN PEREZ', '1/1/2026', 'FD', '10', ''),
    -- 2n semestre
    (2026, 2, 1, 'ESTRUCTURA', 'ANGIE LIZETH CIFUENTES BENAVIDES', '1/1/2026', '40H', '1',
      'SUBVENCIONABLE HASTA ? (BRUNO DEBE ENVIAR CORREO PARA CONFIRMAR)'),
    (2026, 2, 2, 'IDONI', 'BELINDA ELIZABETH CUBAS CASTELLANOS', '1/1/2026', '40H', '2',
      'SUBVENCIONABLE HASTA 28 DE OCTUBRE 2027'),
    (2026, 2, 3, 'KOIKI', 'MARYELIN ADRIANA PAEZ PEÑA', '14/5/2026', '20H', '3',
      'POR VALIDAR SI CONTINUA'),
    (2026, 2, 4, 'CATERING', 'DAVID LOPEZ GOMIZ', '1/1/2026', '20H', '4',
      'CONFIRMAR SI LO APRUEBAN EN INTINERARIO SUBV.'),
    (2026, 2, 5, 'IDONI', 'GIOVANA ELVIRA LAMAURE PARRA', '1/1/2026', '24H', '5',
      'CONFIRMAR SI SE AUMENTA JORNADA POR TEMA DE VISADO'),
    (2026, 2, 6, 'CATERING', 'BENJAMIN MARTINEZ', '1/1/2026', 'FD', '6',
      'CONTRATO FD, AUN VIENE A UNO QUE OTRO CATERING'),
    (2026, 2, 7, 'CATERING', 'ENCARNACIÓN PEREZ', '1/1/2026', 'FD', '7',
      'CONTRATO FD, VIENE A LOS CATERING QUE NO SE CRUCEN CON SU OTRO TRABAJO'),
    (2026, 2, 8, 'ESTRUCTURA', 'BRIAN BAUTISTA', '', '20H?', '8',
      'POR CONFIRMAR SI SE VA A REALIZAR CONTRATO E.I'),
    (2026, 2, 9, 'CATERING/ KOIKI', 'NEREA PAREDES', '', '', '',
      'SE PODRIA MIRAR DE QUE SOLICITE CERT. DE VULNERABILIDAD COMO HA REALIZADO BRIAN');
end $$;
