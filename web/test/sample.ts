// Realistic sample snapshot for tests, e2e and screenshots. Times are relative to `now` (epoch seconds).
import type { CategoryId, Snapshot, Source } from '../../contract/news.ts';

const SOURCES: Source[] = [
  { id: 'elpais', name: 'El País', kind: 'media', lastOk: 0 },
  { id: 'rtve', name: 'RTVE', kind: 'media', lastOk: 0 },
  { id: 'eldiario', name: 'elDiario.es', kind: 'media', lastOk: 0 },
  { id: 'aemet', name: 'AEMET', kind: 'official', lastOk: 0 },
  { id: 'dgt', name: 'DGT', kind: 'official', lastOk: 0 },
  { id: '112madrid', name: '112 Comunidad de Madrid', kind: 'social', lastOk: 0, region: 'md' },
];

const ITEMS: [sourceId: string, category: CategoryId, minutesAgo: number, title: string, summary: string][] = [
  ['112madrid', 'emergency', 3, 'Apagón general: Protección Civil pide no colapsar las líneas del 112', 'Llama solo en caso de emergencia real. Usa mensajes de texto para contactar con familiares.'],
  ['elpais', 'utilities', 8, 'Red Eléctrica recupera el suministro en el 40 % de la península', 'La reposición avanza por zonas; Cataluña y País Vasco, las primeras en recuperar la luz.'],
  ['aemet', 'weather', 15, 'Aviso naranja por tormentas en Valencia y Castellón', 'Se esperan acumulados de 60 l/m² en una hora a partir de las 16:00.'],
  ['dgt', 'transport', 22, 'Semáforos apagados en Madrid: la DGT pide circular con precaución', 'Agentes de movilidad regulan los cruces principales. Evita desplazamientos no imprescindibles.'],
  ['rtve', 'transport', 31, 'Renfe suspende los Cercanías en Madrid y Barcelona', 'Los trenes detenidos entre estaciones están siendo evacuados.'],
  ['eldiario', 'health', 44, 'Los hospitales funcionan con generadores y suspenden cirugías no urgentes', ''],
  ['elpais', 'politics', 58, 'El Gobierno convoca un gabinete de crisis tras el apagón', 'Sánchez comparecerá a las 18:00 en La Moncloa.'],
  ['rtve', 'economy', 75, 'La Bolsa cierra con caídas moderadas pese a la incidencia eléctrica', ''],
  ['eldiario', 'crime', 96, 'Detenidas tres personas por saqueos en comercios durante el apagón', 'La Policía Nacional refuerza la presencia en las zonas comerciales.'],
  ['rtve', 'world', 120, 'Portugal también sufre el corte de suministro eléctrico', 'El apagón afecta a la mayor parte del país vecino.'],
  ['elpais', 'technology', 150, 'Las operadoras piden reducir el uso de datos para no saturar la red', 'Las antenas funcionan con baterías de respaldo con autonomía limitada.'],
  ['eldiario', 'sports', 200, 'Aplazado el partido de esta noche en el Bernabéu', ''],
  ['rtve', 'culture', 260, 'Museos y cines cierran sus puertas hasta nuevo aviso', ''],
  ['elpais', 'general', 320, 'Consejos para conservar los alimentos de la nevera sin electricidad', 'Mantén la puerta cerrada: un frigorífico lleno aguanta unas 4 horas.'],
];

export function sampleSnapshot(now: number): Snapshot {
  return {
    generatedAt: now - 120,
    sources: SOURCES.map((s) => ({ ...s, lastOk: now - 120 })),
    items: ITEMS.map(([sourceId, category, min, title, summary], i) => ({
      sourceId,
      category,
      publishedAt: now - min * 60,
      title,
      summary,
      url: `https://noticias.example/${sourceId}/${i}`,
      // A national body's warning for one community (as AEMET's are).
      ...(title.includes('Valencia') ? { region: 'vc' as const } : {}),
    })),
  };
}
