// Keyword classifier over normalised text (lowercase, no accents).
// "emergency" and "utilities" win outright when they appear in the headline: that is what this app is for.
import { CATEGORY_IDS, type CategoryId } from '../../../contract/news.ts';
import { normalize } from './text.ts';

const words = (list: string[]) => new RegExp(`\\b(?:${list.join('|')})`, 'g');

const RULES: Partial<Record<CategoryId, RegExp>> = {
  emergency: words(['apagon', 'apagones', 'cero energetico', 'terremoto', 'seismo', 'sismo', 'tsunami', 'maremoto',
    'incendio', 'inundacion', 'inundaciones', 'riada', 'dana\\b', 'evacua', 'desalojo', 'desalojad', 'explosion', '112\\b',
    'proteccion civil', 'alerta roja', 'aviso rojo', 'emergencia', 'catastrofe', 'derrumbe', 'atentado', 'ume\\b',
    'confinamiento', 'tromba', 'erupcion', 'volcan', 'desaparecidos', 'damnificad', 'es alert']),
  utilities: words(['sin luz', 'corte de luz', 'cortes de luz', 'suministro electrico', 'red electrica', 'electricidad',
    'sin cobertura', 'cobertura movil', 'telefonia', 'caida de internet', 'sin internet', 'corte de agua', 'agua potable',
    'gasolineras', 'combustible', 'carburante', 'restablec', 'operadoras', 'generadores', 'iberdrola', 'endesa', 'naturgy']),
  weather: words(['aemet', 'temporal\\b', 'lluvia', 'tormenta', 'nieve', 'nevada', 'ola de calor', 'ola de frio',
    'viento', 'granizo', 'aviso amarillo', 'aviso naranja', 'alerta amarilla', 'alerta naranja', 'temperaturas', 'calima',
    'borrasca', 'prevision meteorologica', 'heladas', 'sequia']),
  transport: words(['trafico', 'dgt\\b', 'carretera', 'renfe', 'tren\\b', 'trenes', 'metro\\b', 'aeropuerto',
    'vuelo', 'aena', 'cercanias', 'autopista', 'autovia', 'ave\\b', 'adif', 'atasco', 'retenciones']),
  health: words(['sanidad', 'sanitari', 'hospital', 'virus', 'pandemia', 'covid', 'gripe', 'vacuna', 'brote', 'epidemia',
    'urgencias', 'medico', 'salud', 'enfermedad', 'oms\\b']),
  crime: words(['detenido', 'detenida', 'policia', 'guardia civil', 'mossos', 'ertzaintza', 'asesinato', 'homicidio',
    'fallecid', 'muere', 'mueren', 'muerto', 'accidente', 'juez', 'jueza', 'tribunal', 'juicio', 'condena',
    'agresion', 'robo\\b', 'investigad']),
  world: words(['eeuu', 'estados unidos', 'trump', 'ucrania', 'rusia', 'putin', 'israel', 'gaza', 'iran\\b', 'china\\b',
    'bruselas', 'comision europea', 'onu\\b', 'otan\\b', 'francia', 'alemania', 'reino unido', 'marruecos', 'venezuela',
    'argentina', 'mexico', 'internacional']),
  politics: words(['gobierno', 'congreso', 'senado', 'ministro', 'ministra', 'elecciones', 'electoral', 'pp\\b', 'psoe', 'vox\\b',
    'sumar\\b', 'podemos', 'junts', 'parlament', 'moncloa', 'sanchez', 'feijoo', 'diputad', 'ley\\b', 'consejo de ministros']),
  economy: words(['economia', 'bolsa\\b', 'ibex', 'inflacion', 'ipc\\b', 'paro\\b', 'empleo', 'pib\\b', 'banco', 'euribor',
    'hipoteca', 'precio', 'empresa', 'salario', 'pensiones', 'hacienda', 'impuesto', 'aranceles']),
  technology: words(['tecnologia', 'inteligencia artificial', 'ia\\b', 'apple', 'google', 'microsoft', 'ciberataque',
    'hackeo', 'ciberseguridad', 'movil', 'redes sociales', 'internet']),
  sports: words(['futbol', 'laliga', 'liga\\b', 'real madrid', 'barca', 'atletico', 'champions', 'tenis',
    'alcaraz', 'nadal', 'baloncesto', 'nba\\b', 'formula 1', 'f1\\b', 'motogp', 'gol\\b', 'goles', 'seleccion espanola',
    'mundial', 'olimpic', 'ciclismo']),
  culture: words(['cine\\b', 'pelicula', 'serie\\b', 'series\\b', 'musica', 'concierto', 'libro', 'museo', 'teatro', 'festival', 'premio',
    'educacion', 'universidad', 'vivienda', 'alquiler']),
};

const hits = (re: RegExp, s: string) => s.match(re)?.length ?? 0;

export function classify(title: string, summary = ''): CategoryId {
  const t = normalize(title);
  const s = normalize(summary);
  for (const id of ['emergency', 'utilities'] as const) if (hits(RULES[id]!, t)) return id;
  let best: CategoryId = 'general';
  let score = 0;
  for (const id of CATEGORY_IDS) {
    const re = RULES[id];
    if (!re) continue;
    const sc = hits(re, t) * 3 + hits(re, s);
    if (sc > score) [best, score] = [id, sc];
  }
  return best;
}
