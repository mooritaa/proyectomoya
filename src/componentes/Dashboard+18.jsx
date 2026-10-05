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
import { Menu, User, Image as ImageIcon, ImagePlus, Activity, LogOut, Heart, MessageCircle, Trash2, Pencil, Save, X, Send, Palette, Settings, Inbox, RotateCcw, ChevronLeft, ChevronRight, Eye, Trophy } from 'lucide-react';


const STORAGE_KEY_NOTIF_LEIDAS = 'pocketwork_notificaciones_leidas';
const STORAGE_KEY_BIENVENIDA_ADULTO = 'pocketwork_bienvenida_adulto';
const PLANTILLAS_DISPONIBLES = Array.from({ length: 50 }, (_, index) => `/imagenes/plantillas/textura${index + 1}.png`);

const ComentarioIndividual = ({ comentario, todosLosComentarios, alResponder, alBorrar, respondiendoA, enviarRespuesta, textoRespuesta, setTextoRespuesta, currentUserId, comentarioEditandoId, comentarioEditandoTexto, setComentarioEditandoId, setComentarioEditandoTexto, actualizarComentario }) => {
  const navigate = useNavigate();
  const hijos = todosLosComentarios.filter(h => String(h.parent_id) === String(comentario.id));
  const esPropio = String(comentario.usuario_id) === String(currentUserId);
  const estaEditando = String(comentarioEditandoId) === String(comentario.id);

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
              ><Save size={15} /></button>
              <button
                type="button"
                onClick={() => { setComentarioEditandoId(null); setComentarioEditandoTexto(''); }}
                className="accion peligro"
                title="Cancelar"
              ><X size={15} /></button>
            </div>
          ) : (
            <>
              <p className="comentario-texto">{comentario.contenido}</p>
              <div className="comentario-acciones">
                <button type="button" onClick={() => alResponder(comentario.id)} className="accion">Responder</button>
                {esPropio && (
                  <button
                    type="button"
                    onClick={() => {
                      setComentarioEditandoId(comentario.id);
                      setComentarioEditandoTexto(comentario.contenido);
                    }}
                    className="accion"
                    title="Editar"
                  ><Pencil size={14} /></button>
                )}
              </div>
            </>
          )}
        </div>
        <button type="button" onClick={() => alBorrar(comentario.id)} className="accion peligro" title="Eliminar comentario"><Trash2 size={16} /></button>

      {/* INPUT DE RESPUESTA SI ESTÁ ACTIVO */}
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
          >
            <Send size={16} />
          </button>
        </div>
      )}

      {hijos.map(hijo => (
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
        />
      ))}
    </div>
  );
};

// no olvides wilis la funcion anterior es para recursividad de comentarios

