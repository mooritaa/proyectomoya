import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { ArrowLeft, Bell, Inbox } from 'lucide-react';
import logoPocketwork from '../imagenes/logo.png';
import './estilos.css';
import { cargarActividad, obtenerClaveNotificacionesLeidas } from './actividad';

const Notificaciones = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [notificaciones, setNotificaciones] = useState(Array.isArray(location.state?.notificaciones) ? location.state.notificaciones : []);
  const [cargando, setCargando] = useState(false);
  const [rutaDashboard, setRutaDashboard] = useState(location.state?.dashboardPath || '/dashboard');

  useEffect(() => {
    const init = async () => {
      let claveNotificacionesLeidas = obtenerClaveNotificacionesLeidas(false);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: perfil, error } = await supabase
          .from('perfiles')
          .select('tipo_cuenta')
          .eq('id', user.id)
          .maybeSingle();
        if (error) {
          console.error('No se pudo determinar el dashboard de regreso:', error.message);
        } else if (perfil?.tipo_cuenta === 'adulto') {
          setRutaDashboard('/dashboard-adulto');
          claveNotificacionesLeidas = obtenerClaveNotificacionesLeidas(true);
        }
      }

      if (notificaciones.length === 0) {
        await cargarNotificacionesDB(claveNotificacionesLeidas);
      } else {
        localStorage.setItem(claveNotificacionesLeidas, String(notificaciones.length));
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cargarNotificacionesDB = async (claveNotificacionesLeidas) => {
    setCargando(true);

    const { data: userData, error: errorUsuario } = await supabase.auth.getUser();
    if (errorUsuario) {
      console.error('No se pudo cargar la sesión para la actividad:', errorUsuario.message);
      setCargando(false);
      return;
    }
    const user = userData.user;
    if (!user) {
      setCargando(false);
      return;
    }

    const { data: perfil, error: errorPerfil } = await supabase
      .from('perfiles')
      .select('tipo_cuenta')
      .eq('id', user.id)
      .maybeSingle();
    if (errorPerfil) {
      console.error('No se pudo comprobar el tipo de cuenta para la actividad:', errorPerfil.message);
      setCargando(false);
      return;
    }

    const { data: proyectos, error: errorProyectos } = await supabase
      .from('proyectos')
      .select('id')
      .eq('usuario_id', user.id);
    if (errorProyectos) {
      console.error('No se pudieron cargar tus publicaciones para la actividad:', errorProyectos.message);
      setCargando(false);
      return;
    }

    try {
      const items = await cargarActividad(
        user.id,
        (proyectos || []).map((proyecto) => proyecto.id),
        perfil?.tipo_cuenta === 'adulto'
      );
      setNotificaciones(items);
      localStorage.setItem(claveNotificacionesLeidas, String(items.length));
    } catch (error) {
      console.error('No se pudo cargar la actividad:', error.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="auth-pantalla libre">
      <div className="auth-tarjeta ancha entrada-fade">
        <div className="auth-cabecera">
          <img src={logoPocketwork} alt="Logo de Pocketwork" className="auth-logo" />
          <h2 className="auth-titulo">Actividad reciente</h2>
          <p className="auth-subtitulo">Comentarios y publicaciones de cuentas que sigues</p>
        </div>

        <div className="fila mb-3">
          <button type="button" className="btn btn-ghost" onClick={() => navigate(rutaDashboard)}>
            <ArrowLeft size={17} /> Volver al panel
          </button>
          <span className="badge marca">
            <Bell size={13} /> {notificaciones.length}
          </span>
        </div>

        {cargando && <p className="texto-2 centrado">Cargando actividad...</p>}

        {!cargando && notificaciones.length === 0 && (
          <div className="estado-vacio">
            <Inbox size={34} />
            <span>No tienes actividad nueva por ahora.</span>
          </div>
        )}

        {!cargando && notificaciones.length > 0 && (
          <div className="notif-lista">
            {notificaciones.map(n => (
              <article key={n.id} className="notif-item">
                <button
                  type="button"
                  onClick={() => n.usuarioId && navigate(`/perfil/${n.usuarioId}`)}
                  disabled={!n.usuarioId}
                  aria-label={`Ver perfil de ${n.nombre}`}
                  style={{
                    padding: 0,
                    border: 0,
                    borderRadius: '50%',
                    background: 'none',
                    cursor: n.usuarioId ? 'pointer' : 'default',
                  }}
                >
                  <img src={n.foto} alt="" className="avatar avatar-md" />
                </button>
                <div className="crecer">
                  <p className="notif-texto">
                    <button
                      type="button"
                      className="texto-marca"
                      onClick={() => n.usuarioId && navigate(`/perfil/${n.usuarioId}`)}
                      disabled={!n.usuarioId}
                      style={{
                        padding: 0,
                        border: 0,
                        background: 'none',
                        font: 'inherit',
                        fontWeight: 700,
                        cursor: n.usuarioId ? 'pointer' : 'default',
                      }}
                    >
                      {n.nombre}
                    </button>
                    {n.tipo === 'publicacion' ? (
                      <>
                        <span className="texto-2"> publicó una nueva obra: </span>
                        <em>{n.tituloProyecto}</em>
                      </>
                    ) : (
                      <>
                        <span className="texto-2"> comentó: </span>
                        <em>"{n.contenido}"</em>
                      </>
                    )}
                  </p>
                  {n.tipo !== 'publicacion' && (
                    <p className="texto-3 notif-proyecto">
                      En tu obra: <strong>{n.tituloProyecto}</strong>
                    </p>
                  )}
                  <small className="texto-3">
                    {n.fecha ? new Date(n.fecha).toLocaleString('es-VE') : ''}
                  </small>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Notificaciones;
