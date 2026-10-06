import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import Login from './componentes/login';
import Registro from './componentes/Registro';
import Dashboard from './componentes/Dashboard';
import DashboardAdulto from './componentes/Dashboard+18';
import Galeria from './componentes/Galeria';
import PerfilPublico from './componentes/perfilpublico';
import Notificaciones from './componentes/notificaciones';
import Olvido from './componentes/olvido';
import ActualizarPassword from './componentes/actualizarpasword';
import Nosotros from './componentes/Nosotros';
import BotonTema from './componentes/BotonTema';
import Admin from './componentes/Admin';

function App() {
  return (
    <Router>
      <div className="App">
        {/* Control de tema (oscuro/claro) disponible en toda la aplicación */}
        <BotonTema />

        <Routes>
          {/* RUTA INICIAL: Redirige al login por defecto */}
          <Route path="/" element={<Navigate to="/login" />} />

          {/* RUTA DE LOGIN */}
          <Route path="/login" element={<Login />} />

          {/* RUTA DE REGISTRO */}
          <Route path="/registro" element={<Registro />} />

          {/* RUTA DEL DASHBOARD (Privado) */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard-adulto" element={<DashboardAdulto />} />

          {/* RUTA DE LA GALERÍA PÚBLICA */}
          <Route path="/galeria" element={<Galeria />} />

          {/* RUTA DE PERFIL PÚBLICO (Dinámica) */}
          <Route path="/perfil/:idUsuario" element={<PerfilPublico />} />

          {/* RUTA DE NOTIFICACIONES */}
          <Route path="/notificaciones" element={<Notificaciones />} />

          {/* RUTA OLVIDO DE CONTRASEÑA */}
          <Route path="/olvido" element={<Olvido />} />

          {/* RUTA NOSOTROS */}
          <Route path="/nosotros" element={<Nosotros />} />

          {/* RUTA ACTUALIZAR CONTRASEÑA */}
          <Route path="/actualizar-password" element={<ActualizarPassword />} />

          {/* RUTA ADMIN */}
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
