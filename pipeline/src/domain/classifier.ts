// Keyword classifier over normalised text (lowercase, no accents). Tuned against a corpus of real, hand-labelled
// headlines (pipeline/test/fixtures/classifier-corpus.tsv): keep it generic, no names of people or one-off events.
// "emergency" and "utilities" win outright when they appear in the headline: that is what this app is for.
import { CATEGORY_IDS, type CategoryId } from '../../../contract/news.ts';
import { normalize } from './text.ts';

/** Terms match at a word start ("evacua" covers "evacuados"); `\b` closes a whole word. Weight: "!term" 2, "~term" 0.5. */
type Terms = string[];

const TERMS: Partial<Record<CategoryId, Terms>> = {
  emergency: ['apagon', 'apagones', 'cero energetico', 'terremoto', 'seismo', 'sismo', 'tsunami', 'maremoto', 'incendio',
    'inundacion', 'inundaciones', 'riada', 'dana\\b', 'evacua', 'explosion', '112\\b', 'proteccion civil', 'alerta roja',
    'aviso rojo', 'estado de emergencia', 'situacion de emergencia', 'emergencia nacional', 'catastrofe', 'derrumbe',
    'atentado', 'ume\\b', 'confinamiento', 'confina', 'tromba', 'erupcion', 'volcan', 'desaparecidos', 'damnificad',
    'es alert', 'accidente ferroviario', 'descarril', 'luto oficial', 'albergue'],
  utilities: ['sin luz', 'corte de luz', 'cortes de luz', 'suministro electrico', 'red electrica', 'electricidad',
    'sistema electrico', 'alta tension', 'subestacion', 'interconexion electrica', 'energia electrica', 'tendido electrico',
    'sin cobertura', 'cobertura movil', 'telefonia', 'caida de internet', 'sin internet', 'corte de agua', 'agua potable',
    'fuga de agua', 'abastecimiento', 'gasolineras', 'combustible', 'carburante', 'restablec', 'operadoras', 'generadores',
    'iberdrola', 'endesa', 'naturgy'],
  weather: ['aemet', 'temporal\\b', 'lluvia', 'lluvios', 'tormenta', 'chubasco', 'nieve', 'nevada', 'ola de calor',
    'ola de frio', 'viento', 'rachas', 'granizo', 'oleaje', 'mal estado de la mar', 'aviso amarillo', 'aviso naranja',
    'alerta amarilla', 'alerta naranja', 'temperaturas', 'calima', 'borrasca', 'prevision meteorologica', 'prediccion',
    'meteorolog', 'precipitacion', 'heladas', 'sequia', 'otonal', 'muy calido', 'rio atmosferico'],
  transport: ['trafico', 'dgt\\b', 'carretera', 'renfe', 'tren\\b', 'trenes', 'ferroviari', 'maquinistas', 'servicios minimos',
    'metro\\b', 'aeropuerto', 'vuelo', 'aerolinea', 'aviones', 'aena', 'cercanias', 'rodalies', 'autopista', 'autovia',
    'ave\\b', 'adif', 'atasco', 'retenciones', '!siniestro vial', '!siniestros viales', '!siniestralidad vial',
    'calzada', 'circulacion', 'vialidad', 'quitanieves', 'conductor', 'tranvia', 'corte por obras', 'carril', 'movilidad',
    'airlines', 'velocidad', '!distancia de seguridad', '(?:ap|lr|cv|ma|bi|gi|m|n) \\d{2,3}\\b'],
  health: ['sanidad', 'sanitari', 'hospital', 'virus', 'hantavirus', 'pandemia', 'covid', 'gripe', 'vacuna', 'brote',
    'epidemia', 'urgencias', 'medico', 'salud', 'enfermedad', 'enfermeria', 'oms\\b', 'cancer', 'aborto', 'suicidio',
    'alzheimer', 'paciente', 'farmaco', 'medicamento', 'sangre', 'medula', 'cuidados', 'tabaco', 'alimentacion',
    'comer mejor', 'longevidad'],
  crime: ['detenido', 'detenida', 'detenidos', 'detenidas', 'detenc', 'policia', 'guardia civil', 'mossos', 'ertzaintza',
    'asesin', 'homicidio', 'matar\\b', 'mata\\b', 'apunal', 'fallecid', 'muere', 'mueren', 'muerto', 'accidente', 'juez',
    'jueza', 'juzgado', 'tribunal', 'juicio', 'condena', 'carcel', 'prision', 'fiscalia', 'audiencia', 'banquillo',
    'acusad', 'agresion', 'robo\\b', 'robos', 'asalt', 'investigad', 'delito', 'delincuen', 'estafa', 'desarticula',
    'yihadista', 'seprona', 'expolio', 'abuso sexual', 'pederast', 'violacion', 'fugitiv', '!bomba', 'falsa alarma',
    'trato degradante'],
  world: ['eeuu', 'estados unidos', 'trump', 'ucrania', 'kiev', 'rusia', 'prorrus', 'putin', 'israel', 'netanyahu', 'gaza',
    'iran\\b', 'irani', 'china\\b', 'bruselas', 'comision europea', 'onu\\b', 'otan\\b', 'oit\\b', 'francia', 'alemania',
    'italia', 'portugal', 'reino unido', 'marruecos', 'venezuela', 'argentina', 'mexico', 'brasil', 'paraguay', 'bulgaria',
    'australia', 'ruanda', 'mar negro', 'internacional', 'paises europeos', 'deportacion', 'guerra'],
  politics: ['~gobierno', 'congreso', 'senado', 'ministro', 'ministra', 'elecciones', 'electoral', 'pp\\b', 'psoe', 'vox\\b',
    'sumar\\b', 'podemos', 'junts', 'compromis', 'upn\\b', 'frente amplio', 'parlament', 'moncloa', 'sanchez', 'feijoo',
    'abascal', 'ayuso', 'yolanda diaz', 'diputad', 'ley\\b', 'consejo de ministros', 'candidat', 'campana', '29n\\b',
    '29 n\\b', 'vot(?:a|as|ar|o|os|ante|antes|acion)\\b', 'encuesta', 'sondeo', 'mitin', 'escano', 'urnas', 'cara a cara', 'legislatura',
    'ultraderech', 'desinformacion', 'alcald', 'exalcald', 'concejal', 'consejera', 'consejero'],
  economy: ['economia', 'bolsa\\b', 'ibex', 'inflacion', 'ipc\\b', 'paro\\b', 'empleo', 'pib\\b', 'banco', 'euribor',
    'hipoteca', 'precio', 'empresa', '!salario', '!smi\\b', 'pensiones', 'hacienda', 'impuesto', 'aranceles', '!blanqueo',
    'inestabilidad economica', 'inversor', 'investors', 'pesquero', 'flota', 'demanda a'],
  technology: ['tecnologia', 'inteligencia artificial', 'ia\\b', 'apple', 'google', 'microsoft', '!nvidia', 'chips',
    '!ciberataque', 'ciberdelin', 'ciberdelito', 'hackeo', 'ciberseguridad', 'movil', 'redes sociales', 'internet', 'tiktok',
    'software', 'algoritmo'],
  sports: ['futbol', 'laliga', 'liga\\b', 'real madrid', 'barca', 'atletico', 'champions', 'nations league', 'uefa', 'fifa',
    'tenis', 'atp\\b', 'alcaraz', 'nadal', 'baloncesto', 'nba\\b', 'formula 1', 'f1\\b', 'motogp', 'gol\\b', 'goles',
    'seleccion\\b', 'mundial', 'olimpic', 'ciclismo', 'entrena', 'molestias musculares', 'lesion', 'guardameta'],
  culture: ['cine\\b', 'pelicula', 'serie\\b', 'series\\b', 'musica', 'concierto', 'cantante', 'artista', 'actor', 'actriz',
    'grammy', 'oscar', 'nominaci', 'james bond', 'looks', 'libro', 'museo', 'teatro', 'festival', 'premio', 'poeta', 'novela',
    'educacion', 'universidad', '~vivienda', 'alquiler', 'acoso escolar', 'sin hogar', 'acampada', 'convivencia', 'inclusion'],
};

