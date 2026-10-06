import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { moderador } from './moderacion';
import ComentarioIndividual from './ComentarioIndividual';
import AlertModal from './AlertModal';
import ModalReporte from './ModalReporte';
import { esFondoClaro } from './temasPerfil';
import '../estilos/perfil.css';
import { ArrowLeft, User, Heart, MessageCircle, Inbox, Send, X, Flag, UserPlus, UserMinus } from 'lucide-react';

const PerfilPublico = () => {
  const { idUsuario } = useParams();
  const navigate = useNavigate();

  const [perfil, setPerfil] = useState(null);
  const [obras, setObras] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [miId, setMiId] = useState(null);
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
  const [siguiendo, setSiguiendo] = useState(false);
  const [nSeguidores, setNSeguidores] = useState(0);

  const cerrarReporte = (ok) => {
    setReporte(null);
    if (ok) avisar('Reporte enviado. Un moderador lo revisará.', 'exito');
  };

  useEffect(() => {
    const cargarTodo = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setMiId(user?.id || null);
      let puedeVerExplicito = false;

      if (user) {
        const { data: perfilVisitante, error: errorVisitante } = await supabase
          .from('perfiles')
          .select('tipo_cuenta')
          .eq('id', user.id)
          .maybeSingle();
        if (errorVisitante) {
          console.error('No se pudo comprobar el tipo de cuenta para el perfil:', errorVisitante.message);
        } else {
          puedeVerExplicito = perfilVisitante?.tipo_cuenta === 'adulto';
        }
      }
      setPuedeVerExplicito(puedeVerExplicito);

      const { data: dataPerfil } = await supabase
        .from('perfiles').select('*').eq('id', idUsuario).single();

      if (dataPerfil) {
        setPerfil(dataPerfil);
        document.body.style.backgroundColor = dataPerfil.color_fondo_web || '#0f0f0f';
      }

      let queryObras = supabase
        .from('proyectos')
        .select('*, likes (usuario_id), comentarios (count)')
        .eq('usuario_id', idUsuario);
      if (!puedeVerExplicito) {
        queryObras = queryObras.or('es_nsfw.is.null,es_nsfw.eq.false');
      }
      const { data: dataObras, error: errorObras } = await queryObras.order('creado_el', { ascending: false });
      if (errorObras) {
        console.error('Error cargando publicaciones del perfil:', errorObras.message);
      }

      if (dataObras) {
        const procesadas = dataObras.map(o => ({
          ...o,
          totalLikes: Number(o.likes?.length) || 0,
          miLike: user ? o.likes?.some(l => l.usuario_id === user.id) : false
        }));
        setObras(procesadas);
      }
      setCargando(false);
    };

    cargarTodo();
    return () => { document.body.style.backgroundColor = ''; };
  }, [idUsuario]);

  useEffect(() => {
    const cargarSeguimiento = async () => {
      if (!miId) return;
      const { data } = await supabase.from('seguimientos').select('id')
        .eq('seguidor_id', miId).eq('seguido_id', idUsuario);
      setSiguiendo((data || []).length > 0);
      const { count } = await supabase.from('seguimientos')
        .select('id', { count: 'exact', head: true }).eq('seguido_id', idUsuario);
      setNSeguidores(count || 0);
    };
    cargarSeguimiento();
  }, [miId, idUsuario]);

  const alternarSeguir = async () => {
    if (!miId || String(miId) === String(idUsuario)) return;
    if (siguiendo) {
      await supabase.from('seguimientos').delete()
        .eq('seguidor_id', miId).eq('seguido_id', idUsuario);
      setSiguiendo(false);
      setNSeguidores((n) => Math.max(0, n - 1));
    } else {
      const { error } = await supabase.from('seguimientos').insert({
        seguidor_id: miId, seguido_id: idUsuario,
      });
      if (error) {
        avisar('No se pudo seguir: ' + error.message, 'error');
        return;
      }
      setSiguiendo(true);
      setNSeguidores((n) => n + 1);
    }
  };

  const registrarVista = (proyectoId) => {
    if (!proyectoId) return;
    supabase.from('vistas').insert({ proyecto_id: proyectoId, usuario_id: miId || null })
      .then(() => {}, () => {});
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
    const { data } = await supabase
      .from('comentarios')
      .select('id, contenido, creado_el, usuario_id, parent_id, proyecto_id, perfiles ( id, nombre_completo, avatar_url )')
      .eq('proyecto_id', proyectoId)
      .order('creado_el', { ascending: true });
    setComentarios(data || []);
  };

  const enviarComentario = async (e) => {
    e.preventDefault();
    if (!nuevoComentario.trim() || !miId) return;

    if (nuevoComentario.trim().length > 100) {
      avisar('El comentario es demasiado largo (máximo 100 caracteres).', 'info');
      return;
    }

    if (!(puedeVerExplicito && proyectoSeleccionado?.es_nsfw === true)) {
      const moderacion = await moderador.validarTexto(nuevoComentario.trim());
      if (!moderacion.seguro) {
        avisar(moderacion.razon || 'Contenido inapropiado detectado.', 'error', 'Comentario bloqueado');
        return;
      }
    }

    setEnviandoComentario(true);
    const { error } = await supabase.from('comentarios').insert({
      proyecto_id: proyectoSeleccionado.id,
      usuario_id: miId,
      contenido: nuevoComentario.trim()
    });
    if (!error) {
      setNuevoComentario('');
      fetchComentarios(proyectoSeleccionado.id);
    }
    setEnviandoComentario(false);
  };

  const enviarRespuesta = async (padreId) => {
    if (!proyectoSeleccionado?.id) {
      avisar('Error: proyecto no seleccionado.', 'error');
      return;
    }
    if (!textoRespuesta.trim()) {
      avisar('Escribe tu respuesta antes de enviar.', 'info');
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

    const { error } = await supabase.from('comentarios').insert([{
      proyecto_id: proyectoSeleccionado.id,
      usuario_id: miId,
      contenido: textoRespuesta.trim(),
      parent_id: padreId
    }]);

    if (error) {
      avisar('Error al responder: ' + error.message, 'error');
      return;
    }

    await fetchComentarios(proyectoSeleccionado.id);
    setTextoRespuesta('');
    setRespondiendoA(null);
  };

  const borrarComentario = (comentarioId) => {
    pedirConfirmacion('¿Estás seguro de que quieres eliminar este comentario?', async () => {
      const { error } = await supabase.from('comentarios').delete().eq('id', comentarioId);
      if (error) {
        avisar('Error al borrar: ' + error.message, 'error');
        return;
      }
      setComentarios(prev => prev.filter(c => c.id !== comentarioId));
    }, 'Eliminar comentario');
  };

  const actualizarComentario = async (comentarioId, contenido) => {
    const textoParaValidar = contenido.trim();
    if (!textoParaValidar) {
      avisar('El contenido no puede estar vacío.', 'info');
      return;
    }
    if (textoParaValidar.length > 100) {
      avisar('El comentario es demasiado largo (máximo 100 caracteres).', 'info');
      return;
    }

    if (!(puedeVerExplicito && proyectoSeleccionado?.es_nsfw === true)) {
      const resultadoModeracion = await moderador.validarTexto(textoParaValidar);
      if (!resultadoModeracion.seguro) {
        avisar(resultadoModeracion.razon || 'Contenido inapropiado.', 'error', 'Comentario bloqueado');
        return;
      }
    }

    const { error } = await supabase
      .from('comentarios')
      .update({ contenido: textoParaValidar })
      .eq('id', comentarioId);

    if (error) {
      avisar('Error al actualizar comentario: ' + error.message, 'error');
      return;
    }

    setComentarios(prev =>
      prev.map(c => c.id === comentarioId ? { ...c, contenido: textoParaValidar } : c)
    );
    setComentarioEditandoId(null);
    setComentarioEditandoTexto('');
  };

  const manejarLike = async (e, proyectoId, yaTieneLike) => {
    e.stopPropagation();
    if (!miId) return;
    setObras(prev => prev.map(p => p.id === proyectoId ?
      { ...p, miLike: !yaTieneLike, totalLikes: yaTieneLike ? Number(p.totalLikes) - 1 : Number(p.totalLikes) + 1 } : p
    ));
    if (yaTieneLike) await supabase.from('likes').delete().match({ usuario_id: miId, proyecto_id: proyectoId });
    else await supabase.from('likes').insert({ usuario_id: miId, proyecto_id: proyectoId });
  };

  const obtenerFondoHeader = () => {
    if (perfil?.imagen_fondo_url) return `url(${perfil.imagen_fondo_url}) center/cover no-repeat`;
    return perfil?.color_principal || perfil?.color_fondo_web || undefined;
  };

  if (cargando) return <div className="dash-pantalla"><p className="dash-cargando">Cargando perfil...</p></div>;

  const cabeceraClara = !perfil?.imagen_fondo_url && esFondoClaro(perfil?.color_fondo_web);

  return (
    <section className="dash-pantalla">
      <div className="dash-barra">
        <button type="button" className="btn btn-ghost" onClick={() => navigate('/galeria')}>
          <ArrowLeft size={18} /> Explorar
        </button>
        <div className="fila">
          {miId && String(miId) !== String(idUsuario) && (
            <>
              <button
                type="button"
                className={`btn ${siguiendo ? 'btn-ghost' : 'btn-primario'}`}
                onClick={alternarSeguir}
              >
                {siguiendo ? <UserMinus size={17} /> : <UserPlus size={17} />}
                {siguiendo ? 'Dejar de seguir' : 'Seguir'}
              </button>
              <button
                type="button"
                className="btn-icono"
                title="Reportar perfil"
                onClick={() => setReporte({ tipo: 'perfil', objetivoId: idUsuario, tituloObjetivo: perfil?.nombre_completo || 'Este perfil' })}
              >
                <Flag size={16} />
              </button>
            </>
          )}
          <button
            type="button"
            className="btn btn-secundario"
            onClick={() => navigate(puedeVerExplicito ? '/dashboard-adulto' : '/dashboard')}
          >
            <User size={18} /> Mi perfil
          </button>
        </div>
      </div>

      <div className="dash-cabecera" style={obtenerFondoHeader() ? { background: obtenerFondoHeader() } : undefined}>
        {perfil?.avatar_url ? (
          <img className="dash-avatar" src={perfil.avatar_url} alt="Foto de perfil" />
        ) : (
          <div className="dash-avatar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <User size={54} color="var(--texto-3)" />
          </div>
        )}
        <h1 className={`dash-nombre${cabeceraClara ? ' claro' : ''}`} style={perfil?.color_letra_nombre ? { color: perfil.color_letra_nombre } : undefined}>
          {perfil?.nombre_completo}
        </h1>
        <p className={`dash-bio${cabeceraClara ? ' clara' : ''}`} style={perfil?.color_letra_bio ? { color: perfil.color_letra_bio } : undefined}>
          {perfil?.biografia || 'Sin biografía disponible'}
        </p>
        <div className="fila centrado-fila">
          <span className="badge"><User size={13} /> {nSeguidores} seguidor{nSeguidores === 1 ? '' : 'es'}</span>
          {perfil?.disponible_trabajo && (
            <span className="badge marca">Disponible para trabajar{perfil?.area_trabajo ? ` · ${perfil.area_trabajo}` : ''}</span>
          )}
        </div>
        {perfil?.disponible_trabajo && perfil?.contacto_trabajo && (
          <p className="texto-2 sin-margen mt-3">Contacto: {perfil.contacto_trabajo}</p>
        )}
      </div>

      <h2 className="dash-titulo-seccion">Portafolio de {perfil?.nombre_completo}</h2>
      <div className="dash-grid">
        {obras.length > 0 ? (
          obras.map((obra) => (
            <div key={obra.id} className="dash-tarjeta" onClick={() => abrirProyecto(obra)}>
              {obra.tipo_archivo === 'video' ? (
                <video src={obra.archivo_url} className="dash-tarjeta-media" muted playsInline preload="metadata" />
              ) : (
                <img src={obra.archivo_url} alt={obra.titulo} className="dash-tarjeta-media" />
              )}
              <div className="dash-tarjeta-info">
                <div className="dash-tarjeta-cabecera">
                  <h3 className="dash-tarjeta-titulo">{obra.titulo}</h3>
                  <div className="dash-stats">
                    <button
                      type="button"
                      onClick={(e) => manejarLike(e, obra.id, obra.miLike)}
                      className={`dash-stat ${obra.miLike ? 'activo' : ''}`}
                      title={obra.miLike ? 'Quitar like' : 'Dar like'}
                    >
                      <Heart size={14} fill={obra.miLike ? 'currentColor' : 'none'} /> {obra.totalLikes}
                    </button>
                    <span className="dash-stat" title="Comentarios">
                      <MessageCircle size={14} /> {obra.comentarios?.[0]?.count || 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="dash-vacio">
            <Inbox size={34} />
            <span>Este usuario aún no ha publicado obras.</span>
          </div>
        )}
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

              {proyectoSeleccionado.descripcion && (
                <p className="modal-obra-descripcion">{proyectoSeleccionado.descripcion}</p>
              )}
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
                    currentUserId={miId}
                    comentarioEditandoId={comentarioEditandoId}
                    comentarioEditandoTexto={comentarioEditandoTexto}
                    setComentarioEditandoId={setComentarioEditandoId}
                    setComentarioEditandoTexto={setComentarioEditandoTexto}
                    actualizarComentario={actualizarComentario}
                    esMiPublicacion={String(miId) === String(idUsuario)}
                    alReportar={(c) => setReporte({ tipo: 'comentario', objetivoId: c.id, tituloObjetivo: `Comentario: "${(c.contenido || '').slice(0, 60)}"` })}
                  />
                ))}
              </div>

              <form onSubmit={enviarComentario} className="form-comentario">
                <input
                  className="campo"
                  value={nuevoComentario}
                  onChange={(e) => setNuevoComentario(e.target.value)}
                  placeholder="Añadir comentario..."
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

export default PerfilPublico;
