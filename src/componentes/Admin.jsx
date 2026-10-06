import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import AlertModal from './AlertModal';
import '../estilos/perfil.css';
import {
  ArrowLeft, ShieldAlert, Users, Flag, BarChart3,
  Check, X, Trash2,
} from 'lucide-react';

// Panel de administración (solo tipo_cuenta === 'admin').
// Pestañas: reportes y usuarios. Cada reporte muestra el contenido
// reportado (proyecto, comentario o perfil) para poder decidir.
const Admin = () => {
  const navigate = useNavigate();
  const [cargando, setCargando] = useState(true);
  const [esAdmin, setEsAdmin] = useState(false);
  const [tab, setTab] = useState('reportes');
  const [stats, setStats] = useState({ usuarios: 0, proyectos: 0, pendientes: 0 });
  const [reportes, setReportes] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [contenidos, setContenidos] = useState({});
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
    const lista = data || [];
    setReportes(lista);
    cargarContenidos(lista);
  };

  const nombreAutor = async (usuarioId) => {
    if (!usuarioId) return null;
    const { data } = await supabase
      .from('perfiles').select('nombre_completo').eq('id', usuarioId).maybeSingle();
    return data?.nombre_completo || null;
  };

  // Trae el contenido real de cada reporte para mostrarlo en la cola.
  const cargarContenidos = async (lista) => {
    const mapa = {};
    await Promise.all((lista || []).map(async (r) => {
      try {
        if (r.tipo === 'proyecto') {
          const { data: proyecto } = await supabase
            .from('proyectos')
            .select('id, titulo, archivo_url, tipo_archivo, usuario_id, creado_el')
            .eq('id', r.objetivo_id)
            .maybeSingle();
          if (!proyecto) {
            mapa[r.id] = { estado: 'no-encontrado' };
            return;
          }
          const autor = await nombreAutor(proyecto.usuario_id);
          mapa[r.id] = { estado: 'ok', proyecto, autor };
        } else if (r.tipo === 'comentario') {
          const { data: comentario } = await supabase
            .from('comentarios')
            .select('id, contenido, creado_el, usuario_id, proyecto_id')
            .eq('id', r.objetivo_id)
            .maybeSingle();
          if (!comentario) {
            mapa[r.id] = { estado: 'no-encontrado' };
            return;
          }
          const autor = await nombreAutor(comentario.usuario_id);
          let proyecto = null;
          if (comentario.proyecto_id) {
            const { data: p } = await supabase
              .from('proyectos')
              .select('id, titulo, archivo_url, tipo_archivo')
              .eq('id', comentario.proyecto_id)
              .maybeSingle();
            proyecto = p || null;
          }
          mapa[r.id] = { estado: 'ok', comentario, autor, proyecto };
        } else if (r.tipo === 'perfil') {
          const { data: perfil } = await supabase
            .from('perfiles')
            .select('id, nombre_completo, biografia, avatar_url, tipo_cuenta')
            .eq('id', r.objetivo_id)
            .maybeSingle();
          if (!perfil) {
            mapa[r.id] = { estado: 'no-encontrado' };
            return;
          }
          mapa[r.id] = { estado: 'ok', perfil };
        } else {
          mapa[r.id] = { estado: 'no-encontrado' };
        }
      } catch (e) {
        console.error('No se pudo cargar el contenido del reporte:', e.message);
        mapa[r.id] = { estado: 'error' };
      }
    }));
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
      try {
        if (reporte.tipo === 'proyecto') {
          // Borra dependencias primero (evita que la FK bloquee el borrado).
          await supabase.from('likes').delete().eq('proyecto_id', reporte.objetivo_id);
          await supabase.from('comentarios').delete().eq('proyecto_id', reporte.objetivo_id);
          await supabase.from('vistas').delete().eq('proyecto_id', reporte.objetivo_id);

          const { data, error } = await supabase
            .from('proyectos').delete().eq('id', reporte.objetivo_id).select('id');
          if (error) throw error;
          if (!data || data.length === 0) {
            avisar(
              'No se eliminó en la base de datos (permiso denegado por RLS o ya no existe). Ejecuta el bloque 9 de supabase.sql para dar permiso de borrado al admin y reintenta.',
              'error',
              'Borrado no aplicado'
            );
            return;
          }
        } else {
          // Comentario: borra primero sus respuestas anidadas (cualquier nivel).
          const { data: raiz } = await supabase
            .from('comentarios').select('id, proyecto_id').eq('id', reporte.objetivo_id).maybeSingle();
          if (!raiz) {
            avisar('El comentario ya no existe (otro admin lo eliminó).', 'info');
            await marcarReporte(reporte.id, 'revisado');
            setContenidos((prev) => ({ ...prev, [reporte.id]: { estado: 'no-encontrado' } }));
            return;
          }
          if (raiz.proyecto_id) {
            const { data: todos } = await supabase
              .from('comentarios').select('id, parent_id').eq('proyecto_id', raiz.proyecto_id);
            const hijosPorPadre = {};
            (todos || []).forEach((c) => {
              const pid = c.parent_id ? String(c.parent_id) : null;
              if (pid) {
                if (!hijosPorPadre[pid]) hijosPorPadre[pid] = [];
                hijosPorPadre[pid].push(String(c.id));
              }
            });
            const aBorrar = [];
            const cola = [...(hijosPorPadre[String(reporte.objetivo_id)] || [])];
            while (cola.length > 0) {
              const idHijo = cola.pop();
              aBorrar.push(idHijo);
              (hijosPorPadre[idHijo] || []).forEach((nieto) => cola.push(nieto));
            }
            if (aBorrar.length > 0) {
              const { error: errHijos } = await supabase.from('comentarios').delete().in('id', aBorrar);
              if (errHijos) throw errHijos;
            }
          } else {
            // Sin proyecto asociado: intenta borrar hijos directos.
            await supabase.from('comentarios').delete().eq('parent_id', reporte.objetivo_id);
          }

          const { data, error } = await supabase
            .from('comentarios').delete().eq('id', reporte.objetivo_id).select('id');
          if (error) throw error;
          if (!data || data.length === 0) {
            avisar(
              'No se eliminó en la base de datos (permiso denegado por RLS o ya no existe). Ejecuta el bloque 9 de supabase.sql para dar permiso de borrado al admin y reintenta.',
              'error',
              'Borrado no aplicado'
            );
            return;
          }
        }
        await marcarReporte(reporte.id, 'revisado');
        setContenidos((prev) => ({ ...prev, [reporte.id]: { estado: 'no-encontrado' } }));
        avisar('Contenido eliminado y reporte resuelto.', 'exito');
      } catch (e) {
        console.error('Error al eliminar contenido reportado:', e.message);
        avisar('Error al eliminar: ' + e.message, 'error');
      }
    }, 'Eliminar contenido');
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

  const renderContenido = (reporte) => {
    const info = contenidos[reporte.id];
    if (!info) {
      return <p className="texto-3 sin-margen">Cargando contenido reportado...</p>;
    }
    if (info.estado === 'no-encontrado') {
      return <p className="texto-3 sin-margen">El contenido ya fue eliminado o no existe.</p>;
    }
    if (info.estado === 'error') {
      return <p className="texto-3 sin-margen">No se pudo cargar el contenido.</p>;
    }
    if (reporte.tipo === 'proyecto' && info.proyecto) {
      const p = info.proyecto;
      return (
        <div className="fila" style={{ alignItems: 'flex-start', marginTop: '8px' }}>
          {p.archivo_url && (
            p.tipo_archivo === 'video' ? (
              <video src={p.archivo_url} controls style={{ width: '160px', borderRadius: '10px' }} />
            ) : p.tipo_archivo === 'audio' ? (
              <audio src={p.archivo_url} controls style={{ width: '200px' }} />
            ) : (
              <img src={p.archivo_url} alt={p.titulo} style={{ width: '160px', height: '100px', objectFit: 'cover', borderRadius: '10px' }} />
            )
          )}
          <div>
            <p className="sin-margen"><strong>{p.titulo}</strong></p>
            {info.autor && <small className="texto-3">Por {info.autor}</small>}
          </div>
        </div>
      );
    }
    if (reporte.tipo === 'comentario' && info.comentario) {
      const c = info.comentario;
      return (
        <div style={{ marginTop: '8px', padding: '10px 12px', background: 'var(--superficie-2)', border: '1px solid var(--borde)', borderRadius: '10px' }}>
          <p className="sin-margen texto-2">“{c.contenido}”</p>
          {info.autor && <small className="texto-3">Por {info.autor}</small>}
          {info.proyecto && (
            <div className="fila" style={{ marginTop: '8px' }}>
              {info.proyecto.archivo_url && info.proyecto.tipo_archivo !== 'audio' && (
                info.proyecto.tipo_archivo === 'video' ? (
                  <video src={info.proyecto.archivo_url} muted style={{ width: '90px', borderRadius: '8px' }} />
                ) : (
                  <img src={info.proyecto.archivo_url} alt={info.proyecto.titulo} style={{ width: '64px', height: '44px', objectFit: 'cover', borderRadius: '8px' }} />
                )
              )}
              <small className="texto-3">En: <strong>{info.proyecto.titulo}</strong></small>
            </div>
          )}
        </div>
      );
    }
    if (reporte.tipo === 'perfil' && info.perfil) {
      const pf = info.perfil;
      return (
        <div className="fila" style={{ marginTop: '8px' }}>
          <img
            src={pf.avatar_url || 'https://via.placeholder.com/40?text=U'}
            className="avatar avatar-md"
            alt=""
          />
          <div>
            <p className="sin-margen"><strong>{pf.nombre_completo}</strong> <span className="badge">{pf.tipo_cuenta}</span></p>
            {pf.biografia && <small className="texto-3">{pf.biografia}</small>}
          </div>
        </div>
      );
    }
    return null;
  };

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
                  <div className="fila-entre" style={{ alignItems: 'flex-start' }}>
                    <div className="crecer">
                      <span className="badge marca">{r.tipo}</span>{' '}
                      <span className="badge">{r.estado}</span>
                      <p className="sin-margen texto-2"><strong>{r.motivo}</strong></p>
                      {r.detalle && <p className="sin-margen texto-3">{r.detalle}</p>}
                      {renderContenido(r)}
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