interface Rule {
  re: RegExp;
  weight: number;
}

function compile(terms: Terms): Rule[] {
  const byWeight = new Map<number, string[]>();
  for (const t of terms) {
    const weight = t.startsWith('!') ? 2 : t.startsWith('~') ? 0.5 : 1;
    byWeight.set(weight, [...(byWeight.get(weight) ?? []), t.replace(/^[!~]/, '')]);
  }
  return [...byWeight].map(([weight, list]) => ({ re: new RegExp(`\\b(?:${list.join('|')})`, 'g'), weight }));
}

const RULES = new Map(CATEGORY_IDS.flatMap((id) => (TERMS[id] ? [[id, compile(TERMS[id])] as const] : [])));

const score = (rules: Rule[], s: string) => rules.reduce((sum, r) => sum + (s.match(r.re)?.length ?? 0) * r.weight, 0);

// "el apagón de abril de 2025", "la dana de 2024": a past disaster (lawsuits, reconstruction), not one in progress.
const PAST_EVENT = /\b(?:apagon|dana|terremoto|incendio|inundacion|riada)\w* (?:de [a-z]+ )?de (?:19|20)\d\d\b/g;
// Names of bodies, not events: "Dirección General de Protección Civil y Emergencias" runs road-winter campaigns too.
const BODY_NAME = /\bproteccion civil y emergencias\b/g;
const prepare = (text: string) => normalize(text).replace(PAST_EVENT, ' ').replace(BODY_NAME, ' ');

/** Smallest score that decides: one hit in the title (3) or two in the summary. */
const SUMMARY_ONLY_MIN = 2;

/**
 * Category of a headline. `fallback` (the source's usual topic, e.g. a health ministry) replaces "general" when
 * no keyword matches.
 */
export function classify(title: string, summary = '', fallback: CategoryId = 'general'): CategoryId {
  const t = prepare(title);
  const s = prepare(summary);
  for (const id of ['emergency', 'utilities'] as const) if (score(RULES.get(id)!, t)) return id;
  let best: CategoryId = fallback;
  let top = 0;
  for (const [id, rules] of RULES) {
    const sc = score(rules, t) * 3 + score(rules, s);
    if (sc > top) [best, top] = [id, sc];
  }
  // A single word in the summary alone is too weak (digests, greetings): better the source's usual topic.
  return top >= SUMMARY_ONLY_MIN ? best : fallback;
}
