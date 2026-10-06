import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Link, useNavigate } from 'react-router-dom';
import { User, MessageCircle, Heart, Search, X, Send, Flag } from 'lucide-react';
import { moderador } from './moderacion';
import ComentarioIndividual from './ComentarioIndividual';
import AlertModal from './AlertModal';
import ModalReporte from './ModalReporte';
import '../estilos/galeria.css';

const Galeria = () => {
  const [proyectos, setProyectos] = useState([]);
  const [terminoBusqueda, setTerminoBusqueda] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('titulo');
  const [cargando, setCargando] = useState(true);
  const [busquedaRealizada, setBusquedaRealizada] = useState(false);
  const [userId, setUserId] = useState(null);
  const [puedeVerExplicito, setPuedeVerExplicito] = useState(false);

  const [proyectoSeleccionado, setProyectoSeleccionado] = useState(null);
  const [comentarios, setComentarios] = useState([]);
  const [nuevoComentario, setNuevoComentario] = useState('');
  const [enviandoComentario, setEnviandoComentario] = useState(false);
  const [respondiendoA, setRespondiendoA] = useState(null);
  const [textoRespuesta, setTextoRespuesta] = useState('');
  const [comentarioEditandoId, setComentarioEditandoId] = useState(null);
  const [comentarioEditandoTexto, setComentarioEditandoTexto] = useState('');

  const [alerta, setAlerta] = useState({ visible: false, mensaje: '', tipo: 'info', titulo: '', onConfirm: null });
  const avisar = (mensaje, tipo = 'info', titulo) =>
    setAlerta({ visible: true, mensaje, tipo, titulo, onConfirm: null });
  const pedirConfirmacion = (mensaje, onConfirm, titulo = 'Confirmación') =>
    setAlerta({ visible: true, mensaje, tipo: 'confirm', titulo, onConfirm });

  const [reporte, setReporte] = useState(null);
  const [tab, setTab] = useState('todos');
  const [seguidos, setSeguidos] = useState([]);

  const cerrarReporte = (ok) => {
    setReporte(null);
    if (ok) avisar('Reporte enviado. Un moderador lo revisará.', 'exito');
  };

  const navigate = useNavigate();

  useEffect(() => {
    inicializar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inicializar = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const currentId = user?.id || null;
    setUserId(currentId);
    let esAdulto = false;
    if (currentId) {
      const { data: perfilUsuario, error } = await supabase
        .from('perfiles')
        .select('tipo_cuenta')
        .eq('id', currentId)
        .maybeSingle();
      if (error) {
        console.error('No se pudo comprobar el tipo de cuenta para filtrar la galería:', error.message);
      } else {
        esAdulto = perfilUsuario?.tipo_cuenta === 'adulto';
      }
    }
    setPuedeVerExplicito(esAdulto);
    fetchProyectosGlobales(false, currentId, esAdulto);
    if (currentId) cargarSeguidos(currentId);
  };

  const cargarSeguidos = async (miId) => {
    const { data } = await supabase.from('seguimientos').select('seguido_id').eq('seguidor_id', miId);
    setSeguidos((data || []).map((s) => s.seguido_id));
  };

  const registrarVista = (proyectoId) => {
    if (!proyectoId) return;
    supabase.from('vistas').insert({ proyecto_id: proyectoId, usuario_id: userId || null })
      .then(() => {}, () => {});
  };

  const fetchProyectosGlobales = async (
    esBusqueda = false,
    idParaCarga = null,
    mostrarExplicito = puedeVerExplicito
  ) => {
    setCargando(true);
    const activeUserId = idParaCarga || userId;

    try {
      let query = supabase
        .from('proyectos')
        .select(`
          id, titulo, archivo_url, tipo_archivo, usuario_id, creado_el, es_nsfw,
          perfiles!inner ( nombre_completo, avatar_url ),
          likes ( usuario_id ),
          comentarios (count)
        `);

      if (!mostrarExplicito) {
        query = query.or('es_nsfw.is.null,es_nsfw.eq.false');
      }

      if (esBusqueda && terminoBusqueda.trim() !== '') {
        const t = `%${terminoBusqueda.trim()}%`;
        if (tipoFiltro === 'titulo') {
          query = query.ilike('titulo', t);
        } else {
          query = query.ilike('perfiles.nombre_completo', t);
        }
        setBusquedaRealizada(true);
      } else {
        setBusquedaRealizada(false);
      }

      if (activeUserId) {
        query = query.not('usuario_id', 'eq', activeUserId);
      }

      const { data, error } = await query.order('creado_el', { ascending: false });
      if (error) throw error;

      const proyectosProcesados = data.map(p => {
        const yaTieneMiLike = activeUserId ? p.likes?.some(l => l.usuario_id === activeUserId) : false;
        return {
          ...p,
          totalLikes: p.likes?.length || 0,
          totalComentarios: p.comentarios?.[0]?.count || 0,
          miLike: yaTieneMiLike
        };
      });

      setProyectos(proyectosProcesados);
    } catch (err) {
      console.error('Error en Galería:', err);
    } finally {
      setCargando(false);
    }
  };

  const abrirProyecto = (proyecto) => {
    setProyectoSeleccionado(proyecto);
    registrarVista(proyecto.id);
    setRespondiendoA(null);
    setComentarioEditandoId(null);
    setComentarioEditandoTexto('');
    fetchComentarios(proyecto.id);
  };

  const fetchComentarios = async (proyectoId) => {
    const { data, error } = await supabase
      .from('comentarios')
      .select(`
        id, contenido, creado_el, usuario_id, parent_id, proyecto_id,
        perfiles ( id, nombre_completo, avatar_url )
      `)
      .eq('proyecto_id', proyectoId)
      .order('creado_el', { ascending: true });

    if (error) {
      console.error('Error al traer comentarios:', error.message);
    } else {
      setComentarios(data || []);
    }
  };

  const enviarComentario = async (e) => {
    e.preventDefault();
    if (!nuevoComentario.trim() || !userId || !proyectoSeleccionado?.id) return;

    if (nuevoComentario.trim().length > 100) {
      avisar('El comentario es demasiado largo (máximo 100 caracteres).', 'info');
      return;
    }

    if (!(puedeVerExplicito && proyectoSeleccionado.es_nsfw === true)) {
      const moderacion = await moderador.validarTexto(nuevoComentario.trim());
      if (!moderacion.seguro) {
        avisar(moderacion.razon || 'Contenido inapropiado detectado.', 'error', 'Comentario bloqueado');
        return;
      }
    }

    setEnviandoComentario(true);
    const { error } = await supabase.from('comentarios').insert({
      proyecto_id: proyectoSeleccionado.id,
      usuario_id: userId,
      contenido: nuevoComentario.trim()
    });

    if (!error) {
      setNuevoComentario('');
      await fetchComentarios(proyectoSeleccionado.id);
    }
    setEnviandoComentario(false);
  };

  const enviarRespuesta = async (padreId) => {
    if (!proyectoSeleccionado?.id) {
      avisar('Selecciona un proyecto para responder.', 'info');
      return;
    }
    if (!textoRespuesta.trim()) {
      avisar('Escribe algo en la respuesta antes de enviar.', 'info');
      return;
    }
    if (textoRespuesta.trim().length > 100) {
      avisar('La respuesta es demasiado larga (máximo 100 caracteres).', 'info');
      return;
    }

    if (!(puedeVerExplicito && proyectoSeleccionado.es_nsfw === true)) {
      const moderacionRespuesta = await moderador.validarTexto(textoRespuesta.trim());
      if (!moderacionRespuesta.seguro) {
        avisar('Contiene contenido inapropiado.', 'error', 'Respuesta bloqueada');
        return;
      }
    }

    const { error } = await supabase.from('comentarios').insert({
      proyecto_id: proyectoSeleccionado.id,
      usuario_id: userId,
      contenido: textoRespuesta.trim(),
      parent_id: padreId
    });

    if (!error) {
      setTextoRespuesta('');
      setRespondiendoA(null);
      await fetchComentarios(proyectoSeleccionado.id);
    } else {
      avisar('Error al enviar respuesta: ' + error.message, 'error');
    }
  };

  const actualizarComentario = async (comentarioId, contenido) => {
    if (!contenido.trim()) {
      avisar('El contenido no puede estar vacío.', 'info');
      return;
    }
    if (contenido.trim().length > 100) {
      avisar('El comentario es demasiado largo (máximo 100 caracteres).', 'info');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      avisar('Debes iniciar sesión para editar.', 'info');
      return;
    }

    if (!(puedeVerExplicito && proyectoSeleccionado?.es_nsfw === true)) {
      const resultadoModeracion = await moderador.validarTexto(contenido.trim());
      if (!resultadoModeracion.seguro) {
        avisar(resultadoModeracion.razon || 'Contenido inapropiado.', 'error', 'Comentario bloqueado');
        return;
      }
    }

    const { error } = await supabase
      .from('comentarios')
      .update({ contenido: contenido.trim() })
      .eq('id', comentarioId)
      .eq('usuario_id', user.id);

    if (error) {
      avisar('Error al actualizar comentario: ' + error.message, 'error');
      return;
    }

    setComentarios(prev =>
      prev.map(c => c.id === comentarioId ? { ...c, contenido: contenido.trim() } : c)
    );
    setComentarioEditandoId(null);
    setComentarioEditandoTexto('');
    if (proyectoSeleccionado?.id) await fetchComentarios(proyectoSeleccionado.id);
  };

  const borrarComentario = (comentarioId) => {
    pedirConfirmacion('¿Estás seguro de que quieres eliminar este comentario?', async () => {
      const { error } = await supabase
        .from('comentarios')
        .delete()
        .eq('id', comentarioId)
        .eq('usuario_id', userId);

      if (error) {
        avisar('Error al borrar comentario: ' + error.message, 'error');
        return;
      }
      setComentarios(prev => prev.filter(c => c.id !== comentarioId));
      if (proyectoSeleccionado?.id) await fetchComentarios(proyectoSeleccionado.id);
    }, 'Eliminar comentario');
  };

  const manejarLike = async (e, proyectoId, yaTieneLike) => {
    e.stopPropagation();
    if (!userId) return;

    setProyectos(prev => prev.map(p => p.id === proyectoId ?
      { ...p, miLike: !yaTieneLike, totalLikes: yaTieneLike ? p.totalLikes - 1 : p.totalLikes + 1 } : p
    ));

    if (yaTieneLike) {
      await supabase.from('likes').delete().match({ usuario_id: userId, proyecto_id: proyectoId });
    } else {
      await supabase.from('likes').insert({ usuario_id: userId, proyecto_id: proyectoId });
    }
  };

  const resetearGaleria = () => {
    setTerminoBusqueda('');
    setBusquedaRealizada(false);
    fetchProyectosGlobales(false);
  };

  const irAPerfilAutor = (e, usuarioIdAutor) => {
    e.stopPropagation();
    if (usuarioIdAutor) navigate(`/perfil/${usuarioIdAutor}`);
  };

  const visibles = proyectos.filter((p) => tab === 'todos' || seguidos.includes(p.usuario_id));

  return (
    <section className="gal-pantalla">
      <div className="gal-panel">
        <nav className="gal-barra">
          <h1 className="gal-titulo">Publicaciones</h1>

          <div className="gal-buscador">
            <select
              value={tipoFiltro}
              onChange={(e) => setTipoFiltro(e.target.value)}
              className="gal-selector"
              aria-label="Tipo de búsqueda"
            >
              <option value="titulo">Proyecto</option>
              <option value="usuario">Usuario</option>
            </select>
            <input
              type="text"
              placeholder="Buscar..."
              value={terminoBusqueda}
              onChange={(e) => setTerminoBusqueda(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchProyectosGlobales(true)}
              className="gal-entrada"
            />
            <button type="button" className="gal-btn-buscar" onClick={() => fetchProyectosGlobales(true)} title="Buscar">
              <Search size={18} />
            </button>
            {busquedaRealizada && (
              <button type="button" className="btn-icono chico" onClick={resetearGaleria} title="Limpiar búsqueda">
                <X size={16} />
              </button>
            )}
          </div>

          <div className="fila">
            <Link to={puedeVerExplicito ? '/dashboard-adulto' : '/dashboard'} className="btn btn-secundario">
              <User size={18} /> Mi perfil
            </Link>
          </div>
        </nav>

        <div className="tabs mb-3">
          <button type="button" className={`tab ${tab === 'todos' ? 'activo' : ''}`} onClick={() => setTab('todos')}>
            Todos
          </button>
          <button type="button" className={`tab ${tab === 'siguiendo' ? 'activo' : ''}`} onClick={() => setTab('siguiendo')}>
            Siguiendo
          </button>
        </div>

        <div className="gal-grid">
          {cargando ? (
            <p className="gal-cargando">Cargando publicaciones...</p>
          ) : visibles.length === 0 ? (
            <div className="gal-vacio">
              <Search size={34} />
              <span>{tab === 'siguiendo' ? 'Aún no sigues a nadie con publicaciones. Visita un perfil y pulsa Seguir.' : 'No hay publicaciones para mostrar por ahora.'}</span>
            </div>
          ) : (
            visibles.map((obra) => (
              <article key={obra.id} className="gal-tarjeta">
                <div className="gal-media" onClick={() => abrirProyecto(obra)}>
                  {obra.tipo_archivo === 'video' ? (
                    <video src={obra.archivo_url} muted playsInline preload="metadata" />
                  ) : (
                    <img src={obra.archivo_url} alt={obra.titulo} />
                  )}
                  <button
                    type="button"
                    onClick={(e) => manejarLike(e, obra.id, !!obra.miLike)}
                    className={`gal-btn-like ${obra.miLike ? 'activo' : ''}`}
                    title={obra.miLike ? 'Quitar like' : 'Dar like'}
                  >
                    <Heart size={15} fill={obra.miLike ? 'currentColor' : 'none'} /> {obra.totalLikes}
                  </button>
                </div>

                <div className="gal-info">
                  <h3 className="gal-obra-titulo" onClick={() => abrirProyecto(obra)}>{obra.titulo}</h3>
                  <div className="gal-metricas">
                    <span className="gal-metrica"><Heart size={13} /> {obra.totalLikes}</span>
                    <span className="gal-metrica"><MessageCircle size={13} /> {obra.totalComentarios}</span>
                  </div>
                  <button
                    type="button"
                    className="gal-autor"
                    onClick={(e) => irAPerfilAutor(e, obra.usuario_id)}
                  >
                    <img
                      src={obra.perfiles?.avatar_url || 'https://via.placeholder.com/30?text=U'}
                      className="avatar avatar-sm"
                      alt=""
                    />
                    <span className="gal-autor-nombre">{obra.perfiles?.nombre_completo}</span>
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </div>

      {proyectoSeleccionado && (
        <div className="modal-fondo ancho" onClick={() => setProyectoSeleccionado(null)}>
          <div className="modal-obra" onClick={(e) => e.stopPropagation()}>
            <div className="modal-obra-media">
              {proyectoSeleccionado.tipo_archivo === 'video' ? (
                <video src={proyectoSeleccionado.archivo_url} controls autoPlay />
              ) : (
                <img src={proyectoSeleccionado.archivo_url} alt={proyectoSeleccionado.titulo} />
              )}
            </div>
            <div className="modal-obra-lado">
              <div className="modal-obra-cabecera">
                <h2 className="modal-obra-titulo">{proyectoSeleccionado.titulo}</h2>
                <button
                  type="button"
                  className="accion"
                  title="Reportar proyecto"
                  onClick={() => setReporte({ tipo: 'proyecto', objetivoId: proyectoSeleccionado.id, tituloObjetivo: proyectoSeleccionado.titulo })}
                >
                  <Flag size={16} />
                </button>
                <button type="button" className="btn-icono chico" onClick={() => setProyectoSeleccionado(null)} title="Cerrar">
                  <X size={16} />
                </button>
              </div>

              <p className="modal-obra-conteo">
                {comentarios.length} comentario{comentarios.length === 1 ? '' : 's'}
              </p>

              <div className="lista-comentarios">
                {comentarios.filter(c => !c.parent_id).map(c => (
                  <ComentarioIndividual
                    key={c.id}
                    comentario={c}
                    todosLosComentarios={comentarios}
                    alResponder={setRespondiendoA}
                    alBorrar={borrarComentario}
                    respondiendoA={respondiendoA}
                    enviarRespuesta={enviarRespuesta}
                    textoRespuesta={textoRespuesta}
                    setTextoRespuesta={setTextoRespuesta}
                    currentUserId={userId}
                    comentarioEditandoId={comentarioEditandoId}
                    comentarioEditandoTexto={comentarioEditandoTexto}
                    setComentarioEditandoId={setComentarioEditandoId}
                    setComentarioEditandoTexto={setComentarioEditandoTexto}
                    actualizarComentario={actualizarComentario}
                    esMiPublicacion={String(proyectoSeleccionado?.usuario_id) === String(userId)}
                    alReportar={(c) => setReporte({ tipo: 'comentario', objetivoId: c.id, tituloObjetivo: `Comentario: "${(c.contenido || '').slice(0, 60)}"` })}
                  />
                ))}
              </div>

              <form onSubmit={enviarComentario} className="form-comentario">
                <input
                  className="campo"
                  placeholder="Escribe un comentario..."
                  value={nuevoComentario}
                  onChange={(e) => setNuevoComentario(e.target.value)}
                  maxLength={100}
                />
                <button type="submit" disabled={enviandoComentario} className="btn-enviar-comentario" title="Enviar">
                  <Send size={17} />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      <AlertModal alerta={alerta} setAlerta={setAlerta} />
      <ModalReporte reporte={reporte} onClose={cerrarReporte} />
    </section>
  );
};

export default Galeria;
