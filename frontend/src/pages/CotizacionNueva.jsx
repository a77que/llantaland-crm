import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { clientesApi, productosApi, sedesApi, cotizacionesApi } from '../services/api';
import { useIsMobileOrTablet } from '../hooks/useIsMobile';
import DocLookup from '../components/DocLookup/DocLookup';
import FichaLlanta from '../components/FichaLlanta/FichaLlanta';

const S = {
  layout: null, // se define dinámicamente según isMobile
  card: { background: '#fff', borderRadius: 10, padding: 20, boxShadow: 'var(--shadow)', border: '1px solid var(--color-border)', marginBottom: 16 },
  cardTitle: { fontSize: 13, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 16, textTransform: 'uppercase' },
  input: { width: '100%', padding: '9px 12px', border: '1.5px solid var(--color-border)', borderRadius: 8, fontSize: 13 },
  select: { width: '100%', padding: '9px 12px', border: '1.5px solid var(--color-border)', borderRadius: 8, fontSize: 13 },
  label: { fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 5 },
  group: { marginBottom: 12 },
};

function ItemRow({ item, onRemove, onQtyChange }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#f8fafc', borderRadius: 8, marginBottom: 8 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{item.marca} {item.medida}</div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{item.sku} — S/ {parseFloat(item.precioUnit).toFixed(2)}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="number" min={1} value={item.cantidad} onChange={(e) => onQtyChange(parseInt(e.target.value) || 1)}
          style={{ width: 56, padding: '5px 8px', border: '1.5px solid var(--color-border)', borderRadius: 6, fontSize: 13, textAlign: 'center' }} />
        <span style={{ fontSize: 13, fontWeight: 700, minWidth: 75, textAlign: 'right' }}>S/ {(parseFloat(item.precioUnit) * item.cantidad).toFixed(2)}</span>
        <button onClick={onRemove} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: 16, cursor: 'pointer' }}>✕</button>
      </div>
    </div>
  );
}

