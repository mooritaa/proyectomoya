import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { ArrowLeft, Bell, Inbox, ShieldAlert, UserPlus } from 'lucide-react';
import logoPocketwork from '../imagenes/logo.png';
import { cargarActividad } from './notificacionesDB';
import './estilos.css';

const STORAGE_KEY_NOTIF_LEIDAS = 'pocketwork_notificaciones_leidas';

const Notificaciones = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [notificaciones, setNotificaciones] = useState(Array.isArray(location.state?.notificaciones) ? location.state.notificaciones : []);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    const init = async () => {
      if (notificaciones.length === 0) {
        await cargarNotificacionesDB();
      } else {
        localStorage.setItem(STORAGE_KEY_NOTIF_LEIDAS, String(notificaciones.length));
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cargarNotificacionesDB = async () => {
    setCargando(true);

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) {
      setCargando(false);
      return;
    }

    const items = await cargarActividad(user.id);
    setNotificaciones(items);
    localStorage.setItem(STORAGE_KEY_NOTIF_LEIDAS, String(items.length));
    setCargando(false);
  };

  return (
    <div className="auth-pantalla libre">
      <div className="auth-tarjeta ancha entrada-fade">
        <div className="auth-cabecera">
          <img src={logoPocketwork} alt="Logo de Pocketwork" className="auth-logo" />
          <h2 className="auth-titulo">Actividad reciente</h2>
          <p className="auth-subtitulo">Comentarios, seguidores y moderación</p>
        </div>

        <div className="fila mb-3">
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/dashboard')}>
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
                {n.tipo === 'reporte' ? (
                  <span className="avatar avatar-md fila centrado-fila sin-margen">
                    <ShieldAlert size={20} color="var(--aviso)" />
                  </span>
                ) : n.tipo === 'seguidor' ? (
                  <span className="avatar avatar-md fila centrado-fila sin-margen">
                    <UserPlus size={20} color="var(--marca-400)" />
                  </span>
                ) : (
                  <img src={n.foto} alt="" className="avatar avatar-md" />
                )}
                <div className="crecer">
                  {n.tipo === 'comentario' && (
                    <>
                      <p className="notif-texto">
                        <strong className="texto-marca">{n.nombre}</strong>
                        <span className="texto-2"> comentó: </span>
                        <em>"{n.contenido}"</em>
                      </p>
                      <p className="texto-3 notif-proyecto">
                        En tu obra: <strong>{n.tituloProyecto}</strong>
                      </p>
                    </>
                  )}
                  {n.tipo === 'seguidor' && (
                    <p className="notif-texto">
                      <strong className="texto-marca">{n.nombre}</strong>
                      <span className="texto-2"> comenzó a seguirte.</span>
                    </p>
                  )}
                  {n.tipo === 'reporte' && (
                    <>
                      <p className="notif-texto">
                        <strong className="texto-marca">Moderación: </strong>
                        <span className="texto-2">tu contenido fue reportado ({n.contenido}).</span>
                      </p>
                      <p className="texto-3 notif-proyecto">
                        Donde: <strong>{n.tituloProyecto}</strong>
                      </p>
                    </>
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
