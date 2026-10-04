import { supabase } from '../supabaseClient';

const AVATAR_BASE = 'https://via.placeholder.com/50?text=U';

// Carga toda la actividad del usuario en un formato único:
// { id, tipo: 'comentario'|'seguidor'|'reporte', nombre, foto,
//   contenido, tituloProyecto, fecha }
// Tolerante a tablas aún no creadas (devuelve lo que exista).
export const cargarActividad = async (userId) => {
  if (!userId) return [];
  const items = [];

  // Proyectos propios (para comentarios recibidos y reportes).
  let ids = [];
  let titulos = {};
  try {
    const { data: proyectos } = await supabase
      .from('proyectos').select('id, titulo').eq('usuario_id', userId);
    ids = (proyectos || []).map((p) => p.id);
    titulos = Object.fromEntries((proyectos || []).map((p) => [String(p.id), p.titulo]));
  } catch (error) {
    ids = [];
  }

  // 1. Comentarios de otros en mis obras.
  if (ids.length > 0) {
    try {
      const { data: comentarios } = await supabase
        .from('comentarios')
        .select('id, contenido, creado_el, proyecto_id, perfiles (nombre_completo, avatar_url)')
        .in('proyecto_id', ids)
        .neq('usuario_id', userId)
        .order('creado_el', { ascending: false })
        .limit(50);
      (comentarios || []).forEach((c) => items.push({
        id: `c-${c.id}`,
        tipo: 'comentario',
        nombre: c.perfiles?.nombre_completo || 'Usuario',
        foto: c.perfiles?.avatar_url || AVATAR_BASE,
        contenido: c.contenido,
        tituloProyecto: titulos[String(c.proyecto_id)] || 'tu publicación',
        fecha: c.creado_el,
      }));
    } catch (error) {
      // Sin comentarios o tabla no disponible.
    }
  }

  // 2. Nuevos seguidores.
  try {
    const { data: segs } = await supabase
      .from('seguimientos').select('id, creado_el, seguidor_id')
      .eq('seguido_id', userId)
      .order('creado_el', { ascending: false })
      .limit(50);
    if (segs && segs.length > 0) {
      const idsSeg = [...new Set(segs.map((s) => s.seguidor_id))];
      const { data: perf } = await supabase
        .from('perfiles').select('id, nombre_completo, avatar_url').in('id', idsSeg);
      const mapa = Object.fromEntries(((perf || [])).map((p) => [String(p.id), p]));
      segs.forEach((s) => {
        const p = mapa[String(s.seguidor_id)] || {};
        items.push({
          id: `s-${s.id}`,
          tipo: 'seguidor',
          nombre: p.nombre_completo || 'Usuario',
          foto: p.avatar_url || AVATAR_BASE,
          contenido: '',
          tituloProyecto: '',
          fecha: s.creado_el,
        });
      });
    }
  } catch (error) {
    // Tabla de seguimientos no disponible.
  }

  // 3. Reportes contra mi contenido o perfil.
  try {
    const consultas = [
      supabase.from('reportes').select('*').eq('tipo', 'perfil').eq('objetivo_id', String(userId)),
    ];
    if (ids.length > 0) {
      consultas.push(
        supabase.from('reportes').select('*').eq('tipo', 'proyecto').in('objetivo_id', ids.map(String))
      );
    }
    let idsCom = [];
    try {
      const { data: misCom } = await supabase
        .from('comentarios').select('id').eq('usuario_id', userId).limit(200);
      idsCom = (misCom || []).map((c) => String(c.id));
    } catch (error) {
      idsCom = [];
    }
    if (idsCom.length > 0) {
      consultas.push(
        supabase.from('reportes').select('*').eq('tipo', 'comentario').in('objetivo_id', idsCom)
      );
    }
    const resultados = await Promise.all(consultas);
    resultados.forEach((r) => (r.data || []).forEach((rep) => {
      const donde = rep.tipo === 'perfil'
        ? 'tu perfil'
        : rep.tipo === 'proyecto'
          ? (titulos[String(rep.objetivo_id)] || 'tu publicación')
          : 'tu comentario';
      items.push({
        id: `r-${rep.id}`,
        tipo: 'reporte',
        nombre: 'Moderación',
        foto: null,
        contenido: `${rep.motivo} (${rep.estado})`,
        tituloProyecto: donde,
        fecha: rep.creado_el,
      });
    }));
  } catch (error) {
    // Tabla de reportes no disponible.
  }

  items.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  return items;
};
