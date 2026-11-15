import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classify } from '../src/domain/classifier.ts';

const cases: [string, string, string][] = [
  ['Gran apagón en toda España', '', 'emergency'],
  ['El Gobierno aprueba ayudas para los afectados por la DANA', '', 'emergency'],
  ['Red Eléctrica restablece el suministro en Madrid', '', 'utilities'],
  ['La AEMET activa el aviso naranja por lluvias', '', 'weather'],
  ['Retenciones en la A-6 según la DGT', '', 'transport'],
  ['El Congreso vota la ley de vivienda', '', 'politics'],
  ['El Ibex cierra en máximos por la bajada del euríbor', '', 'economy'],
  ['Alcaraz gana en París', '', 'sports'],
  ['Trump se reúne con Putin', '', 'world'],
  ['Una tarde cualquiera', 'Sin palabras clave', 'general'],
  ['Comunicado oficial', 'La Guardia Civil investiga un robo', 'crime'],
];

for (const [title, summary, expected] of cases) {
  test(`classifies "${title}" as ${expected}`, () => assert.equal(classify(title, summary), expected));
}

test('"temporal" in a labour context is not weather', () => {
  assert.notEqual(classify('Baja la temporalidad del empleo'), 'weather');
});