export default function CotizacionNueva() {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobileOrTablet();
  const [clienteId, setClienteId] = useState(location.state?.clienteId || '');
  const [clienteInfo, setClienteInfo] = useState(null);
  const [clienteQuery, setClienteQuery] = useState('');
  const [productoQuery, setProductoQuery] = useState('');
  const [selectedProd, setSelectedProd] = useState(null);
  const [selectedSede, setSelectedSede] = useState('');
  const [items, setItems] = useState([]);
  const [descTipo, setDescTipo] = useState('');
  const [descValor, setDescValor] = useState('');
  const [descMotivo, setDescMotivo] = useState('');
  const [metodoPago, setMetodoPago] = useState('');

  const { data: clientes } = useQuery({
    queryKey: ['clientes-search', clienteQuery],
    queryFn: () => clientesApi.listar({ q: clienteQuery, limit: 8 }),
    enabled: clienteQuery.length > 1,
  });

  const { data: productos } = useQuery({
    queryKey: ['productos-search', productoQuery],
    queryFn: () => productosApi.listar({ q: productoQuery, limit: 10 }),
    enabled: productoQuery.length > 1,
  });

  const { data: sedes } = useQuery({ queryKey: ['sedes'], queryFn: sedesApi.listar });

  const crearMutation = useMutation({
    mutationFn: () => cotizacionesApi.crear({
      clienteId,
      items: items.map((i) => ({ productoId: i.productoId, sedeId: i.sedeId, cantidad: i.cantidad, precioUnit: i.precioUnit })),
      descuentoTipo: descTipo || undefined,
      descuentoValor: descValor ? parseFloat(descValor) : undefined,
      descuentoMotivo: descMotivo || undefined,
    }),
    onSuccess: (data) => { toast.success('Cotización creada'); navigate(`/cotizaciones/${data.id}`); },
    onError: (e) => toast.error(e?.error || 'Error al crear cotización'),
  });

  const addItem = () => {
    if (!selectedProd || !selectedSede) return;
    const existing = items.findIndex((i) => i.productoId === selectedProd.id && i.sedeId === selectedSede);
    if (existing >= 0) {
      setItems((prev) => prev.map((it, idx) => idx === existing ? { ...it, cantidad: it.cantidad + 1 } : it));
    } else {
      setItems((prev) => [...prev, {
        productoId: selectedProd.id, sedeId: selectedSede,
        cantidad: 1, precioUnit: parseFloat(selectedProd.precio),
        marca: selectedProd.marca, medida: selectedProd.medida, sku: selectedProd.sku,
      }]);
    }
    setSelectedProd(null);
    setProductoQuery('');
  };

  const subtotalBruto = items.reduce((a, i) => a + parseFloat(i.precioUnit) * i.cantidad, 0);
  let descuentoMonto = 0;
  if (descTipo === 'PORCENTAJE' && descValor > 0) descuentoMonto = subtotalBruto * (parseFloat(descValor) / 100);
  else if (descTipo === 'MONTO' && descValor > 0) descuentoMonto = parseFloat(descValor);
  const totalConDesc = subtotalBruto - descuentoMonto;
  const base = totalConDesc / 1.18;
  const igv = totalConDesc - base;

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
        <button onClick={() => navigate(-1)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: '#fff', cursor: 'pointer', fontSize: 13 }}>← Volver</button>
        <h1 style={{ fontSize: 18, fontWeight: 700 }}>Nueva Cotización</h1>
      </div>

      <div style={isMobile
        ? { display: 'flex', flexDirection: 'column', gap: 0 }
        : { display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20, alignItems: 'start' }
      }>
        {/* Columna principal */}
        <div>
          {/* Cliente */}
          <div style={S.card}>
            <div style={S.cardTitle}>1. Cliente</div>
            <div style={S.group}>
              <label style={S.label}>Buscar cliente</label>
              <input style={S.input} value={clienteQuery} onChange={(e) => setClienteQuery(e.target.value)} placeholder="Nombre, DNI o celular..." />
              {clientes?.data?.length > 0 && !clienteId && (
                <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden', marginTop: 4 }}>
                  {clientes.data.map((c) => {
                    const nombre = c.razonSocial || `${c.nombre || ''} ${c.apellidos || ''}`.trim();
                    return (
                      <div key={c.id} onClick={() => { setClienteId(c.id); setClienteInfo(c); setClienteQuery(nombre); }}
                        style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--color-border)', fontSize: 13, ':hover': { background: '#f8fafc' } }}>
                        <strong>{nombre}</strong> <span style={{ color: 'var(--color-text-muted)' }}>• {c.tipoDoc}: {c.numDoc} • {c.celular}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {clienteInfo && (
              <div style={{ padding: '10px 14px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0', fontSize: 13 }}>
                ✅ {clienteInfo.razonSocial || `${clienteInfo.nombre || ''} ${clienteInfo.apellidos || ''}`.trim()} — {clienteInfo.celular}
                <button onClick={() => { setClienteId(''); setClienteInfo(null); setClienteQuery(''); }} style={{ marginLeft: 8, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
              </div>
            )}
          </div>

          {/* Llantas */}
          <div style={S.card}>
            <div style={S.cardTitle}>2. Seleccionar llantas</div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 160px auto', gap: 8, marginBottom: 12 }}>
              <input style={S.input} value={productoQuery} onChange={(e) => setProductoQuery(e.target.value)} placeholder="Buscar llanta por medida, marca, SKU..." />
              <select style={S.select} value={selectedSede} onChange={(e) => setSelectedSede(e.target.value)}>
                <option value="">Sede...</option>
                {sedes?.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
              <button onClick={addItem} disabled={!selectedProd || !selectedSede} style={{ padding: '9px 16px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', gridColumn: isMobile ? '1 / -1' : undefined }}>
                + Agregar
              </button>
            </div>

            {productos?.data?.length > 0 && !selectedProd && productoQuery.length > 1 && (
              <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
                {productos.data.map((p) => (
                  <div key={p.id} onClick={() => { setSelectedProd(p); setProductoQuery(`${p.marca} ${p.medida}`); }}
                    style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--color-border)', fontSize: 13 }}>
                    <strong>{p.marca} {p.modelo}</strong> — <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{p.medida}</span>
                    <span style={{ float: 'right', fontWeight: 700 }}>S/ {parseFloat(p.precio).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}

            {selectedProd && <FichaLlanta productoId={selectedProd.id} compact />}

            <div style={{ marginTop: 12 }}>
              {items.map((item, idx) => (
                <ItemRow key={idx} item={item}
                  onRemove={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                  onQtyChange={(qty) => setItems((prev) => prev.map((it, i) => i === idx ? { ...it, cantidad: qty } : it))}
                />
              ))}
              {!items.length && <div style={{ fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center', padding: 20 }}>Sin productos agregados</div>}
            </div>
          </div>

          {/* Descuento */}
          <div style={S.card}>
            <div style={S.cardTitle}>3. Descuento (opcional)</div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1.5fr', gap: 12 }}>
              <div style={S.group}>
                <label style={S.label}>Tipo</label>
                <select style={S.select} value={descTipo} onChange={(e) => setDescTipo(e.target.value)}>
                  <option value="">Sin descuento</option>
                  <option value="PORCENTAJE">Porcentaje (%)</option>
                  <option value="MONTO">Monto fijo (S/)</option>
                </select>
              </div>
              <div style={S.group}>
                <label style={S.label}>Valor</label>
                <input style={S.input} type="number" min={0} value={descValor} onChange={(e) => setDescValor(e.target.value)} disabled={!descTipo} placeholder="0" />
              </div>
              <div style={{ ...S.group, gridColumn: isMobile ? '1 / -1' : undefined }}>
                <label style={S.label}>Motivo</label>
                <input style={S.input} value={descMotivo} onChange={(e) => setDescMotivo(e.target.value)} disabled={!descTipo} placeholder="Cliente frecuente..." />
              </div>
            </div>
          </div>
        </div>

        {/* Panel resumen */}
        <div style={isMobile ? { marginTop: 0 } : { position: 'sticky', top: 80 }}>
          <div style={S.card}>
            <div style={S.cardTitle}>Resumen</div>
            <div style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 12, marginBottom: 12 }}>
              {items.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                  <span>{item.cantidad}× {item.marca} {item.medida}</span>
                  <span>S/ {(parseFloat(item.precioUnit) * item.cantidad).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--color-text-muted)' }}>Subtotal (sin IGV)</span><span>S/ {base.toFixed(2)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--color-text-muted)' }}>IGV 18%</span><span>S/ {igv.toFixed(2)}</span></div>
              {descuentoMonto > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626' }}><span>Descuento</span><span>- S/ {descuentoMonto.toFixed(2)}</span></div>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: '2px solid var(--color-border)', fontWeight: 800, fontSize: 16 }}>
              <span>TOTAL</span><span style={{ color: 'var(--color-primary)' }}>S/ {totalConDesc.toFixed(2)}</span>
            </div>

            <div style={{ marginTop: 16 }}>
              <label style={S.label}>Método de pago</label>
              <select style={S.select} value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)}>
                <option value="">No especificado</option>
                <option value="EFECTIVO">Efectivo</option>
                <option value="TRANSFERENCIA">Transferencia</option>
                <option value="TARJETA">Tarjeta</option>
                <option value="YAPE">Yape/Plin</option>
              </select>
            </div>

            <button
              onClick={() => crearMutation.mutate()}
              disabled={!clienteId || !items.length || crearMutation.isPending}
              style={{ width: '100%', marginTop: 16, padding: '12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
            >
              {crearMutation.isPending ? 'Guardando...' : '✓ Crear cotización'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
