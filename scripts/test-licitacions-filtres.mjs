import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cpvPrefix,
  classifyCpv,
  matchKeyword,
  evaluateLicitacio
} from '../supabase/functions/_shared/licitacions/filtres.mjs';
import { LICITACIONS_CONFIG_FALLBACK } from '../src/services/licitacionsConfig.js';

const cfg = LICITACIONS_CONFIG_FALLBACK;

test('cpvPrefix', () => {
  assert.equal(cpvPrefix('55520000-1'), '5552');
  assert.equal(cpvPrefix('72000000'), '72');
});

test('classifyCpv: catering / tech / exclusio', () => {
  assert.equal(classifyCpv(['55523100'], cfg).area, 'Catering');
  assert.equal(classifyCpv(['72413000'], cfg).area, 'Tech');
  assert.equal(classifyCpv(['48000000'], cfg).area, 'Tech');
  assert.equal(classifyCpv(['55410000'], cfg).area, null);
  assert.equal(classifyCpv(['55510000'], cfg).area, null);
  assert.equal(classifyCpv(['55330000'], cfg).area, null);
  assert.equal(classifyCpv(['90511000'], cfg).area, null);
});

test('matchKeyword: bar no casa amb Barcelona', () => {
  assert.equal(
    matchKeyword('Servicio de catering para Barcelona Activa', cfg.keywords_exclusio.Catering),
    false
  );
  assert.equal(
    matchKeyword('Explotación del bar del polideportivo', cfg.keywords_exclusio.Catering),
    true
  );
});

test('evaluateLicitacio: keyword / import / reservada', () => {
  const bar = evaluateLicitacio({
    cpvCodes: ['55300000'],
    title: 'Explotación del bar del polideportivo',
    summary: '',
    importEstimat: 10000
  }, cfg);
  assert.equal(bar.keep, false);
  assert.equal(bar.motiu, 'keyword');

  const bcn = evaluateLicitacio({
    cpvCodes: ['55523100'],
    title: 'Servicio de catering para Barcelona Activa',
    summary: '',
    importEstimat: 10000
  }, cfg);
  assert.equal(bcn.keep, true);
  assert.equal(bcn.area, 'Catering');

  const caro = evaluateLicitacio({
    cpvCodes: ['72000000'],
    title: 'Serveis TI',
    summary: '',
    importEstimat: 80000
  }, cfg);
  assert.equal(caro.keep, false);
  assert.equal(caro.motiu, 'import');

  const senseImport = evaluateLicitacio({
    cpvCodes: ['72000000'],
    title: 'Serveis TI',
    summary: '',
    importEstimat: null
  }, cfg);
  assert.equal(senseImport.keep, true);

  const reservada = evaluateLicitacio({
    cpvCodes: ['72000000'],
    title: 'Contrato reservado a empresas de inserción',
    summary: '',
    importEstimat: 90000
  }, cfg);
  assert.equal(reservada.keep, true);
  assert.equal(reservada.reservada, true);
});
