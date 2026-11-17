// Content of guia.html ("Qué hacer en una emergencia"): static, cached by the service worker on the first visit,
// so it opens with no network at all. Written in Spanish for readers. Every piece of advice comes from the
// official sources listed at the end (ADR 0011); review them when updating this file.

export interface Phone {
  number: string;
  label: string;
  note?: string;
}

export interface GuideSection {
  /** Anchor in the page; stable, other pages may link to it. */
  id: string;
  title: string;
  intro?: string;
  steps: string[];
}

export interface GuideSource {
  name: string;
  url: string;
}

/** Date the content was last reviewed against the sources (YYYY-MM-DD). */
export const GUIDE_REVIEWED = '2026-11-17';

export const PHONES: Phone[] = [
  { number: '112', label: 'Emergencias', note: 'Gratis. Si tu compañía no tiene cobertura, la llamada puede entrar por la red de otra.' },
  { number: '091', label: 'Policía Nacional' },
  { number: '062', label: 'Guardia Civil' },
  { number: '092', label: 'Policía Local' },
  { number: '061', label: 'Urgencias sanitarias', note: 'En algunas comunidades; si dudas, llama al 112.' },
  { number: '016', label: 'Violencia de género', note: 'No deja rastro en la factura.' },
  { number: '024', label: 'Atención a la conducta suicida' },
];

export const SECTIONS: GuideSection[] = [
  {
    id: 'primero',
    title: 'Lo primero',
    steps: [
      'Llama al 112 solo si hay una emergencia real: las líneas se colapsan enseguida.',
      'Para avisar a tu familia, usa SMS o mensajes cortos en lugar de llamadas: gastan mucha menos red.',
      'Sigue las indicaciones de las autoridades. Si no dicen otra cosa, lo más seguro suele ser quedarse en casa o en el edificio donde estés.',
      'Los avisos oficiales llegan al móvil solos (ES-Alert), con un sonido fuerte, aunque no tengas datos ni ninguna app. Léelos entero y haz lo que indican.',
      'Infórmate por fuentes oficiales y por la radio. Desconfía de mensajes reenviados sin fuente: no los compartas.',
      'Pregunta por tus vecinos mayores, enfermos o que viven solos.',
    ],
  },
  {
    id: 'apagon',
    title: 'Apagón',
    steps: [
      'Comprueba si es solo tu casa (mira el cuadro eléctrico) o toda la zona (vecinos, farolas, semáforos).',
      'Desenchufa los aparatos delicados. Cuando vuelva la luz, conéctalos poco a poco.',
      'Usa linternas. Si usas velas, nunca sin vigilar ni cerca de cortinas o papeles.',
      'Abre la nevera y el congelador lo menos posible: así conservan el frío durante horas.',
      'No uses el ascensor. En la calle, si los semáforos están apagados, circula despacio y con precaución.',
      'Generadores, estufas de gas o barbacoas, nunca dentro de casa ni en un garaje cerrado: el monóxido de carbono mata sin avisar. Tampoco dejes el coche en marcha en un garaje.',
      'Una radio de pilas o la del coche te mantiene informado sin internet.',
      'Ahorra batería del móvil: modo ahorro, brillo bajo y sin vídeos. En esta app, el modo «Solo urgentes» gasta menos datos.',
      'Lleva algo de dinero en efectivo: sin luz, los datáfonos y los cajeros no funcionan.',
    ],
  },
  {
    id: 'inundacion',
    title: 'Lluvias fuertes e inundaciones',
    steps: [
      'Aléjate de ríos, barrancos y ramblas, y busca las zonas altas.',
      'Nunca cruces una calle o carretera inundada, ni a pie ni en coche: no sabes qué hay debajo y poca agua en movimiento basta para arrastrar un coche.',
      'No bajes a sótanos, garajes ni plantas bajas, tampoco a por el coche.',
      'Si el agua te rodea en casa, sube a los pisos altos. Si te lo indican o el agua entra, corta la luz y el gas.',
      'Si vas en coche y el agua sube, sal y busca un sitio alto.',
      'Evita desplazamientos durante el aviso y sigue los avisos de AEMET y del 112.',
    ],
  },
  {
    id: 'terremoto',
    title: 'Terremoto',
    intro: 'Durante el temblor: agáchate, cúbrete y agárrate.',
    steps: [
      'Dentro de un edificio: métete debajo de una mesa sólida o junto a un pilar o una pared maestra, protegiéndote la cabeza con los brazos. No salgas corriendo mientras tiembla.',
      'Aléjate de ventanas, cristaleras, estanterías y objetos que puedan caer. No uses el ascensor.',
      'En la calle: aléjate de edificios, muros, postes y cables eléctricos.',
      'En el coche: para en un lugar seguro, lejos de puentes y edificios, y quédate dentro.',
      'Después: espera réplicas. No entres en edificios dañados y usa linterna en lugar de velas o cerillas (puede haber fugas de gas).',
      'En la costa, si el temblor ha sido fuerte o largo, vete a una zona alta o alejada del mar sin esperar a otro aviso: puede llegar un tsunami.',
    ],
  },
  {
    id: 'calor',
    title: 'Ola de calor',
    steps: [
      'Bebe agua a menudo aunque no tengas sed. Evita el alcohol, las bebidas con cafeína y las muy azucaradas.',
      'Evita el sol y el esfuerzo físico en las horas centrales del día. Busca lugares frescos o con aire acondicionado.',
      'Ropa ligera, holgada y de colores claros. Comidas ligeras.',
      'Nunca dejes a nadie, tampoco a animales, dentro de un coche cerrado.',
      'Atención a bebés, personas mayores, embarazadas y personas con enfermedades crónicas.',
      'Golpe de calor (piel muy caliente y roja, confusión, desmayo, fiebre muy alta): llama al 112. Mientras llega la ayuda, lleva a la persona a un sitio fresco y enfríala con paños o agua fría. No le des de beber.',
    ],
  },
  {
    id: 'preparate',
    title: 'Prepárate antes: kit para 72 horas',
    intro: 'La Unión Europea recomienda que cada hogar pueda arreglárselas solo al menos 72 horas (3 días) si faltan la luz, el agua o las comunicaciones.',
    steps: [
      'Agua: al menos 1,5 litros por persona y día solo para beber; más si también la necesitas para cocinar o asearte.',
      'Comida que no necesite nevera ni cocinarse: conservas, frutos secos, galletas. Abrelatas manual.',
      'Linterna, pilas de repuesto y una radio de pilas o de dinamo.',
      'Batería externa cargada y cargador de coche para el móvil.',
      'Botiquín y las medicinas que tomes habitualmente, para varios días.',
      'Copia de los documentos importantes, algo de dinero en efectivo y las llaves de repuesto.',
      'Teléfonos de tu familia apuntados en papel y un punto de encuentro acordado por si no os podéis comunicar.',
    ],
  },
];

