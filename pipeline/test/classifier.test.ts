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

test('a past disaster named with its date is not an emergency in progress', () => {
  assert.equal(classify('Repsol demanda a las eléctricas por el apagón de abril de 2025 y les pide 120 millones'), 'economy');
  assert.notEqual(classify('Rehabilitamos viviendas que quedaron bajo el agua tras la dana de 2024'), 'emergency');
  assert.equal(classify('Nuevo apagón en el norte de Madrid'), 'emergency');
});

test('the civil protection body name alone is not an emergency', () => {
  assert.equal(classify('Arranca la campaña de vialidad invernal de Protección Civil y Emergencias, con 1.469 quitanieves'), 'transport');
});

test('weighted terms break ties: a bomb hoax on a train is crime', () => {
  assert.equal(classify('Llega tarde para coger un tren y se inventa una amenaza de bomba'), 'crime');
});

test('the source fallback replaces "general", and one summary word alone is not enough', () => {
  assert.equal(classify('#DíaMundialContraElCáncerDeMama', '', 'health'), 'health');
  assert.equal(classify('¡Hola, Maldito!', '5 temas: una encuesta falsa'), 'general');
  assert.equal(classify('¡Hola, Maldito!', '5 temas: una encuesta falsa', 'politics'), 'politics');
  assert.equal(classify('Comunicado', 'La Guardia Civil detiene a dos personas por un robo'), 'crime');
});