const Dashboard = ({ alCerrarSesion }) => {
  const [usuario, setUsuario] = useState(null);
  const navigate = useNavigate();

  const [perfil, setPerfil] = useState({
    nombre: 'Cargando...',
    bio: 'Artista ✨',
    colorPrincipal: '#f07e11',
    colorSecundario: '#1d1d22',
    colorFondoWeb: '#0b0b0d',
    colorLetraNombre: '#ffffff',
    colorLetraBio: '#e6e6ec',
    avatarUrl: null,
    imagenFondoUrl: null,
    disponible: false,
    area: '',
    contacto: ''
  });
  const perfilTextoGuardadoRef = useRef({
    nombre: 'Cargando...',
    bio: 'Artista ✨',
    area: '',
    contacto: '',
  });
  const [plantillaEnVistaPrevia, setPlantillaEnVistaPrevia] = useState(null);
  const carruselPlantillasRef = useRef(null);

  const [obras, setObras] = useState([]);
  const [misNumeros, setMisNumeros] = useState({ vistas: 0, likes: 0, comentarios: 0, top: [] });
  const [nuevaObra, setNuevaObra] = useState({ titulo: '', descripcion: '', imagenUrl: '' });
  const [contenidoExplicito, setContenidoExplicito] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [inicializando, setInicializando] = useState(true);
  const [perfilAdultoVerificado, setPerfilAdultoVerificado] = useState(false);

  // ESTADOS PARA COMENTARIOS
  const [proyectoSeleccionado, setProyectoSeleccionado] = useState(null);
  const [comentarios, setComentarios] = useState([]);
  const [nuevoComentario, setNuevoComentario] = useState('');
  const [enviandoComentario, setEnviandoComentario] = useState(false);
  const [respondiendoA, setRespondiendoA] = useState(null); // Guarda el ID del comentario al que respondes
  const [textoRespuesta, setTextoRespuesta] = useState('');

  const [comentarioEditandoId, setComentarioEditandoId] = useState(null);
  const [comentarioEditandoTexto, setComentarioEditandoTexto] = useState('');

  const [notificaciones, setNotificaciones] = useState([]);
  const [contadorNotificaciones, setContadorNotificaciones] = useState(0);
  const [notificacionesLeidasCount, setNotificacionesLeidasCount] = useState(0);

  const [editandoTitulo, setEditandoTitulo] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [mostrarModalSalir, setMostrarModalSalir] = useState(false);
  const [mostrarBienvenidaAdulto, setMostrarBienvenidaAdulto] = useState(false);
  const [desvaneciendoBienvenida, setDesvaneciendoBienvenida] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

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

  const actualizarContador = (totalNotificaciones) => {
    const leidas = Number(localStorage.getItem(STORAGE_KEY_NOTIF_LEIDAS)) || 0;
    const nuevos = Math.max(0, totalNotificaciones - leidas);
    setContadorNotificaciones(nuevos);
  };

  useEffect(() => {
    const leidas = Number(localStorage.getItem(STORAGE_KEY_NOTIF_LEIDAS)) || 0;
    const nuevos = Math.max(0, notificaciones.length - leidas);
    setContadorNotificaciones(nuevos);
  }, [notificaciones, notificacionesLeidasCount]);

  const [tituloEditando, setTituloEditando] = useState('');

  useEffect(() => {
    const inicializar = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;
        if (!user) {
          navigate('/login', { replace: true });
          return;
        }

        setUsuario(user);
        const perfilActual = await cargarPerfil(user.id);
        if (!perfilActual) {
          await supabase.auth.signOut();
          navigate('/login', { replace: true });
          return;
        }
        if (perfilActual.tipo_cuenta !== 'adulto') {
          navigate('/dashboard', { replace: true });
          return;
        }
        setPerfilAdultoVerificado(true);

        const claveBienvenida = `${STORAGE_KEY_BIENVENIDA_ADULTO}_${user.id}`;
        if (!localStorage.getItem(claveBienvenida)) {
          localStorage.setItem(claveBienvenida, 'mostrada');
          setMostrarBienvenidaAdulto(true);
        }
      } catch (error) {
        console.error('Error al inicializar el dashboard +18:', error);
        alert(`No se pudo cargar tu perfil: ${error.message}`);
        await supabase.auth.signOut();
        navigate('/login', { replace: true });
      } finally {
        setInicializando(false);
      }
    };
    inicializar();
  }, [navigate]);

  useEffect(() => {
    if (!mostrarBienvenidaAdulto) return undefined;

    const temporizadorDesvanecer = setTimeout(() => setDesvaneciendoBienvenida(true), 3600);
    const temporizadorCerrar = setTimeout(() => setMostrarBienvenidaAdulto(false), 4300);
    return () => {
      clearTimeout(temporizadorDesvanecer);
      clearTimeout(temporizadorCerrar);
    };
  }, [mostrarBienvenidaAdulto]);

  useEffect(() => {
    if (usuario && perfilAdultoVerificado) {
      cargarObrasConStats();
    }
  }, [usuario, perfilAdultoVerificado]);

  const cargarObrasConStats = async () => {
    const { data, error } = await supabase
      .from('proyectos')
      .select(`
        *,
        likes (usuario_id),
        comentarios (count)
      `)
      .eq('usuario_id', usuario.id)
      .order('creado_el', { ascending: false });

    if (error) console.error("Error cargando estadísticas:", error.message);
    if (data) {
      const procesadas = data.map(o => ({
        ...o,
        totalLikes: Number(o.likes?.length) || 0,
        miLike: o.likes?.some(l => l.usuario_id === usuario.id) || false
      }));
      setObras(procesadas);
    }
  };

  useEffect(() => {
    const cargarNumeros = async () => {
      if (obras.length === 0) {
        setMisNumeros({ vistas: 0, likes: 0, comentarios: 0, top: [] });
        return;
      }

      const ids = obras.map((obra) => obra.id);
      const { data: vistas, error } = await supabase
        .from('vistas')
        .select('proyecto_id')
        .in('proyecto_id', ids);

      if (error) {
        console.error('Error cargando estadísticas de vistas:', error.message);
        return;
      }

      const vistasPorObra = {};
      (vistas || []).forEach((vista) => {
        vistasPorObra[vista.proyecto_id] = (vistasPorObra[vista.proyecto_id] || 0) + 1;
      });
      const likes = obras.reduce((total, obra) => total + Number(obra.totalLikes || 0), 0);
      const comentarios = obras.reduce(
        (total, obra) => total + Number(obra.comentarios?.[0]?.count || 0),
        0
      );
      const top = [...obras]
        .sort((a, b) => (vistasPorObra[b.id] || 0) - (vistasPorObra[a.id] || 0))
        .slice(0, 3)
        .map((obra) => ({
          id: obra.id,
          titulo: obra.titulo,
          vistas: vistasPorObra[obra.id] || 0
        }));

      setMisNumeros({ vistas: (vistas || []).length, likes, comentarios, top });
    };

    cargarNumeros();
  }, [obras]);

  const formatearNotificacion = (comentario) => {
    const obra = obras.find(o => o.id === comentario.proyecto_id);
    const nombreObra = obra ? obra.titulo : 'tu publicación';
    const nombreAutor = comentario.perfiles?.nombre_completo || 'Alguien';
    return {
      id: comentario.id,
      texto: `${nombreAutor} comentó en ${nombreObra}: "${comentario.contenido}"`,
      fecha: comentario.creado_el,
      proyecto_id: comentario.proyecto_id
    };
  };

  const cargarNotificaciones = async () => {
    if (!usuario || obras.length === 0) {
      return [];
    }

    console.log('[Dashboard] cargarNotificaciones: usuario=', usuario?.id, 'obras=', obras.length);

    const proyectosIds = obras.map(o => o.id);
    const { data, error } = await supabase
      .from('comentarios')
      .select(`id, proyecto_id, usuario_id, creado_el, contenido, perfiles(nombre_completo)`)
      .in('proyecto_id', proyectosIds)
      .neq('usuario_id', usuario.id);

    if (!error && data) {
      const formateadas = data.map(formatearNotificacion);
      setNotificaciones(formateadas);

      actualizarContador(formateadas.length);

      console.log('[Dashboard] cargarNotificaciones: totalDB=', formateadas.length);

      return formateadas;
    }

    return [];
  };
  // EFECTO 1: Solo carga al iniciar o cuando cambian las obras
  useEffect(() => {
    if (usuario && perfilAdultoVerificado && obras.length > 0) {
      cargarNotificaciones();
    }
  }, [obras, usuario, perfilAdultoVerificado]);

  // EFECTO 2: El intervalo (Asegúrate de que use la versión fresca de la función)
  useEffect(() => {
    const intervalo = setInterval(() => {
      if (perfilAdultoVerificado) cargarNotificaciones();
    }, 20000);
    return () => clearInterval(intervalo);
  }, [obras, usuario, perfilAdultoVerificado]);


  const manejarIrNotificaciones = async () => {
    // Ideal: marcamos los comentarios como leídos y navegamos.
    const listaActual = await cargarNotificaciones();
    const total = Array.isArray(listaActual) ? listaActual.length : notificaciones.length;

    console.log('[Dashboard] manejarIrNotificaciones', { total, notificacionesLeidasCount });

    setContadorNotificaciones(0);
    setNotificacionesLeidasCount(total);
    localStorage.setItem(STORAGE_KEY_NOTIF_LEIDAS, String(total));
    setNotificaciones(listaActual);

    navigate('/notificaciones', { state: { notificaciones: listaActual } });
  };


  const manejarLike = async (e, proyectoId, yaTieneLike) => {
    e.stopPropagation();
    setObras(prev => prev.map(p => p.id === proyectoId ?
      { ...p, miLike: !yaTieneLike, totalLikes: yaTieneLike ? Number(p.totalLikes) - 1 : Number(p.totalLikes) + 1 } : p
    ));
    if (yaTieneLike) await supabase.from('likes').delete().match({ usuario_id: usuario.id, proyecto_id: proyectoId });
    else await supabase.from('likes').insert({ usuario_id: usuario.id, proyecto_id: proyectoId });
  };

  const abrirProyecto = (proyecto) => {
    setProyectoSeleccionado(proyecto);
    setTituloEditando(proyecto.titulo || '');
    setEditandoTitulo(false);
    setComentarioEditandoId(null);
    setComentarioEditandoTexto('');
    fetchComentarios(proyecto.id);
  };




  // ...existing code...

  const fetchComentarios = async (proyectoId) => {
    const { data, error } = await supabase
      .from('comentarios')
      .select(`
      id, contenido, creado_el, usuario_id, parent_id,
      perfiles ( id, nombre_completo, avatar_url )
    `)
      .eq('proyecto_id', proyectoId)
      .order('creado_el', { ascending: true });

    if (error) console.error("Error:", error.message);
    else setComentarios(data || []);
  };

  const enviarComentario = async (e) => {
    e.preventDefault();
    if (!nuevoComentario.trim() || !usuario || !proyectoSeleccionado?.id) return;

    if (nuevoComentario.trim().length > 100) {
      alert('⚠️ El comentario es demasiado largo (máximo 100 caracteres).');
      return;
    }

    if (proyectoSeleccionado.es_nsfw !== true) {
      const moderacion = await moderador.validarTexto(nuevoComentario.trim());
      if (!moderacion.seguro) {
        alert(moderacion.razon || 'Contenido inapropiado detectado. No se pudo publicar el comentario.');
        return;
      }
    }

    setEnviandoComentario(true);
    const { error } = await supabase
      .from('comentarios')
      .insert({
        proyecto_id: proyectoSeleccionado.id,
        usuario_id: usuario.id,
        contenido: nuevoComentario.trim()
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
      alert('Error: proyecto no seleccionado.');
      return;
    }

    if (!textoRespuesta.trim()) {
      alert('Escribe tu respuesta antes de enviar.');
      return;
    }

    if (textoRespuesta.trim().length > 100) {
      alert('⚠️ El comentario es demasiado largo (máximo 100 caracteres).');
      return;
    }

    if (proyectoSeleccionado.es_nsfw !== true) {
      const moderacion = await moderador.validarTexto(textoRespuesta.trim());
      if (!moderacion.seguro) {
        alert(moderacion.razon || 'Contenido inapropiado detectado. No se pudo publicar la respuesta.');
        return;
      }
    }

    const { data, error } = await supabase
      .from('comentarios')
      .insert([{
        proyecto_id: proyectoSeleccionado.id,
        usuario_id: usuario.id,
        contenido: textoRespuesta.trim(),
        parent_id: padreId
      }])
      .select('*, perfiles(*)');

    if (error) {
      console.error('Error de Supabase:', error.message);
      alert('Error al responder: ' + error.message);
      return;
    }

    await fetchComentarios(proyectoSeleccionado.id);

    setTextoRespuesta('');
    setRespondiendoA(null);
  };

    const actualizarComentario = async (comentarioId, contenido) => {
    if (!contenido.trim()) {
      alert('El contenido no puede estar vacío.');
      return;
    }
    if (contenido.trim().length > 100) {
      alert('⚠️ El comentario es demasiado largo (máximo 100 caracteres).');
      return;
    }

    const textoParaValidar = contenido.trim();
    if (proyectoSeleccionado?.es_nsfw !== true) {
      const moderacion = await moderador.validarTexto(textoParaValidar);
      if (!moderacion.seguro) {
        alert(moderacion.razon || 'Contenido inapropiado detectado. No se pudo actualizar el comentario.');
        return;
      }
    }

    const { data, error } = await supabase
      .from('comentarios')
      .update({ contenido: textoParaValidar }) // Usamos el texto ya validado
      .eq('id', comentarioId)
      .eq('usuario_id', usuario?.id)
      .select('*');

    if (error) {
      alert('Error al actualizar comentario: ' + error.message);
      console.error(error);
      return;
    }

    // ... (El resto de tu lógica de verificación y actualización de estado está bien)

    setComentarios(prev => prev.map(c => c.id === comentarioId ? { ...c, contenido: textoParaValidar } : c));
    setComentarioEditandoId(null);
    setComentarioEditandoTexto('');
    if (proyectoSeleccionado?.id) await fetchComentarios(proyectoSeleccionado.id);
    await cargarObrasConStats();
};

  const actualizarTituloProyecto = async () => {
    if (!proyectoSeleccionado) return;

    const tituloParaValidar = tituloEditando.trim(); // Guardamos el texto limpio

    if (!tituloParaValidar) {
      alert('El título no puede estar vacío.');
      return;
    }
    if (tituloParaValidar.length > 20) {
      alert('El título es demasiado largo (máximo 20 caracteres).');
      return;
    }

    const { data, error } = await supabase
      .from('proyectos')
      .update({ titulo: tituloParaValidar }) // Usamos el texto ya moderado
      .eq('id', proyectoSeleccionado.id)
      .select('*');

    if (error) {
      alert('Error al actualizar el título: ' + error.message);
      console.error(error);
      return;
    }

    // ... (El resto de tu lógica de verificación está perfecta)

    const { data: verifico, error: errorVerifico } = await supabase
      .from('proyectos')
      .select('titulo')
      .eq('id', proyectoSeleccionado.id)
      .single();

    if (errorVerifico || (!verifico || verifico.titulo !== tituloParaValidar)) {
      alert('No se pudo validar el título en la base de datos.');
      return;
    }

    setProyectoSeleccionado(prev => ({ ...prev, titulo: tituloParaValidar }));
    setObras(prev => prev.map(o => o.id === proyectoSeleccionado.id ? { ...o, titulo: tituloParaValidar } : o));
    setEditandoTitulo(false);
    await cargarObrasConStats();
    alert('✅ Título actualizado.');
};

  const cargarPerfil = async (userId) => {
    const { data, error } = await supabase
      .from('perfiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error cargando perfil +18:', error.message);
      throw error;
    }

    if (data) {
      const perfilCargado = {
        nombre: data.nombre_completo || '',
        bio: data.biografia || '',
        colorPrincipal: data.color_principal || '#f07e11',
        colorSecundario: data.color_secundario || '#1d1d22',
        colorFondoWeb: data.color_fondo_web || '#0b0b0d',
        colorLetraNombre: data.color_letra_nombre || '#ffffff',
        colorLetraBio: data.color_letra_bio || '#e6e6ec',
        avatarUrl: data.avatar_url,
        imagenFondoUrl: data.imagen_fondo_url,
        disponible: !!data.disponible_trabajo,
        area: data.area_trabajo || '',
        contacto: data.contacto_trabajo || ''
      };
      setPerfil(perfilCargado);
      perfilTextoGuardadoRef.current = {
        nombre: perfilCargado.nombre,
        bio: perfilCargado.bio,
        area: perfilCargado.area,
        contacto: perfilCargado.contacto,
      };
    }
    return data;
  };

  const borrarComentario = async (comentarioId) => {
    const confirmar = window.confirm("¿Estás seguro de que quieres eliminar este comentario?");
    if (!confirmar) return;

    try {
      const { error } = await supabase
        .from('comentarios')
        .delete()
        .eq('id', comentarioId);

      if (error) throw error;

      // Actualizamos el estado local para que el comentario desaparezca visualmente
      setComentarios(prev => prev.filter(c => c.id !== comentarioId));

      // Opcional: Recargar estadísticas para actualizar el contador de comentarios en la tarjeta
      cargarObrasConStats();

    } catch (err) {
      alert("❌ Error al borrar: " + err.message);
    }
  };


  // BOTÓN GUARDAR: Ahora solo para Textos y Colores

  const guardarCambiosPerfil = async () => {
    const resultado = validarPerfil(perfil);

    if (!resultado.valido) {
      const primerError = Object.values(resultado.errores)[0];
      alert("⚠️ " + primerError);
      return;
    }

    if (!usuario) {
      alert("Espera a que cargue tu sesión...");
      return;
    }

    setCargando(true);
    try {
      const textosParaModeracion = [
        { clave: 'nombre', etiqueta: 'Nombre', texto: perfil.nombre },
        { clave: 'bio', etiqueta: 'Biografía', texto: perfil.bio },
        { clave: 'area', etiqueta: 'Área de trabajo', texto: perfil.area },
        { clave: 'contacto', etiqueta: 'Contacto', texto: perfil.contacto }
      ];

      for (const campo of textosParaModeracion) {
        const moderacion = await moderador.validarTexto(campo.texto.trim());
        if (!moderacion.seguro) campo.rechazado = true;
      }

      const camposRechazados = textosParaModeracion.filter((campo) => campo.rechazado);
      if (camposRechazados.length > 0) {
        const valoresGuardados = perfilTextoGuardadoRef.current;
        setPerfil((actual) => ({
          ...actual,
          ...Object.fromEntries(
            camposRechazados.map(({ clave }) => [clave, valoresGuardados[clave]])
          ),
        }));
        alert(
          `❌ Contenido inapropiado en: ${camposRechazados.map(({ etiqueta }) => etiqueta).join(', ')}. Se restauraron los valores guardados.`
        );
        return;
      }

      const datosParaDB = {
        id: usuario.id,
        nombre_completo: perfil.nombre,
        biografia: perfil.bio,
        color_principal: perfil.colorPrincipal,
        color_secundario: perfil.colorSecundario,
        color_fondo_web: perfil.colorFondoWeb,
        imagen_fondo_url: perfil.imagenFondoUrl,
        color_letra_nombre: perfil.colorLetraNombre,
        color_letra_bio: perfil.colorLetraBio,
        disponible_trabajo: perfil.disponible,
        area_trabajo: perfil.area.trim() || null,
        contacto_trabajo: perfil.contacto.trim() || null
      };

      const { error: errorPerfil } = await supabase
        .from('perfiles')
        .upsert(datosParaDB, { onConflict: 'id' });

      if (errorPerfil) {
        console.error('Error guardando perfil:', errorPerfil);
        if (errorPerfil.code === '23505') {
          alert('❌ Este nombre de usuario ya está en uso. Por favor, elige otro.');
        } else {
          alert('❌ Error guardando perfil: ' + errorPerfil.message);
        }
      } else {
        perfilTextoGuardadoRef.current = {
          nombre: perfil.nombre,
          bio: perfil.bio,
          area: perfil.area,
          contacto: perfil.contacto,
        };
        alert('✅ ¡Información actualizada!');
      }
    } catch (error) {
      console.error('Error moderando o guardando el perfil:', error);
      alert('❌ No se pudieron moderar o guardar los cambios del perfil. Inténtalo de nuevo.');
    } finally {
      setCargando(false);
    }
  };

  const prepararArchivoProyecto = async (event) => {
    const archivo = event.target.files[0];
    if (!archivo) return;


    const tiposPermitidos = ['image', 'video', 'audio'];
    // Verificamos si el tipo de archivo (MIME type) empieza con alguno de los permitidos
    const esValido = tiposPermitidos.some(tipo => archivo.type.startsWith(tipo));

    if (!esValido) {
      alert("❌ Archivo no permitido. Solo puedes subir Imágenes, Videos o Audios.");
      event.target.value = ""; // Limpia el input para que no quede el archivo malo ahí
      return; // Detiene todo
    }
    // VALIDACIÓN DE TAMAÑO: 50MB (50 * 1024 * 1024 bytes)
    const limiteMB = 50;
    const limiteBytes = limiteMB * 1024 * 1024;

    if (archivo.size > limiteBytes) {
      alert(`⚠️ El archivo es demasiado grande. El límite son ${limiteMB}MB.`);
      event.target.value = ""; // Limpia el input para que no intente subirlo
      return;
    }

    setCargando(true);
    const nombreArchivo = `${Date.now()}-${archivo.name}`;
    let archivoSubido = false;

    try {
      // Subida al Bucket 'Proyectos'
      const { error: uploadError } = await supabase.storage
        .from('Proyectos')
        .upload(nombreArchivo, archivo);

      if (uploadError) throw uploadError;
      archivoSubido = true;

      // Obtener la URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('Proyectos')
        .getPublicUrl(nombreArchivo);

      if (archivo.type.startsWith('image') || archivo.type.startsWith('video')) {
        const resultadoModeracion = contenidoExplicito
          ? await moderador.validarMediaGore(publicUrl)
          : await moderador.validarMediaNoExplicita(publicUrl);
        if (!resultadoModeracion.seguro) {
          const { error: errorEliminar } = await supabase.storage.from('Proyectos').remove([nombreArchivo]);
          if (errorEliminar) {
            console.error('No se pudo eliminar el archivo bloqueado:', errorEliminar.message);
          }
          archivoSubido = false;
          alert(contenidoExplicito
            ? '❌ Archivo bloqueado: se detectó contenido gore.'
            : '❌ Archivo bloqueado: no es apto para una publicación no explícita.');
          return;
        }
      }

      // Guardamos la URL en el estado temporal para que el botón de publicar la use
      setNuevaObra(prev => ({ ...prev, imagenUrl: publicUrl }));

      alert("✅ Archivo cargado correctamente. Ahora puedes ponerle un título y publicar.");

    } catch (err) {
      if (archivoSubido) {
        const { error: errorEliminar } = await supabase.storage.from('Proyectos').remove([nombreArchivo]);
        if (errorEliminar) {
          console.error('No se pudo eliminar el archivo tras fallar la moderación:', errorEliminar.message);
        }
      }
      alert("❌ Error al subir el archivo: " + err.message);
      console.error(err);
      setCargando(false);
    } finally {
      setCargando(false);
      event.target.value = '';
    }
  };

  const publicarProyecto = async () => {
    // 1. Usamos la validación que exportamos (Título máx 20, etc.)
    const check = validarProyecto(nuevaObra);

    if (!check.valido) {
      alert("⚠️ " + Object.values(check.errores)[0]);
      return; // Detiene la ejecución si hay error
    }

    // 2. Lógica para detectar el tipo de archivo automáticamente
    let tipoDetectado = 'imagen';
    const urlLower = nuevaObra.imagenUrl.toLowerCase();

    if (urlLower.match(/\.(mp4|webm|ogg|mov)$/i)) {
      tipoDetectado = 'video';
    } else if (urlLower.match(/\.(mp3|wav|flac|aac)$/i)) {
      tipoDetectado = 'audio';
    }

    setCargando(true);
    try {
      if (tipoDetectado !== 'audio') {
        const resultadoModeracionMedia = contenidoExplicito
          ? await moderador.validarMediaGore(nuevaObra.imagenUrl)
          : await moderador.validarMediaNoExplicita(nuevaObra.imagenUrl);
        if (!resultadoModeracionMedia.seguro) {
          alert(contenidoExplicito
            ? '❌ Proyecto bloqueado: se detectó contenido gore.'
            : '❌ Proyecto bloqueado: el archivo contiene material no apto para usuarios estándar.');
          return;
        }
      }

      // 3. Inserción en Supabase
      const { error } = await supabase.from('proyectos').insert([
        {
          usuario_id: usuario.id,
          titulo: nuevaObra.titulo,
          archivo_url: nuevaObra.imagenUrl,
          tipo_archivo: tipoDetectado,
          es_nsfw: contenidoExplicito
        }
      ]);

      if (error) throw error;

      alert(`🚀 ¡Proyecto (${tipoDetectado}) publicado con éxito!`);

      // 4. Limpiar el formulario y recargar la lista
      setNuevaObra({ titulo: '', descripcion: '', imagenUrl: '' });
      setContenidoExplicito(false);
      cargarObrasConStats();

    } catch (err) {
      alert("❌ Error al publicar: " + err.message);
    } finally {
      setCargando(false);
    }
  };

  const borrarProyecto = async (id) => {
    if (!window.confirm("¿Eliminar proyecto?")) return;
    const { error } = await supabase.from('proyectos').delete().eq('id', id);
    if (error) alert("Error: " + error.message);
    else setObras(obras.filter(o => o.id !== id));
  };

  const subirImagen = async (event, nombreBucket, columnaDB, campoEstado) => {
    const archivo = event.target.files[0];
    if (!archivo) return;
    // Validar que sea imagen
    if (!archivo.type.startsWith('image/')) {
      alert('Solo se permiten archivos de imagen (jpg, png, gif, etc).');
      event.target.value = "";
      return;
    }
    setCargando(true);
    const nombreArchivo = `${Date.now()}-${archivo.name}`;
    const { error: uploadError } = await supabase.storage.from(nombreBucket).upload(nombreArchivo, archivo);

    if (uploadError) {
      alert("Error: " + uploadError.message);
      setCargando(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from(nombreBucket).getPublicUrl(nombreArchivo);
    let archivoSubido = true;
    try {
      const resultadoModeracion = await moderador.validarMediaGore(publicUrl);
      if (!resultadoModeracion.seguro) {
        const { error: errorEliminar } = await supabase.storage.from(nombreBucket).remove([nombreArchivo]);
        if (errorEliminar) {
          console.error('No se pudo eliminar la imagen bloqueada:', errorEliminar.message);
        }
        archivoSubido = false;
        alert('❌ Imagen bloqueada: se detectó contenido gore.');
        event.target.value = "";
        setCargando(false);
        return;
      }
    } catch (err) {
      if (archivoSubido) {
        const { error: errorEliminar } = await supabase.storage.from(nombreBucket).remove([nombreArchivo]);
        if (errorEliminar) {
          console.error('No se pudo eliminar la imagen tras fallar la moderación:', errorEliminar.message);
        }
      }
      alert('Error al moderar la imagen: ' + err.message);
      event.target.value = "";
      setCargando(false);
      return;
    }

    const { error: dbError } = await supabase
      .from('perfiles')
      .update({ [columnaDB]: publicUrl })
      .eq('id', usuario.id);

    if (dbError) alert("Error: " + dbError.message);
    else setPerfil(prev => ({ ...prev, [campoEstado]: publicUrl }));
    setCargando(false);
  };



  const manejarCerrarSesion = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const obtenerFondoHeader = () => {
    if (perfil.imagenFondoUrl) return `url(${perfil.imagenFondoUrl}) center/cover no-repeat`;
    return perfil.colorFondoWeb || perfil.colorPrincipal;
  };

  const temaActivoId = detectarTemaPerfil(perfil);
  const cabeceraClara = !perfil.imagenFondoUrl && esFondoClaro(perfil.colorFondoWeb);

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

  const quitarBanner = () => setPerfil((prev) => ({ ...prev, imagenFondoUrl: null }));

  const restablecerTema = () => {
    const tema = buscarTemaPerfil(TEMA_POR_DEFECTO_ID);
    if (!tema) return;
    setPerfil((prev) => ({
      ...prev,
      colorPrincipal: tema.colorPrincipal,
      colorFondoWeb: tema.colorFondoWeb,
      colorLetraNombre: tema.colorLetraNombre,
      colorLetraBio: tema.colorLetraBio,
      imagenFondoUrl: null,
    }));
  };

  const aplicarPlantilla = (numero) => {
    const url = `/imagenes/plantillas/textura${numero}.png`;
    setPerfil(prev => ({ ...prev, imagenFondoUrl: url }));
  };

  if (inicializando || !perfilAdultoVerificado) {
    return <div className="dash-cargando">Cargando tu espacio...</div>;
  }

  return (
    <section className="dash-pantalla">
      {mostrarBienvenidaAdulto && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            background: 'rgba(0,0,0,0.82)',
            backdropFilter: 'blur(8px)',
            opacity: desvaneciendoBienvenida ? 0 : 1,
            transition: 'opacity 700ms ease',
            pointerEvents: 'none'
          }}
        >
          <div
            style={{
              width: 'min(520px, 100%)',
              padding: '38px 30px',
              borderRadius: '22px',
              border: '1px solid rgba(240,126,17,0.65)',
              background: 'linear-gradient(145deg, #21150e, #101010 70%)',
              color: '#fff',
              textAlign: 'center',
              boxShadow: '0 20px 70px rgba(0,0,0,0.55)',
              transform: desvaneciendoBienvenida ? 'translateY(-12px) scale(0.98)' : 'translateY(0) scale(1)',
              transition: 'transform 700ms ease'
            }}
          >
            <span style={{ display: 'block', color: '#f07e11', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
              Pocketwork
            </span>
            <h1 style={{ margin: '12px 0', fontSize: 'clamp(1.7rem, 5vw, 2.4rem)' }}>
              Bienvenido a la zona +18
            </h1>
            <p style={{ margin: 0, color: '#d4d4d4', lineHeight: 1.6 }}>
              Disfruta y comparte contenido para adultos de forma responsable. El contenido violento o gore no está permitido.
            </p>
          </div>
        </div>
      )}
      <div className="dash-barra">
        <div className="pos-relativa">
          <button
            type="button"
            className="btn btn-secundario"
            onClick={() => setMenuAbierto(!menuAbierto)}
            aria-expanded={menuAbierto}
          >
            <span key={menuAbierto ? 'open' : 'closed'} className="icono-girar">
              {menuAbierto ? <X size={18} /> : <Menu size={18} />}
            </span>
            Menú
          </button>

          {menuAbierto && (
            <div className="dash-menu menu-caer">
              <button
                type="button"
                onClick={() => { setMenuAbierto(false); navigate('/galeria'); }}
                className="dash-menu-item"
              >
                <ImageIcon size={18} /> Galería
              </button>
              <button
                type="button"
                onClick={() => { setMenuAbierto(false); navigate('/retos'); }}
                className="dash-menu-item"
              >
                <Trophy size={18} /> Retos
              </button>
              <button
                type="button"
                onClick={() => { setMenuAbierto(false); navigate('/notificaciones'); }}
                className="dash-menu-item"
              >
                <Activity size={18} /> Ver actividad
              </button>
              <hr className="dash-menu-sep" />
              <button
                type="button"
                className="dash-menu-item peligro"
                onClick={() => { setMenuAbierto(false); setMostrarModalSalir(true); }}
              >
                <LogOut size={18} /> Cerrar Sesión
              </button>
            </div>
          )}
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => navigate('/galeria')}>
          <ImageIcon size={18} /> Explorar galería
        </button>
      </div>

      <div className="dash-cabecera" style={{ background: obtenerFondoHeader() }}>
        {perfil.avatarUrl && !avatarError ? (
          <img
            className="dash-avatar"
            src={perfil.avatarUrl}
            alt="Foto de perfil"
            onError={() => setAvatarError(true)}
          />
        ) : (
          <div className="dash-avatar" role="img" aria-label="Sin foto de perfil">
            <User size={54} color="var(--texto-3)" />
          </div>
        )}
        <h1 className={`dash-nombre${cabeceraClara ? ' claro' : ''}`} style={{ color: perfil.colorLetraNombre }}>{perfil.nombre}</h1>
        <p className={`dash-bio${cabeceraClara ? ' clara' : ''}`} style={{ color: perfil.colorLetraBio }}>{perfil.bio}</p>
      </div>

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
              onChange={(e) => {
                setAvatarError(false);
                subirImagen(e, 'Avatares', 'avatar_url', 'avatarUrl');
              }}
              className="oculto"
            />
          </div>
          <label className="dash-grupo">
            <span className="dash-etiqueta">Nombre de usuario</span>
            <input
              type="text"
              maxLength={25}
              className="campo"
              placeholder="Nombre de usuario"
              value={perfil.nombre}
              onChange={(e) => setPerfil({ ...perfil, nombre: e.target.value })}
            />
          </label>
          <label className="dash-grupo">
            <span className="dash-etiqueta">Biografía</span>
            <textarea
              maxLength={150}
              className="campo"
              placeholder="Describe tu perfil..."
              value={perfil.bio}
              onChange={(e) => setPerfil({ ...perfil, bio: e.target.value })}
            />
          </label>
        </div>

        <div className="dash-fila">
          <div className="dash-grupo dash-grupo-ancho">
            <span className="dash-etiqueta">Tema de mi cabecera</span>
            <div className="dash-temas">
              {TEMAS_PERFIL.map((tema) => (
                <button
                  key={tema.id}
                  type="button"
                  className={`dash-tema ${temaActivoId === tema.id ? 'seleccionado' : ''}`}
                  onClick={() => aplicarTema(tema.id)}
                  title={tema.nombre}
                  aria-pressed={temaActivoId === tema.id}
                >
                  <span className="dash-tema-muestras" aria-hidden="true">
                    <span style={{ background: tema.colorFondoWeb }} />
                    <span style={{ background: tema.colorPrincipal }} />
                  </span>
                  {tema.nombre}
                </button>
              ))}
            </div>
            {!temaActivoId && <span className="badge">Acento personalizado</span>}
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
            <div style={{ position: 'relative' }} onMouseLeave={() => setPlantillaEnVistaPrevia(null)}>
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
                      onClick={() => aplicarPlantilla(index + 1)}
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
                  transform: plantillaEnVistaPrevia ? 'translateX(-50%) scale(1)' : 'translateX(-50%) scale(0.96)',
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
        </div>

        <button type="button" className="btn btn-exito" onClick={guardarCambiosPerfil}>
          <Save size={16} /> Guardar cambios
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={restablecerTema}
          title="Volver al tema Pocketwork sin banner"
        >
          <RotateCcw size={16} /> Restablecer tema
        </button>
      </div>

      {false && <div className="dash-panel">
        <h4 className="dash-panel-titulo"><Settings size={20} /> Personalizar mi espacio</h4>
        <div className="dash-fila">
            <div className="dash-grupo">
              <span className="dash-etiqueta">Foto de perfil</span>
              <label htmlFor="upload-avatar" className="btn btn-secundario cursor-pointer">
                <ImagePlus size={16} /> Elegir foto
              </label>
              <input id="upload-avatar" type="file" accept="image/*" onChange={(e) => { setAvatarError(false); subirImagen(e, 'Avatares', 'avatar_url', 'avatarUrl'); }} className="oculto" />
            </div>
            <label className="dash-grupo">
              <span className="dash-etiqueta">Nombre de usuario</span>
              <input
                type="text"
                maxLength={25}
                className="campo"
                placeholder="Nombre de usuario"
                value={perfil.nombre}
                onChange={(e) => setPerfil({ ...perfil, nombre: e.target.value })}
              />
            </label>
            <label className="dash-grupo">
              <span className="dash-etiqueta">Biografía</span>
              <textarea
                maxLength={150}
                className="campo"
                placeholder="Describe tu perfil..."
                value={perfil.bio}
                onChange={(e) => setPerfil({ ...perfil, bio: e.target.value })}
              />
            </label>
        </div>

        <div className="dash-fila">
            <label className="dash-grupo-color">
              <span className="dash-etiqueta">Fondo web</span>
              <input type="color" value={perfil.colorFondoWeb} className="dash-color" onChange={(e) => setPerfil({ ...perfil, colorFondoWeb: e.target.value })} />
            </label>
            <label className="dash-grupo-color">
              <span className="dash-etiqueta">Cuadro</span>
              <input type="color" value={perfil.colorSecundario} className="dash-color" onChange={(e) => setPerfil({ ...perfil, colorSecundario: e.target.value })} />
            </label>
            <label className="dash-grupo-color">
              <span className="dash-etiqueta">Texto del nombre</span>
              <input type="color" value={perfil.colorLetraNombre} className="dash-color" onChange={(e) => setPerfil({ ...perfil, colorLetraNombre: e.target.value })} />
            </label>
            <label className="dash-grupo-color">
              <span className="dash-etiqueta">Texto de la biografía</span>
              <input type="color" value={perfil.colorLetraBio} className="dash-color" onChange={(e) => setPerfil({ ...perfil, colorLetraBio: e.target.value })} />
            </label>
            <div className="dash-grupo">
              <span className="dash-etiqueta">Banner</span>
              <label htmlFor="upload-fondo" className="btn btn-secundario cursor-pointer">
                <ImagePlus size={16} /> Elegir fondo
              </label>
              <input id="upload-fondo" type="file" accept="image/*" onChange={(e) => subirImagen(e, 'Fondos', 'imagen_fondo_url', 'imagenFondoUrl')} className="oculto" />
            </div>

            <div className="dash-grupo dash-grupo-ancho">
              <span className="dash-etiqueta">Plantillas (elige una para la vista previa)</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="number"
                  min="1"
                  max="50"
                  className="campo"
                  placeholder="Ej: 1"
                  onChange={async (e) => {
                    const num = parseInt(e.target.value);
                    if (num >= 1 && num <= 50) {
                      aplicarPlantilla(num);
                    } else if (num) {
                      alert('Plantilla no disponible. Solo hay plantillas del 1 al 50.');
                      e.target.value = '';
                    }
                  }}
                  style={{ flex: 1 }}
                />
              </div>

              <div
                style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px', position: 'relative' }}
                onMouseLeave={() => setPlantillaEnVistaPrevia(null)}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    fontSize: '0.72em',
                    color: '#555',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em'
                  }}
                >
                  <span>Pasa el cursor para previsualizar</span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    position: 'relative',
                    zIndex: 2
                  }}
                >
                  <button
                    type="button"
                    aria-label="Ver plantillas anteriores"
                    onClick={() => carruselPlantillasRef.current?.scrollBy({ left: -240, behavior: 'smooth' })}
                    className="btn btn-ghost"
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
                      gap: '6px',
                      overflowX: 'auto',
                      padding: '8px 4px 10px',
                      scrollBehavior: 'smooth',
                      WebkitOverflowScrolling: 'touch',
                      scrollbarWidth: 'thin',
                      touchAction: 'pan-x'
                    }}
                  >
                  {PLANTILLAS_DISPONIBLES.map((url, index) => {
                    const activo = perfil.imagenFondoUrl === url;
                    return (
                      <button
                        key={url}
                        type="button"
                        className={`dash-plantilla ${activo ? 'seleccionado' : ''}`}
                        style={{
                          position: 'relative',
                          minWidth: '52px',
                          width: '52px',
                          height: '52px',
                        }}
                        title={`Plantilla ${index + 1}`}
                        onMouseEnter={() => setPlantillaEnVistaPrevia(index + 1)}
                        onFocus={() => setPlantillaEnVistaPrevia(index + 1)}
                        onClick={() => aplicarPlantilla(index + 1)}
                      >
                        <img
                          src={url}
                          alt={`Plantilla ${index + 1}`}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                        <span
                          style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.7))',
                            color: '#fff',
                            fontSize: '0.62em',
                            fontWeight: 700,
                            padding: '2px 4px',
                            textAlign: 'center'
                          }}
                        >
                          {index + 1}
                        </span>
                      </button>
                    );
                  })}
                  </div>
                  <button
                    type="button"
                    aria-label="Ver plantillas siguientes"
                    onClick={() => carruselPlantillasRef.current?.scrollBy({ left: 240, behavior: 'smooth' })}
                    className="btn btn-ghost"
                  >
                    <ChevronRight size={18} />
                  </button>
                  <div
                    style={{
                      position: 'absolute',
                      left: '50%',
                      bottom: 'calc(100% + 8px)',
                      width: '220px',
                      height: '132px',
                      borderRadius: '14px',
                      overflow: 'hidden',
                      background: '#171717',
                      border: '2px solid #fff',
                      boxShadow: '0 12px 30px rgba(0,0,0,0.3)',
                      opacity: plantillaEnVistaPrevia ? 1 : 0,
                      visibility: plantillaEnVistaPrevia ? 'visible' : 'hidden',
                      transform: plantillaEnVistaPrevia
                        ? 'translate(-50%, 0) scale(1)'
                        : 'translate(-50%, 4px) scale(0.94)',
                      transition: 'opacity 180ms ease, transform 220ms ease, visibility 220ms ease',
                      pointerEvents: 'none'
                    }}
                    aria-hidden={!plantillaEnVistaPrevia}
                  >
                    {plantillaEnVistaPrevia && (
                      <>
                        <img
                          src={PLANTILLAS_DISPONIBLES[plantillaEnVistaPrevia - 1]}
                          alt={`Vista previa de la plantilla ${plantillaEnVistaPrevia}`}
                          style={{
                            display: 'block',
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'
                          }}
                        />
                        <span
                          style={{
                            position: 'absolute',
                            left: '10px',
                            bottom: '10px',
                            borderRadius: '999px',
                            padding: '5px 10px',
                            background: 'rgba(0,0,0,0.7)',
                            color: '#fff',
                            fontSize: '0.75em',
                            fontWeight: 700
                          }}
                        >
                          Plantilla {plantillaEnVistaPrevia}
                        </span>
                      </>
                    )}
                  </div>
                    </div>
                  </div>
              </div>
        </div>

        <button type="button" className="btn btn-exito" onClick={guardarCambiosPerfil}><Save size={16} /> Guardar cambios</button>
      </div>}

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
            {misNumeros.top.map((obra) => (
              <div key={obra.id} className="fila-entre">
                <span className="crecer">{obra.titulo}</span>
                <span className="badge">{obra.vistas} vistas</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="dash-publicar">
        <h2 className="dash-publicar-titulo"><Palette size={22} /> Publicar nuevo proyecto</h2>
        <div className="dash-publicar-fila">
          <input
            type="text"
            maxLength={20}
            placeholder="Título (máx 20)"
            className="campo"
            value={nuevaObra.titulo}
            onChange={(e) => setNuevaObra({ ...nuevaObra, titulo: e.target.value })}
            disabled={cargando}
          />

          <label className="dash-publicar-opcion-explicita">
            <input
              type="checkbox"
              checked={contenidoExplicito}
              onChange={(e) => setContenidoExplicito(e.target.checked)}
              disabled={cargando}
            />
            <span className="dash-etiqueta">Marcar como contenido explícito (+18)</span>
          </label>

          <label htmlFor="upload-proyecto" className="btn btn-secundario cursor-pointer">
            <ImageIcon size={18} /> Subir archivo
          </label>
          <input
            id="upload-proyecto"
            type="file"
            accept="image/*,video/*,audio/*"
            onChange={prepararArchivoProyecto}
            className="oculto"
            disabled={cargando}
          />

          <button
            type="button"
            className="btn btn-primario"
            onClick={publicarProyecto}
            disabled={cargando}
          >
            <Send size={18} /> {cargando ? 'Procesando...' : 'Publicar'}
          </button>
        </div>
      </div>

      <h2 className="dash-titulo-seccion">Mi portafolio</h2>
      <div className="dash-grid">
        {obras.length > 0 ? obras.map((obra) => (
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
        )) : (
          <div className="dash-vacio">
            <Inbox size={34} />
            <span>Sube tu primer proyecto arriba para verlo aquí.</span>
          </div>
        )}
      </div>

      {/* MODAL DE COMENTARIOS */}
      {
        proyectoSeleccionado && (
          <div className="modal-fondo ancho" onClick={() => setProyectoSeleccionado(null)}>
            <div className="modal-obra" onClick={e => e.stopPropagation()}>
              <div className="modal-obra-media">
                  {proyectoSeleccionado.tipo_archivo === 'video' ?
                    <video src={proyectoSeleccionado.archivo_url} controls autoPlay /> :
                    <img src={proyectoSeleccionado.archivo_url} alt="" />
                  }
              </div>
              <div className="modal-obra-lado">
                  <button type="button" className="btn-icono alinear-fin mb-3" onClick={() => {
                    setProyectoSeleccionado(null);
                    setRespondiendoA(null);
                  }}><X size={18} /></button>
                  <div className="modal-obra-cabecera">
                    {editandoTitulo ? (
                      <>
                        <input
                          value={tituloEditando}
                          onChange={(e) => setTituloEditando(e.target.value)}
                          maxLength={20}
                          className="campo"
                        />
                        <button type="button" onClick={actualizarTituloProyecto} className="accion exito"><Save size={16} /></button>
                        <button type="button" onClick={() => { setEditandoTitulo(false); setTituloEditando(proyectoSeleccionado.titulo || ''); }} className="accion peligro"><X size={16} /></button>
                      </>
                    ) : (
                      <>
                        <h2 className="modal-obra-titulo">{proyectoSeleccionado.titulo}</h2>
                        <button type="button" onClick={() => setEditandoTitulo(true)} className="accion"><Pencil size={18} /></button>
                      </>
                    )}
                  </div>
                  {proyectoSeleccionado.descripcion && (
                    <p className="modal-obra-descripcion">{proyectoSeleccionado.descripcion}</p>
                  )}
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
                    <button type="submit" disabled={enviandoComentario} className="btn-enviar-comentario">
                      {enviandoComentario ? '...' : <Send size={18} />}
                    </button>
                  </form>
              </div>
            </div>
          </div>
        )
      }
      {/* MODAL DE CONFIRMACIÓN PARA SALIR */}
      {mostrarModalSalir && (
        <div className="modal-fondo" onClick={() => setMostrarModalSalir(false)}>
          <div className="modal-caja" onClick={e => e.stopPropagation()}>
            <LogOut size={42} className="icono-modal" style={{ color: 'var(--marca-400)' }} />
            <h3 className="modal-titulo">¿Deseas salir?</h3>
            <p className="modal-texto">Tu sesión se cerrará de forma segura.</p>
            <div className="modal-acciones">
              <button
                type="button"
                onClick={() => setMostrarModalSalir(false)}
                className="btn btn-ghost"
              >
                No, quedarme
              </button>
              <button
                type="button"
                onClick={() => { setMostrarModalSalir(false); manejarCerrarSesion(); }}
                className="btn btn-peligro"
              >
                <LogOut size={16} /> Sí, salir
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};




export default Dashboard;
