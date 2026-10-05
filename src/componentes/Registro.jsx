import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { supabase } from '../supabaseClient';
import imagenDeFondo from '../imagenes/fondo.jpg';
import logoProyecto from '../imagenes/logo.png';
import './estilos.css';
import ModalMensaje from './ModalMensaje';
import { traducirErrorSupabase } from './validaciones';

const esTextoSeguro = (texto) => {
  const ban = /('|;|--|\/\*|\*\/|\b(drop|delete|insert|update|select|truncate|alter|create)\b)/i;
  return !ban.test(texto);
};

const validarFormulario = (email, password) => {
  if (!email || !email.trim()) return 'El correo es obligatorio.';
  if (email.length > 65) return 'El correo es demasiado largo.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Formato de correo inválido.';
  if (!esTextoSeguro(email)) return 'Caracteres no permitidos en el correo.';
  if (!password || password.length < 6) return 'La contraseña debe tener al menos 6 caracteres.';
  if (password.length > 30) return 'La contraseña es demasiado larga.';
  if (!esTextoSeguro(password)) return 'Caracteres no permitidos en la contraseña.';
  return null;
};

const validarEdadAdulta = (fechaNacimiento) => {
  if (!fechaNacimiento) return 'Ingresa tu fecha de nacimiento.';

  const [anio, mes, dia] = fechaNacimiento.split('-').map(Number);
  const nacimiento = new Date(anio, mes - 1, dia);
  const hoy = new Date();

  if (
    Number.isNaN(nacimiento.getTime()) ||
    nacimiento.getFullYear() !== anio ||
    nacimiento.getMonth() !== mes - 1 ||
    nacimiento.getDate() !== dia ||
    nacimiento > hoy
  ) {
    return 'Ingresa una fecha de nacimiento válida.';
  }

  let edad = hoy.getFullYear() - anio;
  if (
    hoy.getMonth() < mes - 1 ||
    (hoy.getMonth() === mes - 1 && hoy.getDate() < dia)
  ) {
    edad -= 1;
  }

  return edad < 18 ? 'Debes tener al menos 18 años para crear una cuenta +18.' : null;
};

const Registro = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tipoCuenta, setTipoCuenta] = useState('estandar');
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [confirmaMayoriaEdad, setConfirmaMayoriaEdad] = useState(false);
  const [verClave, setVerClave] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [mostrarAdvertenciaAdultos, setMostrarAdvertenciaAdultos] = useState(false);
  const [modal, setModal] = useState({ abierto: false, texto: '', tipo: '' });
  const navigate = useNavigate();

  const handleNavigate = (ruta) => {
    setIsFadingOut(true);
    setTimeout(() => navigate(ruta), 450);
  };

  const crearCuenta = async (tipo, nacimiento = null) => {
    setCargando(true);
    try {
      const { data, error: errorAuth } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            tipo_cuenta: tipo,
            fecha_nacimiento: nacimiento
          }
        }
      });

      if (errorAuth) {
        if (errorAuth.message.includes('already registered') || errorAuth.status === 422) {
          setModal({
            abierto: true,
            texto: 'Este correo ya está registrado. Intenta iniciar sesión.',
            tipo: 'error'
          });
        } else {
          setModal({ abierto: true, texto: traducirErrorSupabase(errorAuth.message), tipo: 'error' });
        }
        return;
      }

      if (!data.user) throw new Error('No se pudo obtener el usuario creado.');

      const { error: errorPerfil } = await supabase.from('perfiles').insert([{
        id: data.user.id,
        nombre_completo: 'Nuevo Artista',
        biografia: 'Cuenta pendiente de verificación.',
        avatar_url: 'https://via.placeholder.com/150',
        tipo_cuenta: tipo,
        fecha_nacimiento: nacimiento
      }]);

      if (errorPerfil) {
        const { error: errorCerrarSesion } = await supabase.auth.signOut();
        setModal({
          abierto: true,
          texto: `La cuenta se creó, pero no se pudo guardar su perfil: ${errorPerfil.message}${errorCerrarSesion ? ` También hubo un error al cerrar la sesión: ${errorCerrarSesion.message}` : ''}`,
          tipo: 'error'
        });
        return;
      }

      const { error: errorCerrarSesion } = await supabase.auth.signOut();
      if (errorCerrarSesion) {
        throw new Error(`El perfil se guardó, pero no se pudo cerrar la sesión: ${errorCerrarSesion.message}`);
      }

      setEnviado(true);
      setModal({
        abierto: true,
        texto: '¡Registro exitoso! Por seguridad, verifica tu correo electrónico para activar tu cuenta.',
        tipo: 'exito'
      });
      setEmail('');
      setPassword('');
    } catch (error) {
      setModal({ abierto: true, texto: error.message || 'Error inesperado de conexión.', tipo: 'error' });
      console.error(error);
    } finally {
      setCargando(false);
    }
  };

  const manejarRegistro = async (e) => {
    e.preventDefault();
    const errorValidacion = validarFormulario(email, password);
    if (errorValidacion) {
      setModal({ abierto: true, texto: errorValidacion, tipo: 'error' });
      return;
    }

    if (tipoCuenta === 'adulto') {
      const errorEdad = validarEdadAdulta(fechaNacimiento);
      if (errorEdad) {
        setModal({ abierto: true, texto: errorEdad, tipo: 'error' });
        return;
      }
      if (!confirmaMayoriaEdad) {
        setModal({
          abierto: true,
          texto: 'Confirma que tienes al menos 18 años para continuar.',
          tipo: 'error'
        });
        return;
      }
      setMostrarAdvertenciaAdultos(true);
      return;
    }

    await crearCuenta('estandar');
  };

  const aceptarAdvertenciaAdultos = async () => {
    setMostrarAdvertenciaAdultos(false);
    await crearCuenta('adulto', fechaNacimiento);
  };

  const rechazarAdvertenciaAdultos = () => {
    setMostrarAdvertenciaAdultos(false);
    setTipoCuenta('estandar');
    setFechaNacimiento('');
    setConfirmaMayoriaEdad(false);
    handleNavigate('/login');
  };

  return (
    <div className="auth-pantalla" style={{ '--imagen-fondo': `url(${imagenDeFondo})` }}>
      <div className={`auth-tarjeta registro-tarjeta-auth ${isFadingOut ? 'salida-fade' : 'entrada-fade'}`}>
        <div className="auth-cabecera">
          <img src={logoProyecto} alt="Logo de Pocketwork" className="auth-logo" />
          <h2 className="auth-titulo">Crear cuenta</h2>
          <p className="auth-subtitulo">Publica tus obras y recibe interacción real</p>
        </div>

        {!enviado ? (
          <form onSubmit={manejarRegistro} className="auth-form registro-form" noValidate>
            <div className="campo-password">
              <Mail size={18} className="icono-campo" />
              <input
                type="email"
                placeholder="Tu correo de artista"
                aria-label="Correo electrónico"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="campo campo-con-icono"
                autoComplete="email"
                required
                disabled={cargando}
              />
            </div>

            <fieldset className="registro-tipoCuenta" disabled={cargando}>
              <legend>Tipo de cuenta</legend>
              <label className="registro-opcionCuenta">
                <input
                  type="radio"
                  name="tipoCuenta"
                  value="estandar"
                  checked={tipoCuenta === 'estandar'}
                  onChange={() => {
                    setTipoCuenta('estandar');
                    setFechaNacimiento('');
                    setConfirmaMayoriaEdad(false);
                  }}
                />
                Cuenta general
              </label>
              <label className="registro-opcionCuenta">
                <input
                  type="radio"
                  name="tipoCuenta"
                  value="adulto"
                  checked={tipoCuenta === 'adulto'}
                  onChange={() => setTipoCuenta('adulto')}
                />
                Cuenta +18
              </label>
            </fieldset>

            {tipoCuenta === 'adulto' && (
              <div className="registro-datosAdulto">
                <label htmlFor="fecha-nacimiento" className="registro-labelAdulto">
                  ¿Tienes 18 años o más? Ingresa tu fecha de nacimiento:
                </label>
                <input
                  id="fecha-nacimiento"
                  type="date"
                  value={fechaNacimiento}
                  onChange={(e) => setFechaNacimiento(e.target.value)}
                  className="campo"
                  required
                  disabled={cargando}
                />
                <label className="registro-confirmacionEdad">
                  <input
                    type="checkbox"
                    checked={confirmaMayoriaEdad}
                    onChange={(e) => setConfirmaMayoriaEdad(e.target.checked)}
                    disabled={cargando}
                  />
                  Confirmo que tengo al menos 18 años.
                </label>
              </div>
            )}

            <div className="campo-password">
              <Lock size={18} className="icono-campo" />
              <input
                type={verClave ? 'text' : 'password'}
                placeholder="Crea tu contraseña (mín. 6)"
                aria-label="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="campo campo-con-icono campo-con-ojo"
                autoComplete="new-password"
                required
                disabled={cargando}
              />
              <button
                type="button"
                className="boton-ojo"
                onClick={() => setVerClave((v) => !v)}
                aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {verClave ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <button type="submit" className="btn btn-primario btn-bloque" disabled={cargando}>
              {cargando ? 'Procesando...' : 'Crear mi cuenta'}
            </button>
          </form>
        ) : (
          <div className="auth-form">
            <p className="auth-aviso">Revisa tu correo para activar la cuenta antes de entrar.</p>
            <button
              type="button"
              className="btn btn-primario btn-bloque"
              onClick={() => handleNavigate('/login')}
            >
              Ir al inicio de sesión
            </button>
          </div>
        )}

        {!enviado && (
          <div className="auth-links">
            <hr className="divisor sin-margen" />
            <span className="auth-link">
              ¿Ya eres parte?{' '}
              <Link
                to="/login"
                className="auth-link-fuerte"
                onClick={(e) => {
                  e.preventDefault();
                  handleNavigate('/login');
                }}
              >
                Inicia sesión aquí
              </Link>
            </span>
          </div>
        )}
      </div>

      {mostrarAdvertenciaAdultos && (
        <div className="registro-advertenciaOverlay" role="presentation">
          <section
            className="registro-advertenciaAdultos"
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-advertencia-adultos"
          >
            <h2 id="titulo-advertencia-adultos">Advertencia de Contenido para Adultos (+18)</h2>
            <p>
              Al seleccionar el perfil +18, declaras bajo juramento que tienes al menos 18 años de edad (o la mayoría de edad legal en tu jurisdicción).
            </p>
            <p>
              Esta sección contiene material explícito, desnudez y lenguaje sin censura dirigido exclusivamente a audiencias adultas.
            </p>
            <h3>Condiciones de uso:</h3>
            <ul>
              <li>Queda estrictamente prohibido subir o compartir contenido violento, sangriento (gore) o ilegal.</li>
              <li>Confirmas que accedes de manera voluntaria y bajo tu propia responsabilidad.</li>
            </ul>
            <div className="registro-accionesAdvertencia">
              <button
                type="button"
                className="registro-aceptarAdvertencia"
                onClick={aceptarAdvertenciaAdultos}
                disabled={cargando}
              >
                {cargando ? 'Procesando...' : 'Acepto'}
              </button>
              <button
                type="button"
                className="registro-rechazarAdvertencia"
                onClick={rechazarAdvertenciaAdultos}
                disabled={cargando}
              >
                Rechazar
              </button>
            </div>
          </section>
        </div>
      )}

      <ModalMensaje
        mensaje={modal.abierto ? modal.texto : ''}
        tipo={modal.tipo}
        onClose={() => {
          setModal({ ...modal, abierto: false });
          if (modal.tipo === 'exito') handleNavigate('/login');
        }}
      />
    </div>
  );
};

export default Registro; 