import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { clientesApi } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';

const S = {
  grid: { display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 20 },
  card: { background: '#fff', borderRadius: 10, padding: 20, boxShadow: 'var(--shadow)', border: '1px solid var(--color-border)', marginBottom: 16 },
  cardTitle: { fontSize: 13, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '.5px' },
  field: { display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', padding: '8px 0', fontSize: 13 },
  label: { color: 'var(--color-text-muted)', fontWeight: 600 },
  badge: (c) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: c + '20', color: c }),
};

function Field({ label, value }) {
  return (
    <div style={S.field}>
      <span style={S.label}>{label}</span>
      <span>{value || '—'}</span>
    </div>
  );
}

export default function ClienteDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [notaTexto, setNotaTexto] = useState('');

  const { data: cliente, isLoading } = useQuery({
    queryKey: ['cliente', id],
    queryFn: () => clientesApi.obtener(id),
  });

  const notaMutation = useMutation({
    mutationFn: () => clientesApi.actualizar(id, {}), // Placeholder — notas de cliente vía endpoint separado si se necesita
    onSuccess: () => { toast.success('Nota guardada'); setNotaTexto(''); qc.invalidateQueries(['cliente', id]); },
  });

  if (isLoading) return <LoadingSpinner fullPage />;
  if (!cliente) return <div>Cliente no encontrado</div>;

  const nombre = cliente.razonSocial || `${cliente.nombre || ''} ${cliente.apellidos || ''}`.trim();

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
        <button onClick={() => navigate(-1)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: '#fff', cursor: 'pointer', fontSize: 13 }}>← Volver</button>
        <h1 style={{ fontSize: 18, fontWeight: 700 }}>{nombre}</h1>
        <Link to="/cotizaciones/nueva" state={{ clienteId: id }} style={{ marginLeft: 'auto', padding: '8px 16px', background: '#16a34a', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
          + Cotización
        </Link>
      </div>

      <div style={S.grid}>
        {/* Ficha del cliente */}
        <div>
          <div style={S.card}>
            <div style={S.cardTitle}>Datos del cliente</div>
            <Field label="Tipo Doc." value={cliente.tipoDoc} />
            <Field label="N° Doc." value={cliente.numDoc} />
            <Field label="Nombre" value={nombre} />
            <Field label="Celular" value={cliente.celular} />
            <Field label="Email" value={cliente.email} />
            <Field label="Dirección" value={cliente.direccion} />
            <Field label="Canal" value={cliente.canalOrigen} />
            <Field label="Estado CRM" value={cliente.crmEstado} />
            <Field label="Registrado" value={new Date(cliente.createdAt).toLocaleDateString('es-PE')} />
          </div>

          {/* Vehículos */}
          <div style={S.card}>
            <div style={S.cardTitle}>Vehículos</div>
            {cliente.vehiculos?.length ? cliente.vehiculos.map((v) => (
              <div key={v.id} style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: 8, marginBottom: 8, fontSize: 13 }}>
                <strong>{v.marca} {v.modelo}</strong> {v.anio && `(${v.anio})`}
                {v.medidaLlanta && <span style={{ marginLeft: 8, color: 'var(--color-primary)', fontWeight: 600 }}>• {v.medidaLlanta}</span>}
              </div>
            )) : <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Sin vehículos registrados</div>}
          </div>

          {/* JSON API crudo */}
          {cliente.apiRawJson && (
            <div style={S.card}>
              <div style={S.cardTitle}>Datos API externa</div>
              <pre style={{ fontSize: 10, background: '#f8fafc', padding: 12, borderRadius: 8, overflow: 'auto', maxHeight: 200 }}>
                {JSON.stringify(cliente.apiRawJson, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Historial */}
        <div>
          {/* Cotizaciones */}
          <div style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={S.cardTitle}>Cotizaciones</div>
              <Link to="/cotizaciones" state={{ clienteId: id }} style={{ fontSize: 12, color: 'var(--color-primary-light)' }}>Ver todas</Link>
            </div>
            {cliente.cotizaciones?.length ? cliente.cotizaciones.slice(0, 5).map((c) => (
              <Link key={c.id} to={`/cotizaciones/${c.id}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#f8fafc', borderRadius: 8, marginBottom: 8, fontSize: 13, textDecoration: 'none', color: 'inherit' }}>
                <span style={{ fontWeight: 600, color: 'var(--color-primary-light)' }}>{c.numero}</span>
                <span>S/ {parseFloat(c.total).toFixed(2)}</span>
                <span style={S.badge(c.estado === 'ACEPTADA' ? '#16a34a' : '#ca8a04')}>{c.estado}</span>
              </Link>
            )) : <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Sin cotizaciones</div>}
          </div>

          {/* Ventas */}
          <div style={S.card}>
            <div style={S.cardTitle}>Historial de compras</div>
            {cliente.ventas?.length ? cliente.ventas.slice(0, 5).map((v) => (
              <Link key={v.id} to={`/ventas/${v.id}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#f8fafc', borderRadius: 8, marginBottom: 8, fontSize: 13, textDecoration: 'none', color: 'inherit' }}>
                <span style={{ fontWeight: 600, color: 'var(--color-primary-light)' }}>{v.numero}</span>
                <span>S/ {parseFloat(v.total).toFixed(2)}</span>
                <span>{new Date(v.createdAt).toLocaleDateString('es-PE')}</span>
              </Link>
            )) : <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Sin compras</div>}
          </div>

          {/* Notas */}
          <div style={S.card}>
            <div style={S.cardTitle}>Notas</div>
            {cliente.notas?.map((n) => (
              <div key={n.id} style={{ padding: '10px 12px', background: '#fefce8', borderRadius: 8, marginBottom: 8, border: '1px solid #fde047', fontSize: 13 }}>
                {n.texto}
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>{n.usuario?.nombre} • {new Date(n.createdAt).toLocaleDateString('es-PE')}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
