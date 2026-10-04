import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import AlertModal from './AlertModal';
import '../estilos/perfil.css';
import {
  ArrowLeft, ShieldAlert, Users, Flag, BarChart3,
  Check, X, Trash2, Ban, Crown,
} from 'lucide-react';

// Vista previa del contenido reportado (proyecto, comentario o perfil).
const VistaContenido = ({ contenido }) => {
  if (!contenido) return null;
  return (
    <div className="fila">
      {contenido.imagen && !contenido.esVideo && (
        <img src={contenido.imagen} alt="" className="avatar avatar-md" />
      )}
      {contenido.imagen && contenido.esVideo && (
        <video src={contenido.imagen} className="avatar avatar-md" muted playsInline preload="metadata" />
      )}
      <div className="crecer">
        <p className="sin-margen texto-2"><strong>{contenido.titulo}</strong></p>
        {contenido.subtitulo && <small className="texto-3">{contenido.subtitulo}</small>}
      </div>
    </div>
  );
};

// Botón que alterna entre suspender y reactivar (deshacer).
const BotonSuspension = ({ suspendido, onSuspender }) => (
  suspendido ? (
    <button type="button" className="btn-icono" title="Reactivar usuario" onClick={() => onSuspender(false)}>
      <Check size={16} />
    </button>
  ) : (
    <button type="button" className="btn-icono peligro" title="Suspender usuario" onClick={() => onSuspender(true)}>
      <Ban size={16} />
    </button>
  )
);

