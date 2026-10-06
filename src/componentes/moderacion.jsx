const API_USER = '1456486769';
const API_SECRET = 'MWZsLSybLfuit6bzsDYF6edBEUZXhhsm';

// Sacamos la lista afuera para que no se cree de nuevo en cada llamada
const PALABRAS_PROHIBIDAS = [
  'mierda', 'puta', 'puto', 'perra', 'maldito', 'maldita', 'guevon', 'marico', 'marica', 'coño', 'malparido', 'hdp', 'pendejo', 'estupido', 'idiota', 'imbecil', 'basura', 'zorra', 'bastardo', 'gonorrea', 'culiao', 'weon', 'cabron', 'chupalo', 'chingar', 'pajuo', 'mamaguevo', 'mamaguebo', 'mmgv', 'becerro', 'bruja', 'caretabla', 'trimaldito', 'prostituta', 'ramera', 'cachudo', 'cornudo',
  'matar', 'asesinar', 'muerte', 'sangre', 'pistola', 'rifle', 'balazo', 'bomba', 'terrorismo', 'terrorista', 'atentado', 'secuestro', 'violacion', 'golpear', 'navaja', 'cuchillo', 'suicidio', 'veneno', 'masacre', 'sicario', 'cartel', 'droga', 'cocaina', 'heroina', 'metanfetamina',
  'pene', 'vagina', 'sexo', 'porno', 'xxx', 'ereccion', 'orgasmo', 'cojer', 'anal', 'oral', 'clitoris', 'testiculo', 'vibrador', 'hentai', 'semen', 'esperma', 'fetiche', 'sadismo', 'masoquismo', 'pedofilo', 'incesto', 'zoofilia', 'pornografia', 'intercourse', 'ejaculacion',
  'nazi', 'racista', 'xenofobia', 'homofobia', 'fag', 'faggot', 'nigga', 'nigger', 'kike', 'retard', 'retrasado', 'mojadito', 'sudaca', 'machista', 'feminazi',
  'p.u.t.a', 'pussy','m.i.e.r.d.a', 'p-u-t-a', 'sh-it', 'f-u-c-k', 'p3n3', 'v4g1n4', 'm1erd4','negrito','negrita','singar'
];

const esVideo = (url, tipoArchivo) =>
  tipoArchivo === 'video' ||
  tipoArchivo?.startsWith('video/') ||
  /\.(mp4|webm|ogg|mov|m4v)(?:$|[?#])/i.test(url);

const obtenerMaximo = (frames, obtenerValor) => {
  const valores = frames
    .map(obtenerValor)
    .filter((valor) => typeof valor === 'number' && Number.isFinite(valor));
  return valores.length ? Math.max(...valores) : null;
};

const validarMedia = async (url, tipoArchivo, soloGore) => {
  const video = esVideo(url, tipoArchivo);
  const modelos = soloGore ? 'gore-2.0' : 'nudity-2.1,wad,gore-2.0';
  const parametros = new URLSearchParams({
    models: modelos,
    api_user: API_USER,
    api_secret: API_SECRET
  });
  parametros.set(video ? 'stream_url' : 'url', url);

  const endpoint = video
    ? 'https://api.sightengine.com/1.0/video/check-sync.json'
    : 'https://api.sightengine.com/1.0/check.json';
  const response = await fetch(`${endpoint}?${parametros}`);

  if (!response.ok) {
    const detalle = await response.json().catch(() => null);
    throw new Error(
      detalle?.error?.message ||
      `El servicio de moderación respondió con estado ${response.status}.`
    );
  }

  const data = await response.json();
  if (data.status !== 'success') {
    throw new Error(data.error?.message || 'El servicio de moderación no pudo analizar el archivo.');
  }

  const resultados = video ? data.data?.frames : [data];
  if (!Array.isArray(resultados) || resultados.length === 0) {
    throw new Error('El servicio de moderación no devolvió fotogramas para analizar.');
  }

  const gore = obtenerMaximo(resultados, (frame) => frame.gore?.prob);
  if (gore === null) {
    throw new Error('No se pudo comprobar si el archivo contiene gore.');
  }

  if (soloGore) {
    return { seguro: gore <= 0.4, detalle: data };
  }

  const sexualActivity = obtenerMaximo(resultados, (frame) => frame.nudity?.sexual_activity);
  const erotica = obtenerMaximo(resultados, (frame) => frame.nudity?.erotica);
  const weapon = obtenerMaximo(resultados, (frame) => frame.weapon);
  const alcohol = obtenerMaximo(resultados, (frame) => frame.alcohol);
  const drugs = obtenerMaximo(resultados, (frame) => frame.drugs);
  if ([sexualActivity, erotica, weapon, alcohol, drugs].some((valor) => valor === null)) {
    throw new Error('No se pudo verificar que el archivo sea apto para todo público.');
  }

  const contieneContenidoNoApto =
    sexualActivity > 0.2 ||
    erotica > 0.3 ||
    weapon > 0.4 ||
    alcohol > 0.4 ||
    drugs > 0.4 ||
    gore > 0.4;

  return { seguro: !contieneContenidoNoApto, detalle: data };
};

export const moderador = {
  validarTexto: async (texto) => {
    if (!texto) return { seguro: true };

    // 1. LIMPIEZA LOCAL (Para que no nos engañen con acentos o puntos)
    const textoLimpio = texto.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Quita acentos
    
    const contieneProhibida = PALABRAS_PROHIBIDAS.some(p => textoLimpio.includes(p));

    if (contieneProhibida) {
      return { seguro: false, razon: 'Filtro local detectó lenguaje no permitido.' };
    }

    // 2. CONSULTA API (Solo si pasa el filtro local)
    try {
      const url = `https://api.sightengine.com/1.0/check-text.json?text=${encodeURIComponent(texto)}&lang=es&mode=standard&api_user=${API_USER}&api_secret=${API_SECRET}`;
      const response = await fetch(url);
      const data = await response.json();

      const tieneGroserias = data.profanity?.matches?.length > 0;
      const esOfensivo = data.moderation?.sexual > 0.3 || data.moderation?.toxicity > 0.3;

      return { 
        seguro: !tieneGroserias && !esOfensivo, 
        detalle: data 
      };
    } catch (err) {
      console.warn("API de moderación no disponible, confiando en filtro local.");
      return { seguro: true }; // Si la API falla pero el local ya pasó, lo dejamos pasar
    }
  },

  validarMedia: async (url, tipoArchivo = '') => {
    return validarMedia(url, tipoArchivo, false);
  },

  validarMediaGore: async (url, tipoArchivo = '') => {
    return validarMedia(url, tipoArchivo, true);
  },

  validarMediaNoExplicita: async (url, tipoArchivo = '') => {
    return validarMedia(url, tipoArchivo, false);
  }
};

export default moderador;