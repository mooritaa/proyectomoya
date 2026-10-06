import { supabase } from '../supabaseClient';

const STORAGE_KEY_NOTIFICACIONES_LEIDAS = 'pocketwork_notificaciones_leidas';
const STORAGE_KEY_NOTIFICACIONES_LEIDAS_ADULTO = 'pocketwork_notificaciones_leidas_adulto';
const STORAGE_KEY_CONTENIDO_EXPLICITO = 'pocketwork_adulto_contenido_explicito';

let contextoAudio = null;
let sonidoHabilitado = false;

export const obtenerClaveNotificacionesLeidas = (esAdulto) => (
  esAdulto
    ? STORAGE_KEY_NOTIFICACIONES_LEIDAS_ADULTO
    : STORAGE_KEY_NOTIFICACIONES_LEIDAS
);

export const actualizarNuevasNotificaciones = (actividad, referenciaIds) => {
  const idsActuales = actividad.map((item) => item.id);
  const idsAnteriores = referenciaIds.current;
  referenciaIds.current = idsActuales;

  if (!idsAnteriores) return [];
  return actividad.filter((item) => !idsAnteriores.includes(item.id));
};

export const habilitarSonidoNotificaciones = () => {
  if (typeof window === 'undefined') return;

  const AudioContextAPI = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextAPI) return;

  try {
    if (!contextoAudio) contextoAudio = new AudioContextAPI();
    const promesaReanudacion = contextoAudio.resume();
    if (promesaReanudacion && typeof promesaReanudacion.catch === 'function') {
      promesaReanudacion.catch((error) => {
        console.warn('No se pudo habilitar el sonido de notificaciones:', error);
      });
    }
    sonidoHabilitado = true;
  } catch (error) {
    console.warn('No se pudo habilitar el sonido de notificaciones:', error);
  }
};

export const reproducirSonidoNotificacion = () => {
  if (!sonidoHabilitado || !contextoAudio) return;

  try {
    const oscilador = contextoAudio.createOscillator();
    const volumen = contextoAudio.createGain();
    oscilador.type = 'sine';
    oscilador.frequency.setValueAtTime(880, contextoAudio.currentTime);
    volumen.gain.setValueAtTime(0.0001, contextoAudio.currentTime);
    volumen.gain.exponentialRampToValueAtTime(0.12, contextoAudio.currentTime + 0.02);
    volumen.gain.exponentialRampToValueAtTime(0.0001, contextoAudio.currentTime + 0.22);
    oscilador.connect(volumen);
    volumen.connect(contextoAudio.destination);
    oscilador.start();
    oscilador.stop(contextoAudio.currentTime + 0.23);
  } catch (error) {
    console.warn('No se pudo reproducir el sonido de notificación:', error);
  }
};

export const cargarActividad = async (usuarioId, proyectosPropiosIds = [], esAdulto = false) => {
  if (!usuarioId) return [];

  let mostrarExplicito = false;
  if (esAdulto && typeof window !== 'undefined') {
    mostrarExplicito = window.localStorage.getItem(STORAGE_KEY_CONTENIDO_EXPLICITO) === 'true';
  }

  const { data: seguimientos, error: errorSeguimientos } = await supabase
    .from('seguimientos')
    .select('seguido_id')
    .eq('seguidor_id', usuarioId);
  if (errorSeguimientos) {
    throw new Error(`No se pudieron cargar las cuentas que sigues: ${errorSeguimientos.message}`);
  }

  const idsSeguidos = (seguimientos || [])
    .map((seguimiento) => seguimiento.seguido_id)
    .filter((id) => id && id !== usuarioId);

  let publicaciones = [];
  if (idsSeguidos.length > 0) {
    let consultaPublicaciones = supabase
      .from('proyectos')
      .select('id, titulo, usuario_id, creado_el, es_nsfw, perfiles ( nombre_completo, avatar_url )')
      .in('usuario_id', idsSeguidos)
      .order('creado_el', { ascending: false });

    if (!mostrarExplicito) {
      consultaPublicaciones = consultaPublicaciones.or('es_nsfw.is.null,es_nsfw.eq.false');
    }

    const { data, error } = await consultaPublicaciones;
    if (error) {
      throw new Error(`No se pudieron cargar las publicaciones de las cuentas que sigues: ${error.message}`);
    }
    publicaciones = data || [];
  }

  const idsProyectosPropios = [...new Set(proyectosPropiosIds.filter(Boolean))];
  let proyectosPropios = [];
  if (idsProyectosPropios.length > 0) {
    const { data, error } = await supabase
      .from('proyectos')
      .select('id, titulo, es_nsfw')
      .in('id', idsProyectosPropios);
    if (error) {
      throw new Error(`No se pudieron cargar tus publicaciones para la actividad: ${error.message}`);
    }
    proyectosPropios = (data || []).filter(
      (proyecto) => mostrarExplicito || proyecto.es_nsfw !== true
    );
  }

  let comentarios = [];
  if (proyectosPropios.length > 0) {
    const titulosPorProyecto = new Map(
      proyectosPropios.map((proyecto) => [proyecto.id, proyecto.titulo])
    );
    const { data, error } = await supabase
      .from('comentarios')
      .select('id, contenido, creado_el, usuario_id, proyecto_id, perfiles ( nombre_completo, avatar_url )')
      .in('proyecto_id', proyectosPropios.map((proyecto) => proyecto.id))
      .neq('usuario_id', usuarioId)
      .order('creado_el', { ascending: false });
    if (error) {
      throw new Error(`No se pudieron cargar los comentarios de tus publicaciones: ${error.message}`);
    }

    comentarios = (data || []).map((comentario) => ({
      id: `comentario-${comentario.id}`,
      tipo: 'comentario',
      usuarioId: comentario.usuario_id,
      nombre: comentario.perfiles?.nombre_completo || 'Usuario',
      foto: comentario.perfiles?.avatar_url || 'https://via.placeholder.com/40?text=U',
      fecha: comentario.creado_el,
      contenido: comentario.contenido,
      tituloProyecto: titulosPorProyecto.get(comentario.proyecto_id) || 'Publicación',
    }));
  }

  const actividadPublicaciones = publicaciones.map((publicacion) => ({
    id: `publicacion-${publicacion.id}`,
    tipo: 'publicacion',
    usuarioId: publicacion.usuario_id,
    nombre: publicacion.perfiles?.nombre_completo || 'Usuario',
    foto: publicacion.perfiles?.avatar_url || 'https://via.placeholder.com/40?text=U',
    fecha: publicacion.creado_el,
    tituloProyecto: publicacion.titulo || 'Sin título',
  }));

  return [...actividadPublicaciones, ...comentarios]
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
};