// Panel de administración (solo tipo_cuenta === 'admin').
// Pestañas: reportes y usuarios, más resumen.
const Admin = () => {
  const navigate = useNavigate();
  const [cargando, setCargando] = useState(true);
  const [esAdmin, setEsAdmin] = useState(false);
  const [miId, setMiId] = useState(null);
  const [tab, setTab] = useState('reportes');
  const [stats, setStats] = useState({ usuarios: 0, proyectos: 0, pendientes: 0 });
  const [reportes, setReportes] = useState([]);
  const [contenidos, setContenidos] = useState({});
  const [usuarios, setUsuarios] = useState([]);
  const [alerta, setAlerta] = useState({ visible: false, mensaje: '', tipo: 'info', titulo: '', onConfirm: null });

  const avisar = (mensaje, tipo = 'info', titulo) =>
    setAlerta({ visible: true, mensaje, tipo, titulo, onConfirm: null });
  const pedirConfirmacion = (mensaje, onConfirm, titulo = 'Confirmación') =>
    setAlerta({ visible: true, mensaje, tipo: 'confirm', titulo, onConfirm });

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }
      setMiId(user.id);
      const { data: perfil } = await supabase
        .from('perfiles').select('tipo_cuenta').eq('id', user.id).single();
      if (perfil?.tipo_cuenta !== 'admin') {
        setEsAdmin(false);
        setCargando(false);
        return;
      }
      setEsAdmin(true);
      await Promise.all([cargarStats(), cargarReportes(), cargarUsuarios()]);
      setCargando(false);
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const contar = async (tabla, extra = {}) => {
    const { count } = await supabase.from(tabla).select('id', { count: 'exact', head: true, ...extra });
    return count || 0;
  };

  const cargarStats = async () => {
    const [usuarios, proyectos, pendientes] = await Promise.all([
      contar('perfiles'),
      contar('proyectos'),
      supabase.from('reportes').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente')
        .then((r) => r.count || 0),
    ]);
    setStats({ usuarios, proyectos, pendientes });
  };

  const cargarReportes = async () => {
    const { data } = await supabase
      .from('reportes').select('*').order('creado_el', { ascending: false }).limit(100);
    setReportes(data || []);
    cargarContenidos(data || []);
  };

  // Trae el contenido señalado por cada reporte para poder decidir.
  const cargarContenidos = async (reps) => {
    const mapa = {};
    const proyIds = [...new Set(reps.filter((r) => r.tipo === 'proyecto').map((r) => r.objetivo_id))];
    const comIds = [...new Set(reps.filter((r) => r.tipo === 'comentario').map((r) => r.objetivo_id))];
    const perIds = [...new Set(reps.filter((r) => r.tipo === 'perfil').map((r) => r.objetivo_id))];
    const titulosProy = {};
    try {
      if (proyIds.length > 0) {
        const { data } = await supabase
          .from('proyectos').select('id, titulo, archivo_url, tipo_archivo').in('id', proyIds);
        (data || []).forEach((p) => {
          titulosProy[String(p.id)] = p.titulo;
          mapa[`proyecto:${p.id}`] = {
            titulo: p.titulo, imagen: p.archivo_url, esVideo: p.tipo_archivo === 'video',
          };
        });
      }
      if (comIds.length > 0) {
        const { data } = await supabase
          .from('comentarios').select('id, contenido, proyecto_id').in('id', comIds);
        const pids = [...new Set((data || []).map((c) => c.proyecto_id).filter(Boolean))];
        if (pids.length > 0) {
          const { data: proys } = await supabase.from('proyectos').select('id, titulo').in('id', pids);
          (proys || []).forEach((p) => {
            titulosProy[String(p.id)] = p.titulo;
          });
        }
        (data || []).forEach((c) => {
          mapa[`comentario:${c.id}`] = {
            titulo: `"${c.contenido}"`,
            subtitulo: titulosProy[String(c.proyecto_id)] ? `En: ${titulosProy[String(c.proyecto_id)]}` : '',
          };
        });
      }
      if (perIds.length > 0) {
        const { data } = await supabase
          .from('perfiles').select('id, nombre_completo, avatar_url, tipo_cuenta').in('id', perIds);
        (data || []).forEach((p) => {
          mapa[`perfil:${p.id}`] = {
            titulo: p.nombre_completo,
            imagen: p.avatar_url,
            suspendido: p.tipo_cuenta === 'suspendido',
          };
        });
      }
    } catch (error) {
      // Se muestra lo que se haya podido cargar.
    }
    reps.forEach((r) => {
      const k = `${r.tipo}:${r.objetivo_id}`;
      if (!mapa[k]) mapa[k] = { titulo: '(contenido no disponible: pudo ser eliminado)' };
    });
    setContenidos(mapa);
  };

  const cargarUsuarios = async () => {
    const { data } = await supabase
      .from('perfiles').select('id, nombre_completo, tipo_cuenta, disponible_trabajo')
      .order('nombre_completo').limit(100);
    setUsuarios(data || []);
  };

  const marcarReporte = async (id, estado) => {
    const { error } = await supabase.from('reportes').update({ estado }).eq('id', id);
    if (error) {
      avisar('Error: ' + error.message, 'error');
      return;
    }
    setReportes((prev) => prev.map((r) => (r.id === id ? { ...r, estado } : r)));
    cargarStats();
  };

  const eliminarContenido = (reporte) => {
    const que = reporte.tipo === 'proyecto' ? 'el proyecto' : 'el comentario';
    pedirConfirmacion(`¿Eliminar ${que} reportado? Esta acción no se puede deshacer.`, async () => {
      const tabla = reporte.tipo === 'proyecto' ? 'proyectos' : 'comentarios';
      const { error } = await supabase.from(tabla).delete().eq('id', reporte.objetivo_id);
      if (error) {
        avisar('Error al eliminar: ' + error.message, 'error');
        return;
      }
      // Verificación real: RLS puede ignorar el borrado sin error.
      const { data: aunExiste } = await supabase.from(tabla)
        .select('id').eq('id', reporte.objetivo_id).maybeSingle();
      if (aunExiste) {
        avisar('Sin permiso para borrar contenido ajeno. Ejecuta el paso 9 de supabase.sql y recarga el esquema.', 'error');
        return;
      }
      await marcarReporte(reporte.id, 'revisado');
      await cargarReportes();
      avisar('Contenido eliminado y reporte resuelto.', 'exito');
    }, 'Eliminar contenido');
  };

  const suspender = (usuarioId, suspendido) => {
    pedirConfirmacion(
      suspendido ? '¿Suspender esta cuenta? No podrá iniciar sesión.' : '¿Reactivar esta cuenta?',
      async () => {
        const { error } = await supabase.from('perfiles')
          .update({ tipo_cuenta: suspendido ? 'suspendido' : 'standard' })
          .eq('id', usuarioId);
        if (error) {
          avisar('Error: ' + error.message, 'error');
          return;
        }
        // Verificación real: RLS puede ignorar el cambio sin error.
        const { data: verif } = await supabase.from('perfiles')
          .select('tipo_cuenta').eq('id', usuarioId).single();
        const esperado = suspendido ? 'suspendido' : 'standard';
        if (!verif || verif.tipo_cuenta !== esperado) {
          avisar('Sin permiso para cambiar esa cuenta. Ejecuta el paso 9 de supabase.sql y recarga el esquema.', 'error');
          return;
        }
        setUsuarios((prev) => prev.map((u) =>
          u.id === usuarioId ? { ...u, tipo_cuenta: esperado } : u
        ));
        setContenidos((prev) => {
          const next = { ...prev };
          const k = `perfil:${usuarioId}`;
          if (next[k]) next[k] = { ...next[k], suspendido };
          return next;
        });
        avisar(suspendido ? 'Cuenta suspendida.' : 'Cuenta reactivada.', 'exito');
      },
      suspendido ? 'Suspender cuenta' : 'Reactivar cuenta'
    );
  };

  const cambiarRol = (usuarioId, rol) => {
    pedirConfirmacion(`¿Dar rol "${rol}" a este usuario?`, async () => {
      const { error } = await supabase.from('perfiles')
        .update({ tipo_cuenta: rol }).eq('id', usuarioId);
      if (error) {
        avisar('Error: ' + error.message, 'error');
        return;
      }
      setUsuarios((prev) => prev.map((u) =>
        u.id === usuarioId ? { ...u, tipo_cuenta: rol } : u
      ));
      avisar('Rol actualizado.', 'exito');
    }, 'Cambiar rol');
  };

  if (cargando) return <div className="dash-pantalla"><p className="dash-cargando">Verificando acceso...</p></div>;

  if (!esAdmin) {
    return (
      <section className="dash-pantalla">
        <div className="dash-vacio">
          <ShieldAlert size={34} />
          <span>Acceso restringido: se requiere rol de administrador.</span>
          <button type="button" className="btn btn-secundario" onClick={() => navigate('/dashboard')}>
            Volver a mi perfil
          </button>
        </div>
      </section>
    );
  }

  const pendientes = reportes.filter((r) => r.estado === 'pendiente');

  return (
    <section className="dash-pantalla">
      <div className="dash-barra">
        <button type="button" className="btn btn-ghost" onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={18} /> Mi perfil
        </button>
        <span className="badge marca"><ShieldAlert size={13} /> Administración</span>
      </div>

      <h2 className="dash-titulo-seccion">Panel de administración</h2>

      <div className="dash-panel">
        <div className="fila">
          <span className="dash-stat"><Users size={14} /> {stats.usuarios} usuarios</span>
          <span className="dash-stat"><BarChart3 size={14} /> {stats.proyectos} proyectos</span>
          <span className="dash-stat"><Flag size={14} /> {stats.pendientes} reportes pendientes</span>
        </div>
      </div>

      <div className="tabs">
        <button type="button" className={`tab ${tab === 'reportes' ? 'activo' : ''}`} onClick={() => setTab('reportes')}>
          <Flag size={14} /> Reportes {pendientes.length > 0 && `(${pendientes.length})`}
        </button>
        <button type="button" className={`tab ${tab === 'usuarios' ? 'activo' : ''}`} onClick={() => setTab('usuarios')}>
          <Users size={14} /> Usuarios
        </button>
      </div>

      {tab === 'reportes' && (
        <div className="dash-panel">
          <h4 className="dash-panel-titulo"><Flag size={18} /> Cola de moderación</h4>
          {reportes.length === 0 ? (
            <p className="texto-3">No hay reportes.</p>
          ) : (
            <div className="columna">
              {reportes.map((r) => (
                <div key={r.id}>
                  <div className="fila-entre">
                    <div className="crecer">
                      <span className="badge marca">{r.tipo}</span>{' '}
                      <span className="badge">{r.estado}</span>
                      <div className="mt-3">
                        <VistaContenido contenido={contenidos[`${r.tipo}:${r.objetivo_id}`]} />
                      </div>
                      <p className="texto-2 mt-3"><strong>Motivo: {r.motivo}</strong></p>
                      {r.detalle && <p className="sin-margen texto-3">{r.detalle}</p>}
                      <small className="texto-3">
                        {r.creado_el ? new Date(r.creado_el).toLocaleString('es-VE') : ''}
                      </small>
                    </div>
                    {r.estado === 'pendiente' && (
                      <div className="fila">
                        {r.tipo !== 'perfil' && (
                          <button type="button" className="btn-icono peligro" title="Eliminar contenido" onClick={() => eliminarContenido(r)}>
                            <Trash2 size={16} />
                          </button>
                        )}
                        {r.tipo === 'perfil' && (
                          <BotonSuspension
                            suspendido={!!contenidos[`perfil:${r.objetivo_id}`]?.suspendido}
                            onSuspender={(v) => suspender(r.objetivo_id, v)}
                          />
                        )}
                        <button type="button" className="btn-icono" title="Desestimar" onClick={() => marcarReporte(r.id, 'desestimado')}>
                          <X size={16} />
                        </button>
                        <button type="button" className="btn-icono marca" title="Marcar revisado" onClick={() => marcarReporte(r.id, 'revisado')}>
                          <Check size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                  <hr className="divisor" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'usuarios' && (
        <div className="dash-panel">
          <h4 className="dash-panel-titulo"><Users size={18} /> Usuarios</h4>
          <div className="columna">
            {usuarios.map((u) => (
              <div key={u.id}>
                <div className="fila-entre">
                  <div className="crecer">
                    <strong>{u.nombre_completo}</strong>{' '}
                    <span className="badge">{u.tipo_cuenta}</span>
                    {u.disponible_trabajo && <span className="badge marca">Disponible</span>}
                  </div>
                  {String(u.id) !== String(miId) && (
                    <div className="fila">
                      {u.tipo_cuenta !== 'admin' && (
                        <button type="button" className="btn-icono marca" title="Hacer admin" onClick={() => cambiarRol(u.id, 'admin')}>
                          <Crown size={16} />
                        </button>
                      )}
                      {u.tipo_cuenta === 'suspendido' ? (
                        <button type="button" className="btn-icono" title="Reactivar" onClick={() => suspender(u.id, false)}>
                          <Check size={16} />
                        </button>
                      ) : (
                        <button type="button" className="btn-icono peligro" title="Suspender" onClick={() => suspender(u.id, true)}>
                          <Ban size={16} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <hr className="divisor" />
              </div>
            ))}
          </div>
        </div>
      )}

      <AlertModal alerta={alerta} setAlerta={setAlerta} />
    </section>
  );
};

export default Admin;