export const SOURCES: GuideSource[] = [
  { name: 'Protección Civil (Ministerio del Interior): guías de información al ciudadano', url: 'https://www.proteccioncivil.es/' },
  { name: 'Instituto Geográfico Nacional: qué hacer en caso de terremoto y tsunami', url: 'https://www.ign.es/web/resources/sismologia/qhacer/docs/qhacer2.pdf' },
  { name: 'Ministerio de Sanidad: recomendaciones frente al calor', url: 'https://www.sanidad.gob.es/areas/promocionPrevencion/lesiones/temperaturasExtremas/docs/TemperaturasExtremas_ProtegetedelCalor.pdf' },
  { name: 'Ministerio del Interior: guía de información al ciudadano ante el riesgo de inundaciones', url: 'https://www.interior.gob.es/opencms/pdf/archivos-y-documentacion/documentacion-y-publicaciones/publicaciones-descargables/proteccion-civil/Guia_de_informacion_riesgo_inundaciones_12623087X.pdf' },
  { name: 'Protecció Civil de Catalunya: kit de emergencias para 72 horas', url: 'https://interior.gencat.cat/ca/arees_dactuacio/proteccio_civil/consells_autoproteccio_emergencia/preparat_per_les_emergencies/equip_emergencies/index.html' },
  { name: 'Comisión Europea: Estrategia de la Unión de Preparación', url: 'https://commission.europa.eu/topics/preparedness_en' },
];
