import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { validarPerfil, validarProyecto } from './validaciones';
import { moderador } from './moderacion';
import '../estilos/perfil.css';
import {
  TEMAS_PERFIL,
  TEMA_POR_DEFECTO_ID,
  buscarTemaPerfil,
  detectarTemaPerfil,
  esFondoClaro,
} from './temasPerfil';
import {
  Menu,
  User,
  X,
  Image as ImageIcon,
  Activity,
  LogOut,
  Heart,
  MessageCircle,
  Trash2,
  Pencil,
  Save,
  Send,
  Palette,
  Settings,
  ImagePlus,
  Inbox,
  RotateCcw,
  Trophy,
  ShieldAlert,
  Eye,
  Flag,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import AlertModal from './AlertModal';

const STORAGE_KEY_NOTIF_LEIDAS = 'pocketwork_notificaciones_leidas';
const PLANTILLAS_DISPONIBLES = Array.from({ length: 50 }, (_, index) => `/imagenes/plantillas/textura${index + 1}.png`);

// Comentario con soporte de respuestas anidadas (se renderiza a sí mismo).
// En el Dashboard siempre se ven publicaciones propias, por eso
// esMiPublicacion vale true por defecto (el dueño modera su post).
const ComentarioIndividual = ({
  comentario,
  todosLosComentarios,
  alResponder,
  alBorrar,
  respondiendoA,
  enviarRespuesta,
  textoRespuesta,
  setTextoRespuesta,
  currentUserId,
  comentarioEditandoId,
  comentarioEditandoTexto,
  setComentarioEditandoId,
  setComentarioEditandoTexto,
  actualizarComentario,
  esMiPublicacion = true,
  alReportar = null,
}) => {
  const navigate = useNavigate();
  const hijos = todosLosComentarios.filter((h) => String(h.parent_id) === String(comentario.id));
  const esPropio = String(comentario.usuario_id) === String(currentUserId);
  const estaEditando = String(comentarioEditandoId) === String(comentario.id);
  const puedeBorrar = esPropio || esMiPublicacion;

  const irAPerfil = () => {
    if (!esPropio && comentario.usuario_id) {
      navigate(`/perfil/${comentario.usuario_id}`);
    }
  };

  return (
    <div className={comentario.parent_id ? 'comentario anidado' : 'comentario'}>
      <img
        src={comentario.perfiles?.avatar_url || 'https://via.placeholder.com/40?text=U'}
        className={`avatar avatar-sm ${esPropio ? '' : 'cursor-pointer'}`}
        alt=""
        onClick={esPropio ? undefined : irAPerfil}
      />

      <div className="comentario-cuerpo">
        <button
          type="button"
          className={`comentario-autor ${esPropio ? 'propio' : ''}`}
          onClick={esPropio ? undefined : irAPerfil}
        >
          {comentario.perfiles?.nombre_completo}
        </button>

        {estaEditando ? (
          <div className="fila-respuesta sin-margen-izq">
            <input
              value={comentarioEditandoTexto}
              onChange={(e) => setComentarioEditandoTexto(e.target.value)}
              className="campo"
            />
            <button
              type="button"
              onClick={() => actualizarComentario(comentario.id, comentarioEditandoTexto)}
              className="accion exito"
              title="Guardar"
            >
              <Save size={15} />
            </button>
            <button
              type="button"
              onClick={() => {
                setComentarioEditandoId(null);
                setComentarioEditandoTexto('');
              }}
              className="accion peligro"
              title="Cancelar"
            >
              <X size={15} />
            </button>
          </div>
        ) : (
          <>
            <p className="comentario-texto">{comentario.contenido}</p>
            <div className="comentario-acciones">
              <button
                type="button"
                onClick={() => alResponder(comentario.id)}
                className="accion"
              >
                Responder
              </button>
              {alReportar && !esPropio && !esMiPublicacion && (
                <button
                  type="button"
                  onClick={() => alReportar(comentario)}
                  className="accion"
                  title="Reportar comentario"
                >
                  <Flag size={13} />
                </button>
              )}
              {esPropio && (
                <button
                  type="button"
                  onClick={() => {
                    setComentarioEditandoId(comentario.id);
                    setComentarioEditandoTexto(comentario.contenido);
                  }}
                  className="accion"
                  title="Editar comentario"
                >
                  <Pencil size={13} />
                </button>
              )}
            </div>
          </>
        )}

        {respondiendoA === comentario.id && (
          <div className="fila-respuesta">
            <input
              type="text"
              placeholder="Escribe tu respuesta..."
              className="campo"
              value={textoRespuesta}
              onChange={(e) => setTextoRespuesta(e.target.value)}
              autoFocus
            />
            <button
              type="button"
              onClick={() => enviarRespuesta(comentario.id)}
              className="btn-enviar-comentario chico"
              title="Enviar respuesta"
            >
              <Send size={15} />
            </button>
          </div>
        )}

        {hijos.map((hijo) => (
          <ComentarioIndividual
            key={hijo.id}
            comentario={hijo}
            todosLosComentarios={todosLosComentarios}
            alResponder={alResponder}
            alBorrar={alBorrar}
            respondiendoA={respondiendoA}
            enviarRespuesta={enviarRespuesta}
            textoRespuesta={textoRespuesta}
            setTextoRespuesta={setTextoRespuesta}
            currentUserId={currentUserId}
            comentarioEditandoId={comentarioEditandoId}
            comentarioEditandoTexto={comentarioEditandoTexto}
            setComentarioEditandoId={setComentarioEditandoId}
            setComentarioEditandoTexto={setComentarioEditandoTexto}
            actualizarComentario={actualizarComentario}
            esMiPublicacion={esMiPublicacion}
            alReportar={alReportar}
          />
        ))}
      </div>

      {puedeBorrar && (
        <button
          type="button"
          onClick={() => alBorrar(comentario.id)}
          className="accion peligro"
          title="Eliminar comentario"
        >
          <Trash2 size={15} />
        </button>
      )}
    </div>
  );
};
const Dashboard = () => {
  const [usuario, setUsuario] = useState(null);
  const navigate = useNavigate();

  const [perfil, setPerfil] = useState({
    nombre: 'Cargando...',
    bio: 'Artista',
    colorPrincipal: '#f07e11',
    colorFondoWeb: '#0b0b0d',
    colorLetraNombre: '#ffffff',
    colorLetraBio: '#e6e6ec',
    avatarUrl: null,
    imagenFondoUrl: null,
    disponible: false,
    area: '',
    contacto: '',
    esAdmin: false,
  });
  const perfilTextoGuardadoRef = useRef({
    nombre: 'Cargando...',
    bio: 'Artista',
    area: '',
    contacto: '',
  });
  const [plantillaEnVistaPrevia, setPlantillaEnVistaPrevia] = useState(null);
  const carruselPlantillasRef = useRef(null);

  const [obras, setObras] = useState([]);
  const [nuevaObra, setNuevaObra] = useState({ titulo: '', descripcion: '', imagenUrl: '' });
  const [cargando, setCargando] = useState(true);

  // Comentarios
  const [proyectoSeleccionado, setProyectoSeleccionado] = useState(null);
  const [comentarios, setComentarios] = useState([]);
  const [nuevoComentario, setNuevoComentario] = useState('');
  const [enviandoComentario, setEnviandoComentario] = useState(false);
  const [respondiendoA, setRespondiendoA] = useState(null);
  const [textoRespuesta, setTextoRespuesta] = useState('');
  const [comentarioEditandoId, setComentarioEditandoId] = useState(null);
  const [comentarioEditandoTexto, setComentarioEditandoTexto] = useState('');

  // Notificaciones
  const [notificaciones, setNotificaciones] = useState([]);
  const [contadorNotificaciones, setContadorNotificaciones] = useState(0);
  const [notificacionesLeidasCount, setNotificacionesLeidasCount] = useState(0);

  // Mis números (estadísticas del artista)
  const [misNumeros, setMisNumeros] = useState({ vistas: 0, likes: 0, comentarios: 0, top: [] });

  // UI
  const [editandoTitulo, setEditandoTitulo] = useState(false);
  const [tituloEditando, setTituloEditando] = useState('');
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [mostrarModalSalir, setMostrarModalSalir] = useState(false);
  const [alerta, setAlerta] = useState({
    visible: false,
    mensaje: '',
    tipo: 'info',
    titulo: '',
    onConfirm: null,
  });

  // Reemplaza a window.alert con el modal del sistema.
  const avisar = (mensaje, tipo = 'info', titulo) =>
    setAlerta({ visible: true, mensaje, tipo, titulo, onConfirm: null });

  // Reemplaza a window.confirm con el modal del sistema.
  const pedirConfirmacion = (mensaje, onConfirm, titulo = 'Confirmación') =>
    setAlerta({ visible: true, mensaje, tipo: 'confirm', titulo, onConfirm });

  useEffect(() => {
    const almacenadas = localStorage.getItem(STORAGE_KEY_NOTIF_LEIDAS);
    const parsed = Number(almacenadas);
    if (Number.isFinite(parsed) && parsed >= 0) {
      setNotificacionesLeidasCount(parsed);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_NOTIF_LEIDAS, String(notificacionesLeidasCount));
  }, [notificacionesLeidasCount]);

  useEffect(() => {
    const leidas = Number(localStorage.getItem(STORAGE_KEY_NOTIF_LEIDAS)) || 0;
    const nuevos = Math.max(0, notificaciones.length - leidas);
    setContadorNotificaciones(nuevos);
  }, [notificaciones, notificacionesLeidasCount]);

  const actualizarContador = (totalNotificaciones) => {
    const leidas = Number(localStorage.getItem(STORAGE_KEY_NOTIF_LEIDAS)) || 0;
    setContadorNotificaciones(Math.max(0, totalNotificaciones - leidas));
  };

  useEffect(() => {
    const inicializar = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUsuario(user);
        await cargarPerfil(user.id);
      }
      setCargando(false);
    };
    inicializar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (usuario) cargarObrasConStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario]);

  useEffect(() => {
    if (obras.length > 0) cargarNumeros();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obras]);

  const cargarNumeros = async () => {
    const ids = obras.map((o) => o.id);
    const { data: v } = await supabase.from('vistas').select('proyecto_id').in('proyecto_id', ids);
    const porObra = {};
    (v || []).forEach((r) => {
      porObra[r.proyecto_id] = (porObra[r.proyecto_id] || 0) + 1;
    });
    const likes = obras.reduce((a, o) => a + Number(o.totalLikes || 0), 0);
    const comentarios = obras.reduce((a, o) => a + Number(o.comentarios?.[0]?.count || 0), 0);
    const top = [...obras]
      .sort((a, b) => (porObra[b.id] || 0) - (porObra[a.id] || 0))
      .slice(0, 3)
      .map((o) => ({ id: o.id, titulo: o.titulo, vistas: porObra[o.id] || 0 }));
    setMisNumeros({ vistas: (v || []).length, likes, comentarios, top });
  };

  const registrarVista = (proyectoId) => {
    if (!proyectoId) return;
    supabase.from('vistas').insert({ proyecto_id: proyectoId, usuario_id: usuario?.id || null })
      .then(() => {}, () => {});
  };

  const cargarObrasConStats = async () => {
    const { data, error } = await supabase
      .from('proyectos')
      .select(`*, likes (usuario_id), comentarios (count)`)
      .eq('usuario_id', usuario.id)
      .order('creado_el', { ascending: false });

    if (error) console.error('Error cargando estadísticas:', error.message);
    if (data) {
      const procesadas = data.map((o) => ({
        ...o,
        totalLikes: Number(o.likes?.length) || 0,
        miLike: o.likes?.some((l) => l.usuario_id === usuario.id) || false,
      }));
      setObras(procesadas);
    }
  };

  const formatearNotificacion = (comentario) => {
    const obra = obras.find((o) => o.id === comentario.proyecto_id);
    const nombreObra = obra ? obra.titulo : 'tu publicación';
    const nombreAutor = comentario.perfiles?.nombre_completo || 'Alguien';
    return {
      id: comentario.id,
      texto: `${nombreAutor} comentó en ${nombreObra}: "${comentario.contenido}"`,
      fecha: comentario.creado_el,
      proyecto_id: comentario.proyecto_id,
    };
  };

  const cargarNotificaciones = async () => {
    if (!usuario || obras.length === 0) return [];

    const proyectosIds = obras.map((o) => o.id);
    const { data, error } = await supabase
      .from('comentarios')
      .select(`id, proyecto_id, usuario_id, creado_el, contenido, perfiles(nombre_completo)`)
      .in('proyecto_id', proyectosIds)
      .neq('usuario_id', usuario.id);

    if (!error && data) {
      const formateadas = data.map(formatearNotificacion);
      setNotificaciones(formateadas);
      actualizarContador(formateadas.length);
      return formateadas;
    }

    return [];
  };

  useEffect(() => {
    if (usuario && obras.length > 0) cargarNotificaciones();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obras, usuario]);

  useEffect(() => {
    const intervalo = setInterval(() => {
      cargarNotificaciones();
    }, 20000);
    return () => clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obras, usuario]);

  const manejarIrNotificaciones = async () => {
    const listaActual = await cargarNotificaciones();
    const total = Array.isArray(listaActual) ? listaActual.length : notificaciones.length;

    setContadorNotificaciones(0);
    setNotificacionesLeidasCount(total);
    localStorage.setItem(STORAGE_KEY_NOTIF_LEIDAS, String(total));
    setNotificaciones(listaActual);

    navigate('/notificaciones', { state: { notificaciones: listaActual } });
  };

  const manejarLike = async (e, proyectoId, yaTieneLike) => {
    e.stopPropagation();
    setObras((prev) =>
      prev.map((p) =>
        p.id === proyectoId
          ? {
              ...p,
              miLike: !yaTieneLike,
              totalLikes: yaTieneLike ? Number(p.totalLikes) - 1 : Number(p.totalLikes) + 1,
            }
          : p
      )
    );
    if (yaTieneLike) {
      await supabase.from('likes').delete().match({ usuario_id: usuario.id, proyecto_id: proyectoId });
    } else {
      await supabase.from('likes').insert({ usuario_id: usuario.id, proyecto_id: proyectoId });
    }
  };

  const abrirProyecto = (proyecto) => {
    setProyectoSeleccionado(proyecto);
    registrarVista(proyecto.id);
    setTituloEditando(proyecto.titulo || '');
    setEditandoTitulo(false);
    setComentarioEditandoId(null);
    setComentarioEditandoTexto('');
    fetchComentarios(proyecto.id);
  };

  const fetchComentarios = async (proyectoId) => {
    const { data, error } = await supabase
      .from('comentarios')
      .select(`id, contenido, creado_el, usuario_id, parent_id, perfiles ( id, nombre_completo, avatar_url )`)
      .eq('proyecto_id', proyectoId)
      .order('creado_el', { ascending: true });

    if (error) console.error('Error:', error.message);
    else setComentarios(data || []);
  };

  const enviarComentario = async (e) => {
    e.preventDefault();
    if (!nuevoComentario.trim() || !usuario || !proyectoSeleccionado?.id) return;

    if (nuevoComentario.trim().length > 100) {
      avisar('El comentario es demasiado largo (máximo 100 caracteres).', 'info');
      return;
    }

    const resultadoModeracion = await moderador.validarTexto(nuevoComentario.trim());
    if (!resultadoModeracion.seguro) {
      avisar(resultadoModeracion.razon || 'Contenido inapropiado.', 'error', 'Comentario bloqueado');
      return;
    }

    setEnviandoComentario(true);
    const { error } = await supabase.from('comentarios').insert({
      proyecto_id: proyectoSeleccionado.id,
      usuario_id: usuario.id,
      contenido: nuevoComentario.trim(),
    });

    if (!error) {
      setNuevoComentario('');
      await fetchComentarios(proyectoSeleccionado.id);
      cargarObrasConStats();
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
      avisar('El comentario es demasiado largo (máximo 100 caracteres).', 'info');
      return;
    }

    const resultadoModeracion = await moderador.validarTexto(textoRespuesta.trim());
    if (!resultadoModeracion.seguro) {
      avisar('Contiene contenido inapropiado.', 'error', 'Respuesta bloqueada');
      return;
    }

    const { error } = await supabase.from('comentarios').insert([
      {
        proyecto_id: proyectoSeleccionado.id,
        usuario_id: usuario.id,
        contenido: textoRespuesta.trim(),
        parent_id: padreId,
      },
    ]);

    if (error) {
      console.error('Error de Supabase:', error.message);
      avisar('Error al responder: ' + error.message, 'error');
      return;
    }

    await fetchComentarios(proyectoSeleccionado.id);
    setTextoRespuesta('');
    setRespondiendoA(null);
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

    const textoParaValidar = contenido.trim();
    const resultadoModeracion = await moderador.validarTexto(textoParaValidar);

    if (!resultadoModeracion.seguro) {
      avisar(resultadoModeracion.razon || 'Contenido inapropiado.', 'error', 'Comentario bloqueado');
      return;
    }

    const { error } = await supabase
      .from('comentarios')
      .update({ contenido: textoParaValidar })
      .eq('id', comentarioId)
      .eq('usuario_id', usuario?.id);

    if (error) {
      avisar('Error al actualizar comentario: ' + error.message, 'error');
      return;
    }

    setComentarios((prev) =>
      prev.map((c) => (c.id === comentarioId ? { ...c, contenido: textoParaValidar } : c))
    );
    setComentarioEditandoId(null);
    setComentarioEditandoTexto('');
    if (proyectoSeleccionado?.id) await fetchComentarios(proyectoSeleccionado.id);
    await cargarObrasConStats();
  };

  const actualizarTituloProyecto = async () => {
    if (!proyectoSeleccionado) return;

    const tituloParaValidar = tituloEditando.trim();

    if (!tituloParaValidar) {
      avisar('El título no puede estar vacío.', 'info');
      return;
    }
    if (tituloParaValidar.length > 20) {
      avisar('El título es demasiado largo (máximo 20 caracteres).', 'info');
      return;
    }

    const resultadoModeracion = await moderador.validarTexto(tituloParaValidar);
    if (!resultadoModeracion.seguro) {
      avisar(resultadoModeracion.razon || 'Contenido inapropiado.', 'error', 'Título bloqueado');
      return;
    }

    const { error } = await supabase
      .from('proyectos')
      .update({ titulo: tituloParaValidar })
      .eq('id', proyectoSeleccionado.id);

    if (error) {
      avisar('Error al actualizar el título: ' + error.message, 'error');
      return;
    }

    const { data: verifico, error: errorVerifico } = await supabase
      .from('proyectos')
      .select('titulo')
      .eq('id', proyectoSeleccionado.id)
      .single();

    if (errorVerifico || !verifico || verifico.titulo !== tituloParaValidar) {
      avisar('No se pudo validar el título en la base de datos.', 'error');
      return;
    }

    setProyectoSeleccionado((prev) => ({ ...prev, titulo: tituloParaValidar }));
    setObras((prev) =>
      prev.map((o) => (o.id === proyectoSeleccionado.id ? { ...o, titulo: tituloParaValidar } : o))
    );
    setEditandoTitulo(false);
    await cargarObrasConStats();
    avisar('Título actualizado.', 'exito');
  };

  const cargarPerfil = async (userId) => {
    const { data, error } = await supabase.from('perfiles').select('*').eq('id', userId).single();

    if (error) return;

    if (data) {
      const perfilCargado = {
        nombre: data.nombre_completo || '',
        bio: data.biografia || '',
        colorPrincipal: data.color_principal || '#f07e11',
        colorFondoWeb: data.color_fondo_web || '#0b0b0d',
        colorLetraNombre: data.color_letra_nombre || '#ffffff',
        colorLetraBio: data.color_letra_bio || '#e6e6ec',
        avatarUrl: data.avatar_url,
        imagenFondoUrl: data.imagen_fondo_url,
        disponible: !!data.disponible_trabajo,
        area: data.area_trabajo || '',
        contacto: data.contacto_trabajo || '',
        esAdmin: data.tipo_cuenta === 'admin',
      };
      setPerfil(perfilCargado);
      perfilTextoGuardadoRef.current = {
        nombre: perfilCargado.nombre,
        bio: perfilCargado.bio,
        area: perfilCargado.area,
        contacto: perfilCargado.contacto,
      };
    }
  };

  const borrarComentario = (comentarioId) => {
    pedirConfirmacion('¿Seguro que quieres eliminar este comentario?', async () => {
      const { error } = await supabase.from('comentarios').delete().eq('id', comentarioId);

      if (error) {
        avisar('Error al borrar: ' + error.message, 'error');
        return;
      }

      setComentarios((prev) => prev.filter((c) => c.id !== comentarioId));
      cargarObrasConStats();
    });
  };

  const guardarCambiosPerfil = async () => {
    const resultado = validarPerfil(perfil);

    if (!resultado.valido) {
      avisar(Object.values(resultado.errores)[0], 'info');
      return;
    }

    if (!usuario) {
      avisar('Espera a que cargue tu sesión...', 'info');
      return;
    }

    const camposTexto = [
      { clave: 'nombre', etiqueta: 'Nombre' },
      { clave: 'bio', etiqueta: 'Biografía' },
      { clave: 'area', etiqueta: 'Área de trabajo' },
      { clave: 'contacto', etiqueta: 'Contacto' },
    ];
    const camposRechazados = [];

    for (const campo of camposTexto) {
      const moderacion = await moderador.validarTexto(perfil[campo.clave] || '');
      if (!moderacion.seguro) camposRechazados.push(campo);
    }

    if (camposRechazados.length > 0) {
      const valoresGuardados = perfilTextoGuardadoRef.current;
      setPerfil((actual) => ({
        ...actual,
        ...Object.fromEntries(
          camposRechazados.map(({ clave }) => [clave, valoresGuardados[clave]])
        ),
      }));
      avisar(
        `Contenido inapropiado en: ${camposRechazados.map(({ etiqueta }) => etiqueta).join(', ')}. Se restauraron los valores guardados.`,
        'error'
      );
      return;
    }

    setCargando(true);

    const datosParaDB = {
      id: usuario.id,
      nombre_completo: perfil.nombre,
      biografia: perfil.bio,
      color_principal: perfil.colorPrincipal,
      color_fondo_web: perfil.colorFondoWeb,
      color_letra_nombre: perfil.colorLetraNombre,
      color_letra_bio: perfil.colorLetraBio,
      avatar_url: perfil.avatarUrl,
      imagen_fondo_url: perfil.imagenFondoUrl,
      disponible_trabajo: perfil.disponible,
      area_trabajo: perfil.area.trim() || null,
      contacto_trabajo: perfil.contacto.trim() || null,
    };

    const { error: errorPerfil } = await supabase
      .from('perfiles')
      .upsert(datosParaDB, { onConflict: 'id' });

    if (errorPerfil) {
      console.error('Error guardando perfil:', errorPerfil);
      if (errorPerfil.code === '23505') {
        avisar('Este nombre de usuario ya está en uso. Elige otro.', 'error');
      } else {
        avisar('Error guardando perfil: ' + errorPerfil.message, 'error');
      }
    } else {
      perfilTextoGuardadoRef.current = {
        nombre: perfil.nombre,
        bio: perfil.bio,
        area: perfil.area,
        contacto: perfil.contacto,
      };
      avisar('¡Información actualizada!', 'exito');
    }

    setCargando(false);
  };

  const prepararArchivoProyecto = async (event) => {
    const archivo = event.target.files[0];
    if (!archivo) return;

    const tiposPermitidos = ['image', 'video', 'audio'];
    const esValido = tiposPermitidos.some((tipo) => archivo.type.startsWith(tipo));

    if (!esValido) {
      avisar('Archivo no permitido. Solo puedes subir imágenes, videos o audios.', 'error');
      event.target.value = '';
      return;
    }

    const limiteMB = 50;
    if (archivo.size > limiteMB * 1024 * 1024) {
      avisar(`El archivo es demasiado grande. El límite son ${limiteMB} MB.`, 'error');
      event.target.value = '';
      return;
    }

    setCargando(true);
    const nombreArchivo = `${Date.now()}-${archivo.name}`;

    try {
      const { error: uploadError } = await supabase.storage.from('Proyectos').upload(nombreArchivo, archivo);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('Proyectos').getPublicUrl(nombreArchivo);

      if (archivo.type.startsWith('image') || archivo.type.startsWith('video')) {
        const resultadoModeracion = await moderador.validarMedia(publicUrl, archivo.type);
        if (!resultadoModeracion.seguro) {
          avisar('Archivo bloqueado: contiene contenido inapropiado.', 'error');
          await supabase.storage.from('Proyectos').remove([nombreArchivo]);
          event.target.value = '';
          return;
        }
      }

      setNuevaObra((prev) => ({ ...prev, imagenUrl: publicUrl }));
      avisar('Archivo cargado. Ahora ponle un título y publica.', 'exito');
    } catch (err) {
      avisar('Error al subir el archivo: ' + err.message, 'error');
      console.error(err);
    } finally {
      setCargando(false);
      event.target.value = '';
    }
  };

  const publicarProyecto = async () => {
    const check = validarProyecto(nuevaObra);

    if (!check.valido) {
      avisar(Object.values(check.errores)[0], 'info');
      return;
    }

    const moderacionTitulo = await moderador.validarTexto(nuevaObra.titulo || '');
    if (!moderacionTitulo.seguro) {
      avisar('Título bloqueado: contenido inapropiado detectado.', 'error');
      return;
    }

    const moderacionDescripcion = await moderador.validarTexto(nuevaObra.descripcion || '');
    if (!moderacionDescripcion.seguro) {
      avisar('Descripción bloqueada: contenido inapropiado detectado.', 'error');
      return;
    }

    const resultadoModeracionMedia = await moderador.validarMedia(nuevaObra.imagenUrl, '');
    if (!resultadoModeracionMedia.seguro) {
      avisar('Proyecto bloqueado: el archivo contiene contenido inapropiado.', 'error');
      return;
    }

    setCargando(true);

    let tipoDetectado = 'imagen';
    const urlLower = nuevaObra.imagenUrl.toLowerCase();

    if (urlLower.match(/\.(mp4|webm|ogg|mov)$/i)) tipoDetectado = 'video';
    else if (urlLower.match(/\.(mp3|wav|flac|aac)$/i)) tipoDetectado = 'audio';

    try {
      const { error } = await supabase.from('proyectos').insert([
        {
          usuario_id: usuario.id,
          titulo: nuevaObra.titulo,
          archivo_url: nuevaObra.imagenUrl,
          tipo_archivo: tipoDetectado,
        },
      ]);

      if (error) throw error;

      avisar(`¡Proyecto (${tipoDetectado}) publicado con éxito!`, 'exito');
      setNuevaObra({ titulo: '', descripcion: '', imagenUrl: '' });
      cargarObrasConStats();
    } catch (err) {
      avisar('Error al publicar: ' + err.message, 'error');
    } finally {
      setCargando(false);
    }
  };

  const borrarProyecto = (id) => {
    pedirConfirmacion('¿Eliminar este proyecto? Esta acción no se puede deshacer.', async () => {
      const { error } = await supabase.from('proyectos').delete().eq('id', id);
      if (error) avisar('Error: ' + error.message, 'error');
      else setObras((prev) => prev.filter((o) => o.id !== id));
    });
  };

  const subirImagen = async (event, nombreBucket, columnaDB, campoEstado) => {
    const archivo = event.target.files[0];
    if (!archivo) return;

    if (!archivo.type.startsWith('image/')) {
      avisar('Solo se permiten archivos de imagen (jpg, png, gif, etc.).', 'error');
      event.target.value = '';
      return;
    }

    setCargando(true);
    const nombreArchivo = `${Date.now()}-${archivo.name}`;
    const { error: uploadError } = await supabase.storage.from(nombreBucket).upload(nombreArchivo, archivo);

    if (uploadError) {
      avisar('Error: ' + uploadError.message, 'error');
      setCargando(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from(nombreBucket).getPublicUrl(nombreArchivo);

    try {
      const resultadoModeracion = await moderador.validarMedia(publicUrl);
      if (!resultadoModeracion.seguro) {
        avisar('Imagen bloqueada: contiene contenido inapropiado.', 'error');
        await supabase.storage.from(nombreBucket).remove([nombreArchivo]);
        event.target.value = '';
        return;
      }
    } catch (err) {
      avisar('Error al moderar la imagen. Intenta de nuevo.', 'error');
      await supabase.storage.from(nombreBucket).remove([nombreArchivo]);
      event.target.value = '';
      return;
    } finally {
      setCargando(false);
    }

    // Solo vista previa: se guarda en la base de datos al pulsar "Guardar cambios".
    setPerfil((prev) => ({ ...prev, [campoEstado]: publicUrl }));
    avisar('Vista previa lista. Pulsa "Guardar cambios" para aplicarla.', 'exito');
  };

  const manejarCerrarSesion = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const obtenerFondoHeader = () => {
    if (perfil.imagenFondoUrl) return `url(${perfil.imagenFondoUrl}) center/cover no-repeat`;
    return perfil.colorFondoWeb || perfil.colorPrincipal;
  };

  // Tema activo según los 4 colores (null = combinación personalizada).
  const temaActivoId = detectarTemaPerfil(perfil);

  // Cabecera clara (ej. tema Arena sin banner): píldora clara para la bio.
  const cabeceraClara = !perfil.imagenFondoUrl && esFondoClaro(perfil.colorFondoWeb);

  // Aplica un tema predefinido (contraste garantizado) a la vista previa.
  const aplicarTema = (temaId) => {
    const tema = buscarTemaPerfil(temaId);
    if (!tema) return;
    setPerfil((prev) => ({
      ...prev,
      colorPrincipal: tema.colorPrincipal,
      colorFondoWeb: tema.colorFondoWeb,
      colorLetraNombre: tema.colorLetraNombre,
      colorLetraBio: tema.colorLetraBio,
    }));
  };

  const quitarBanner = () =>
    setPerfil((prev) => ({ ...prev, imagenFondoUrl: null }));

  // Vuelve al tema de marca sin tocar nombre, bio ni avatar.
  const restablecerTema = () => {
    const tema = buscarTemaPerfil(TEMA_POR_DEFECTO_ID);
    setPerfil((prev) => ({
      ...prev,
      colorPrincipal: tema.colorPrincipal,
      colorFondoWeb: tema.colorFondoWeb,
      colorLetraNombre: tema.colorLetraNombre,
      colorLetraBio: tema.colorLetraBio,
      imagenFondoUrl: null,
    }));
  };

  if (cargando && !usuario) return <div className="dash-cargando">Cargando tu espacio...</div>;
return (
    <section className="dash-pantalla">
      {/* ---------- Barra superior ---------- */}
      <div className="dash-barra">
        <div className="pos-relativa">
          <button
            type="button"
            className="btn btn-secundario"
            onClick={() => setMenuAbierto(!menuAbierto)}
            aria-expanded={menuAbierto}
          >
            <span key={menuAbierto ? 'abierto' : 'cerrado'} className="icono-girar">
              {menuAbierto ? <X size={18} /> : <Menu size={18} />}
            </span>
            Menú
          </button>

          {menuAbierto && (
            <div className="dash-menu menu-caer">
              <button
                type="button"
                className="dash-menu-item"
                onClick={() => {
                  setMenuAbierto(false);
                  navigate('/galeria');
                }}
              >
                <ImageIcon size={18} /> Galería
              </button>

              <button
                type="button"
                className="dash-menu-item"
                onClick={() => {
                  setMenuAbierto(false);
                  navigate('/retos');
                }}
              >
                <Trophy size={18} /> Retos
              </button>

              {perfil.esAdmin && (
                <button
                  type="button"
                  className="dash-menu-item"
                  onClick={() => {
                    setMenuAbierto(false);
                    navigate('/admin');
                  }}
                >
                  <ShieldAlert size={18} /> Administración
                </button>
              )}

              <button
                type="button"
                className="dash-menu-item"
                onClick={() => {
                  setMenuAbierto(false);
                  manejarIrNotificaciones();
                }}
              >
                <Activity size={18} /> Ver actividad
                {contadorNotificaciones > 0 && (
                  <span className="badge marca ml-auto">
                    {contadorNotificaciones}
                  </span>
                )}
              </button>

              <hr className="dash-menu-sep" />

              <button
                type="button"
                className="dash-menu-item peligro"
                onClick={() => {
                  setMenuAbierto(false);
                  setMostrarModalSalir(true);
                }}
              >
                <LogOut size={18} /> Cerrar sesión
              </button>
            </div>
          )}
        </div>

        <button type="button" className="btn btn-ghost" onClick={() => navigate('/galeria')}>
          <ImageIcon size={18} /> Explorar galería
        </button>
      </div>

      {/* ---------- Cabecera personalizada ---------- */}
      <div className="dash-cabecera" style={{ background: obtenerFondoHeader() }}>
        {perfil.avatarUrl ? (
          <img
            className="dash-avatar"
            src={perfil.avatarUrl}
            alt="Foto de perfil"
            style={{ borderColor: perfil.colorPrincipal }}
          />
        ) : (
          <div
            className="dash-avatar"
            style={{
              borderColor: perfil.colorPrincipal,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <User size={54} color="var(--texto-3)" />
          </div>
        )}

        <h1 className={`dash-nombre${cabeceraClara ? ' claro' : ''}`} style={{ color: perfil.colorLetraNombre }}>
          {perfil.nombre}
        </h1>
        <p className={`dash-bio${cabeceraClara ? ' clara' : ''}`} style={{ color: perfil.colorLetraBio }}>
          {perfil.bio}
        </p>
      </div>

      {/* ---------- Personalización ---------- */}
      <div className="dash-panel">
        <h4 className="dash-panel-titulo">
          <Settings size={20} /> Personalizar mi espacio
        </h4>

        <div className="dash-fila">
          <div className="dash-grupo">
            <span className="dash-etiqueta">Foto de perfil</span>
            <label htmlFor="upload-avatar" className="btn btn-secundario cursor-pointer">
              <ImagePlus size={16} /> Elegir foto
            </label>
            <input
              id="upload-avatar"
              type="file"
              accept="image/*"
              onChange={(e) => subirImagen(e, 'Avatares', 'avatar_url', 'avatarUrl')}
              className="oculto"
            />
          </div>

          <div className="dash-grupo">
            <span className="dash-etiqueta">Nombre de usuario</span>
            <input
              type="text"
              maxLength={25}
              className="campo"
              placeholder="Nombre de usuario"
              value={perfil.nombre}
              onChange={(e) => setPerfil({ ...perfil, nombre: e.target.value })}
            />
          </div>

          <div className="dash-grupo">
            <span className="dash-etiqueta">Biografía</span>
            <textarea
              maxLength={150}
              className="campo"
              placeholder="Describe tu perfil..."
              value={perfil.bio}
              onChange={(e) => setPerfil({ ...perfil, bio: e.target.value })}
            />
          </div>
        </div>

        <div className="dash-fila">
          <div className="dash-grupo dash-grupo-ancho">
            <span className="dash-etiqueta">Tema de mi cabecera</span>
            <div className="dash-temas">
              {TEMAS_PERFIL.map((t) => {
                const activo = temaActivoId === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={`dash-tema ${activo ? 'seleccionado' : ''}`}
                    onClick={() => aplicarTema(t.id)}
                    title={t.nombre}
                    aria-pressed={activo}
                  >
                    <span className="dash-tema-muestras" aria-hidden="true">
                      <span style={{ background: t.colorFondoWeb }} />
                      <span style={{ background: t.colorPrincipal }} />
                    </span>
                    {t.nombre}
                  </button>
                );
              })}
            </div>
            {!temaActivoId && (
              <span className="badge">Acento personalizado</span>
            )}
          </div>

          <div className="dash-grupo-color">
            <span className="dash-etiqueta">Marco</span>
            <input
              type="color"
              value={perfil.colorPrincipal}
              className="dash-color"
              title="Ajusta solo el color de acento"
              onChange={(e) => setPerfil({ ...perfil, colorPrincipal: e.target.value })}
            />
          </div>

          <div className="dash-grupo">
            <span className="dash-etiqueta">Banner</span>
            <div className="fila">
              <label htmlFor="upload-fondo" className="btn btn-secundario cursor-pointer">
                <ImagePlus size={16} /> Elegir fondo
              </label>
              {perfil.imagenFondoUrl && (
                <button type="button" className="btn btn-ghost" onClick={quitarBanner}>
                  Quitar
                </button>
              )}
            </div>
            <input
              id="upload-fondo"
              type="file"
              accept="image/*"
              onChange={(e) => subirImagen(e, 'Fondos', 'imagen_fondo_url', 'imagenFondoUrl')}
              className="oculto"
            />
          </div>

          <div className="dash-grupo dash-grupo-ancho">
            <span className="dash-etiqueta">Plantillas (elige una para la vista previa)</span>
            <div
              style={{ position: 'relative' }}
              onMouseLeave={() => setPlantillaEnVistaPrevia(null)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  aria-label="Ver plantillas anteriores"
                  className="btn btn-ghost"
                  onClick={() => carruselPlantillasRef.current?.scrollBy({ left: -240, behavior: 'smooth' })}
                >
                  <ChevronLeft size={18} />
                </button>
                <div
                  ref={carruselPlantillasRef}
                  onWheel={(e) => {
                    if (carruselPlantillasRef.current) {
                      e.preventDefault();
                      carruselPlantillasRef.current.scrollLeft += e.deltaY || e.deltaX;
                    }
                  }}
                  style={{
                    display: 'flex',
                    flex: 1,
                    gap: '8px',
                    overflowX: 'auto',
                    padding: '8px 4px',
                    scrollBehavior: 'smooth',
                    WebkitOverflowScrolling: 'touch',
                    scrollbarWidth: 'thin',
                    touchAction: 'pan-x'
                  }}
                >
                  {PLANTILLAS_DISPONIBLES.map((url, index) => (
                    <button
                      key={url}
                      type="button"
                      className={`dash-plantilla ${perfil.imagenFondoUrl === url ? 'seleccionado' : ''}`}
                      title={`Plantilla ${index + 1}`}
                      aria-label={`Seleccionar plantilla ${index + 1}`}
                      onMouseEnter={() => setPlantillaEnVistaPrevia(index + 1)}
                      onFocus={() => setPlantillaEnVistaPrevia(index + 1)}
                      onBlur={() => setPlantillaEnVistaPrevia(null)}
                      onClick={() => setPerfil((prev) => ({ ...prev, imagenFondoUrl: url }))}
                    >
                      <img src={url} alt="" loading="lazy" />
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  aria-label="Ver plantillas siguientes"
                  className="btn btn-ghost"
                  onClick={() => carruselPlantillasRef.current?.scrollBy({ left: 240, behavior: 'smooth' })}
                >
                  <ChevronRight size={18} />
                </button>
              </div>

              <div
                aria-hidden={!plantillaEnVistaPrevia}
                style={{
                  position: 'absolute',
                  zIndex: 5,
                  left: '50%',
                  bottom: 'calc(100% + 8px)',
                  width: 'min(260px, 70vw)',
                  height: '150px',
                  borderRadius: '14px',
                  overflow: 'hidden',
                  background: 'var(--superficie)',
                  border: '2px solid var(--borde-fuerte)',
                  boxShadow: '0 12px 30px rgba(0,0,0,0.35)',
                  opacity: plantillaEnVistaPrevia ? 1 : 0,
                  visibility: plantillaEnVistaPrevia ? 'visible' : 'hidden',
                  transform: plantillaEnVistaPrevia
                    ? 'translateX(-50%) scale(1)'
                    : 'translateX(-50%) scale(0.96)',
                  transition: 'opacity 180ms ease, transform 220ms ease, visibility 220ms ease',
                  pointerEvents: 'none'
                }}
              >
                {plantillaEnVistaPrevia && (
                  <img
                    src={PLANTILLAS_DISPONIBLES[plantillaEnVistaPrevia - 1]}
                    alt={`Vista previa de la plantilla ${plantillaEnVistaPrevia}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                )}
              </div>
            </div>
          </div>

          <button type="button" className="btn btn-primario" onClick={guardarCambiosPerfil}>
            <Save size={16} /> Guardar cambios
          </button>
          <button type="button" className="btn btn-ghost" onClick={restablecerTema} title="Volver al tema Pocketwork sin banner">
            <RotateCcw size={16} /> Restablecer tema
          </button>
        </div>
      </div>

      {/* ---------- Perfil laboral ---------- */}
      <div className="dash-panel">
        <h4 className="dash-panel-titulo">
          <Settings size={20} /> Perfil laboral
        </h4>
        <div className="dash-fila">
          <label className="fila cursor-pointer">
            <input
              type="checkbox"
              checked={perfil.disponible}
              onChange={(e) => setPerfil({ ...perfil, disponible: e.target.checked })}
            />
            <span className="dash-etiqueta">Disponible para trabajar</span>
          </label>
          <div className="dash-grupo">
            <span className="dash-etiqueta">Área (ej. Diseño, Foto, Video)</span>
            <input
              type="text"
              maxLength={40}
              className="campo"
              placeholder="¿En qué trabajas?"
              value={perfil.area}
              onChange={(e) => setPerfil({ ...perfil, area: e.target.value })}
            />
          </div>
          <div className="dash-grupo">
            <span className="dash-etiqueta">Contacto (correo o red)</span>
            <input
              type="text"
              maxLength={60}
              className="campo"
              placeholder="¿Cómo te contactan?"
              value={perfil.contacto}
              onChange={(e) => setPerfil({ ...perfil, contacto: e.target.value })}
            />
          </div>
        </div>
        <p className="texto-3 texto-auxiliar">Se muestra en tu perfil público. Recuerda pulsar "Guardar cambios".</p>
      </div>

      {/* ---------- Mis números ---------- */}
      <div className="dash-panel">
        <h4 className="dash-panel-titulo">
          <Eye size={20} /> Mis números
        </h4>
        <div className="fila">
          <span className="dash-stat"><Eye size={14} /> {misNumeros.vistas} vistas</span>
          <span className="dash-stat"><Heart size={14} /> {misNumeros.likes} likes</span>
          <span className="dash-stat"><MessageCircle size={14} /> {misNumeros.comentarios} comentarios</span>
        </div>
        {misNumeros.top.length > 0 && (
          <div className="columna mt-3">
            {misNumeros.top.map((t) => (
              <div key={t.id} className="fila-entre">
                <span className="crecer">{t.titulo}</span>
                <span className="badge">{t.vistas} vistas</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---------- Publicar proyecto ---------- */}
      <div className="dash-publicar">
        <h2 className="dash-publicar-titulo">
          <Palette size={22} /> Publicar nuevo proyecto
        </h2>

        <div className="dash-publicar-fila">
          <input
            type="text"
            maxLength={20}
            placeholder="Título (máx 20)"
            className="campo"
            value={nuevaObra.titulo}
            onChange={(e) => setNuevaObra({ ...nuevaObra, titulo: e.target.value })}
          />

          <label htmlFor="upload-proyecto" className="btn btn-secundario cursor-pointer">
            <ImageIcon size={18} /> Subir archivo
          </label>
          <input
            id="upload-proyecto"
            type="file"
            accept="image/*,video/*,audio/*"
            onChange={prepararArchivoProyecto}
            className="oculto"
          />

          <button type="button" className="btn btn-primario" onClick={publicarProyecto}>
            <Send size={18} /> Publicar
          </button>
        </div>

        {nuevaObra.imagenUrl && (
          <p className="texto-3 texto-auxiliar">
            Archivo listo para publicar.
          </p>
        )}
      </div>

      {/* ---------- Mi portafolio ---------- */}
      <h2 className="dash-titulo-seccion">Mi portafolio</h2>
      <div className="dash-grid">
        {obras.length > 0 ? (
          obras.map((obra) => (
            <div key={obra.id} className="dash-tarjeta" onClick={() => abrirProyecto(obra)}>
              {obra.tipo_archivo === 'video' ? (
                <video src={obra.archivo_url} className="dash-tarjeta-media" muted />
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
                      className={`dash-stat cursor-pointer ${obra.miLike ? 'activo' : ''}`}
                      title={obra.miLike ? 'Quitar like' : 'Dar like'}
                    >
                      <Heart size={14} fill={obra.miLike ? 'currentColor' : 'none'} /> {obra.totalLikes}
                    </button>

                    <span className="dash-stat" title="Comentarios">
                      <MessageCircle size={14} /> {obra.comentarios?.[0]?.count || 0}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  className="accion peligro alinear-inicio"
                  onClick={(e) => {
                    e.stopPropagation();
                    borrarProyecto(obra.id);
                  }}
                >
                  <Trash2 size={14} /> Eliminar
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="dash-vacio">
            <Inbox size={34} />
            <span>Sube tu primer proyecto arriba para verlo aquí.</span>
          </div>
        )}
      </div>

      {/* ---------- Modal de obra con comentarios ---------- */}
      {proyectoSeleccionado && (
        <div className="modal-fondo ancho" onClick={() => setProyectoSeleccionado(null)}>
          <div className="modal-obra" onClick={(e) => e.stopPropagation()}>
            <div className="modal-obra-media">
              {proyectoSeleccionado.tipo_archivo === 'video' ? (
                <video src={proyectoSeleccionado.archivo_url} controls autoPlay />
              ) : (
                <img src={proyectoSeleccionado.archivo_url} alt="" />
              )}
            </div>

            <div className="modal-obra-lado">
              <button
                type="button"
                className="btn-icono alinear-fin mb-3"
                onClick={() => {
                  setProyectoSeleccionado(null);
                  setRespondiendoA(null);
                }}
                title="Cerrar"
              >
                <X size={18} />
              </button>

              <div className="modal-obra-cabecera">
                {editandoTitulo ? (
                  <>
                    <input
                      value={tituloEditando}
                      onChange={(e) => setTituloEditando(e.target.value)}
                      maxLength={20}
                      className="campo"
                    />
                    <button
                      type="button"
                      onClick={actualizarTituloProyecto}
                      className="accion exito"
                      title="Guardar título"
                    >
                      <Save size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditandoTitulo(false);
                        setTituloEditando(proyectoSeleccionado.titulo || '');
                      }}
                      className="accion peligro"
                      title="Cancelar"
                    >
                      <X size={16} />
                    </button>
                  </>
                ) : (
                  <>
                    <h2 className="modal-obra-titulo">{proyectoSeleccionado.titulo}</h2>
                    <button
                      type="button"
                      onClick={() => setEditandoTitulo(true)}
                      className="accion"
                      title="Editar título"
                    >
                      <Pencil size={16} />
                    </button>
                  </>
                )}
              </div>

              {proyectoSeleccionado.descripcion && (
                <p className="modal-obra-descripcion">{proyectoSeleccionado.descripcion}</p>
              )}

              <div className="lista-comentarios">
                {comentarios.filter((c) => !c.parent_id).map((c) => (
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
                    currentUserId={usuario?.id}
                    comentarioEditandoId={comentarioEditandoId}
                    comentarioEditandoTexto={comentarioEditandoTexto}
                    setComentarioEditandoId={setComentarioEditandoId}
                    setComentarioEditandoTexto={setComentarioEditandoTexto}
                    actualizarComentario={actualizarComentario}
                  />
                ))}
              </div>

              <form onSubmit={enviarComentario} className="form-comentario">
                <input
                  className="campo"
                  placeholder="Escribe un comentario..."
                  value={nuevoComentario}
                  onChange={(e) => setNuevoComentario(e.target.value)}
                />
                <button type="submit" disabled={enviandoComentario} className="btn-enviar-comentario" title="Enviar">
                  <Send size={18} />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Confirmación de salida ---------- */}
      {mostrarModalSalir && (
        <div className="modal-fondo" onClick={() => setMostrarModalSalir(false)}>
          <div className="modal-caja" onClick={(e) => e.stopPropagation()}>
            <LogOut size={42} className="icono-modal" style={{ color: 'var(--marca-400)' }} />
            <h3 className="modal-titulo">¿Deseas salir?</h3>
            <p className="modal-texto">Tu sesión se cerrará de forma segura.</p>
            <div className="modal-acciones">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setMostrarModalSalir(false)}
              >
                No, quedarme
              </button>
              <button
                type="button"
                className="btn btn-peligro"
                onClick={() => {
                  setMostrarModalSalir(false);
                  manejarCerrarSesion();
                }}
              >
                <LogOut size={16} /> Sí, salir
              </button>
            </div>
          </div>
        </div>
      )}

      <AlertModal alerta={alerta} setAlerta={setAlerta} />
    </section>
  );
};

export default Dashboard; 