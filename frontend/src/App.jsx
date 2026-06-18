import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Layout from './components/Layout/Layout';
import PrivateRoute from './components/common/PrivateRoute';
import AdminRoute from './components/common/AdminRoute';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Inventario from './pages/Inventario';
import InventarioDetalle from './pages/InventarioDetalle';
import Almacenes from './pages/Almacenes';
import Leads from './pages/Leads';
import Citas from './pages/Citas';
import Clientes from './pages/Clientes';
import ClienteDetalle from './pages/ClienteDetalle';
import Cotizaciones from './pages/Cotizaciones';
import CotizacionNueva from './pages/CotizacionNueva';
import CotizacionDetalle from './pages/CotizacionDetalle';
import Ventas from './pages/Ventas';
import VentaDetalle from './pages/VentaDetalle';
import Facturacion from './pages/Facturacion';
import AdminStock from './pages/AdminStock';
import Importar from './pages/Importar';
import ConfigApis from './pages/ConfigApis';
import Usuarios from './pages/Usuarios';
import ImagenesStock from './pages/ImagenesStock';

export default function App() {
  const token = useAuthStore((s) => s.token);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={token ? <Navigate to="/" replace /> : <Login />} />

        <Route element={<PrivateRoute />}>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="leads" element={<Leads />} />
            <Route path="citas" element={<Citas />} />
            <Route path="clientes" element={<Clientes />} />
            <Route path="clientes/:id" element={<ClienteDetalle />} />
            <Route path="cotizaciones" element={<Cotizaciones />} />
            <Route path="cotizaciones/nueva" element={<CotizacionNueva />} />
            <Route path="cotizaciones/:id" element={<CotizacionDetalle />} />
            <Route path="ventas" element={<Ventas />} />
            <Route path="ventas/:id" element={<VentaDetalle />} />
            <Route path="inventario" element={<Inventario />} />
            <Route path="inventario/imagenes" element={<ImagenesStock />} />
            <Route path="inventario/:id" element={<InventarioDetalle />} />
            <Route path="almacenes" element={<Almacenes />} />
            <Route path="facturacion" element={<Facturacion />} />

            <Route element={<AdminRoute />}>
              <Route path="admin/stock" element={<AdminStock />} />
              <Route path="admin/usuarios" element={<Usuarios />} />
              <Route path="importar" element={<Importar />} />
              <Route path="config/apis" element={<ConfigApis />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
