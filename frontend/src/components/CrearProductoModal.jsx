import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { productosApi, sedesApi, stockApi } from '../services/api';
import { useIsMobile } from '../hooks/useIsMobile';

const TIPO_OPCIONES = ['AUTO', 'CAMIONETA', 'CAMION', 'MOTO', 'SUV', 'BUS'];
const GRADOS = ['', 'A', 'B', 'C', 'D', 'E', 'F', 'G'];

const inp = { padding: '9px 11px', border: '1.5px solid var(--color-border)', borderRadius: 8, fontSize: 13, width: '100%', background: 'var(--color-surface)', color: 'var(--color-text)' };
const lbl = { fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: .4, marginBottom: 4, display: 'block' };

export default function CrearProductoModal({ onClose }) {
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const [f, setF] = useState({
    sku: '', medida: '', marca: '', nombreComercial: '', modelo: '', runFlat: '', tipoLlanta: '', tipoVehiculo: '', grupo: '',
    precioRegular: '', precioOferta: '', descuentoMaximo: '',
    indice_carga: '', velocidad_max: '', cargaMaxNeumatico: '', velocidadMaxKmh: '',
    eficienciaCombustible: '', eficienciaFrenado: '', nivelRuido: '',
    paisFabricacion: '', origenMarca: '', garantia: '', fichaTecnica: '',
  });
  const set = (k) => (e) => setF(p => ({ ...p, [k]: e.target.value }));

  const { data: sedes = [] } = useQuery({ queryKey: ['sedes'], queryFn: sedesApi.listar, staleTime: Infinity });
  const [stock, setStock] = useState({}); // { sedeId: cantidad }
  const setStk = (sedeId) => (e) => setStock(p => ({ ...p, [sedeId]: e.target.value }));

  const crear = useMutation({
    mutationFn: async () => {
      const num = (v) => v === '' || v == null ? undefined : Number(String(v).replace(',', '.'));
      const int = (v) => v === '' || v == null ? undefined : parseInt(v);
      const str = (v) => (v && String(v).trim()) ? String(v).trim() : undefined;
      const data = {
        sku: f.sku.trim(), medida: f.medida.trim(), marca: f.marca.trim(),
        nombreComercial: str(f.nombreComercial), modelo: str(f.modelo),
        runFlat: f.runFlat === '' ? undefined : f.runFlat === 'si',
        tipoLlanta: str(f.tipoLlanta), tipoVehiculo: str(f.tipoVehiculo),
        grupo: str(f.grupo),
        precioRegular: num(f.precioRegular),
        precioOferta: num(f.precioOferta), descuentoMaximo: num(f.descuentoMaximo),
        indice_carga: str(f.indice_carga), velocidad_max: str(f.velocidad_max),
        cargaMaxNeumatico: int(f.cargaMaxNeumatico), velocidadMaxKmh: int(f.velocidadMaxKmh),
        eficienciaCombustible: str(f.eficienciaCombustible), eficienciaFrenado: str(f.eficienciaFrenado),
        nivelRuido: int(f.nivelRuido), paisFabricacion: str(f.paisFabricacion), origenMarca: str(f.origenMarca),
        garantia: str(f.garantia), fichaTecnica: str(f.fichaTecnica),
      };
      Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);
      const prod = await productosApi.crear(data);
      // Stock inicial por almacén
      const entradas = Object.entries(stock).filter(([, v]) => v !== '' && parseInt(v) > 0);
      if (prod?.id && entradas.length) {
        await Promise.all(entradas.map(([sedeId, v]) => stockApi.actualizar(prod.id, sedeId, { cantidad: parseInt(v) })));
      }
      return prod;
    },
    onSuccess: () => {
      toast.success('Producto creado');
      qc.invalidateQueries({ queryKey: ['productos'] });
      qc.invalidateQueries({ queryKey: ['stock'] });
      onClose();
    },
    onError: (e) => toast.error(e?.error || e?.message || 'No se pudo crear el producto'),
  });

  const submit = (e) => {
    e.preventDefault();
    if (!f.sku.trim() || !f.medida.trim() || !f.marca.trim() || f.precioRegular === '') {
      toast.error('Completa SKU, medida, marca y precio regular');
      return;
    }
    crear.mutate();
  };

  const grid = { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 };
  const sec = { fontSize: 12, fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: 1, margin: '6px 0 2px', borderBottom: '2px solid #f5c400', paddingBottom: 4 };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }} onClick={onClose}>
      <form onClick={e => e.stopPropagation()} onSubmit={submit}
        style={{ background: 'var(--color-surface)', borderRadius: 14, width: '100%', maxWidth: 720, maxHeight: '93dvh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,.4)' }}>
        <div style={{ position: 'sticky', top: 0, background: 'var(--color-surface)', padding: '16px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 1 }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>➕ Crear producto (llanta)</h2>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--color-text-muted)' }}>✕</button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={sec}>Datos principales</div>
          <div style={grid}>
            <div><label style={lbl}>SKU *</label><input style={inp} value={f.sku} onChange={set('sku')} placeholder="Ej: LL-001" required /></div>
            <div><label style={lbl}>Medida *</label><input style={inp} value={f.medida} onChange={set('medida')} placeholder="Ej: 195/65R15" required /></div>
            <div><label style={lbl}>Marca *</label><input style={inp} value={f.marca} onChange={set('marca')} placeholder="Ej: BRIDGESTONE" required /></div>
            <div><label style={lbl}>Nombre comercial</label><input style={inp} value={f.nombreComercial} onChange={set('nombreComercial')} placeholder="Ej: Turanza ER300" /></div>
            <div><label style={lbl}>Modelo</label><input style={inp} value={f.modelo} onChange={set('modelo')} placeholder="Ej: ER300" /></div>
            <div><label style={lbl}>Run-Flat</label><select style={inp} value={f.runFlat} onChange={set('runFlat')}><option value="">—</option><option value="si">Sí</option><option value="no">No</option></select></div>
            <div><label style={lbl}>Tipo de llanta</label><input style={inp} value={f.tipoLlanta} onChange={set('tipoLlanta')} placeholder="Carga, Ciudad, MT, AT…" /></div>
            <div><label style={lbl}>Tipo de vehículo</label><input style={inp} list="tipos-dl" value={f.tipoVehiculo} onChange={set('tipoVehiculo')} placeholder="Pick up, Sedán, Transporte…" /><datalist id="tipos-dl">{TIPO_OPCIONES.map(t => <option key={t} value={t} />)}</datalist></div>
            <div><label style={lbl}>Grupo</label><input style={inp} value={f.grupo} onChange={set('grupo')} placeholder="Turismo, SUV…" /></div>
          </div>

          <div style={sec}>Precios</div>
          <div style={grid}>
            <div><label style={lbl}>Precio regular (S/) *</label><input style={inp} type="number" step="0.01" value={f.precioRegular} onChange={set('precioRegular')} placeholder="250.00" required /></div>
            <div><label style={lbl}>Precio oferta (S/)</label><input style={inp} type="number" step="0.01" value={f.precioOferta} onChange={set('precioOferta')} placeholder="opcional" /></div>
            <div><label style={lbl}>Descuento máx. (%)</label><input style={inp} type="number" step="0.01" value={f.descuentoMaximo} onChange={set('descuentoMaximo')} placeholder="opcional" /></div>
          </div>

          <div style={sec}>Ficha técnica (opcional)</div>
          <div style={grid}>
            <div><label style={lbl}>Índice de carga</label><input style={inp} value={f.indice_carga} onChange={set('indice_carga')} placeholder="Ej: 91" /></div>
            <div><label style={lbl}>Índice de velocidad</label><input style={inp} value={f.velocidad_max} onChange={set('velocidad_max')} placeholder="Ej: H" /></div>
            <div><label style={lbl}>Carga máx. (kg)</label><input style={inp} type="number" value={f.cargaMaxNeumatico} onChange={set('cargaMaxNeumatico')} placeholder="615" /></div>
            <div><label style={lbl}>Velocidad máx. (km/h)</label><input style={inp} type="number" value={f.velocidadMaxKmh} onChange={set('velocidadMaxKmh')} placeholder="210" /></div>
            <div><label style={lbl}>Eficiencia combustible</label><select style={inp} value={f.eficienciaCombustible} onChange={set('eficienciaCombustible')}>{GRADOS.map(g => <option key={g} value={g}>{g || '—'}</option>)}</select></div>
            <div><label style={lbl}>Frenado en mojado</label><select style={inp} value={f.eficienciaFrenado} onChange={set('eficienciaFrenado')}>{GRADOS.map(g => <option key={g} value={g}>{g || '—'}</option>)}</select></div>
            <div><label style={lbl}>Nivel de ruido (dB)</label><input style={inp} type="number" value={f.nivelRuido} onChange={set('nivelRuido')} placeholder="71" /></div>
            <div><label style={lbl}>Garantía</label><input style={inp} value={f.garantia} onChange={set('garantia')} placeholder="Ej: 5 años / 60,000 km" /></div>
            <div><label style={lbl}>País de fabricación</label><input style={inp} value={f.paisFabricacion} onChange={set('paisFabricacion')} placeholder="Ej: Japón" /></div>
            <div><label style={lbl}>Origen de marca</label><input style={inp} value={f.origenMarca} onChange={set('origenMarca')} placeholder="Ej: Japón" /></div>
          </div>
          <div><label style={lbl}>Ficha técnica (texto libre)</label><textarea style={{ ...inp, minHeight: 70, resize: 'vertical' }} value={f.fichaTecnica} onChange={set('fichaTecnica')} placeholder="Detalles adicionales…" /></div>

          <div style={sec}>Stock inicial por almacén</div>
          {sedes.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>No hay almacenes registrados.</div>
          ) : (
            <div style={grid}>
              {sedes.map(s => (
                <div key={s.id}>
                  <label style={lbl}>{s.codigoLocal ? `${s.codigoLocal} · ` : ''}{s.nombre}</label>
                  <input style={inp} type="number" min="0" value={stock[s.id] ?? ''} onChange={setStk(s.id)} placeholder="0" />
                </div>
              ))}
            </div>
          )}

          <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', background: 'var(--color-bg)', borderRadius: 8, padding: '8px 11px' }}>
            💡 El stock que dejes vacío queda en 0; lo puedes ajustar luego en el inventario. Los datos técnicos vacíos se completan con IA al editar el producto.
          </div>
        </div>

        <div style={{ position: 'sticky', bottom: 0, background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)', padding: '12px 20px', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" onClick={onClose} style={{ padding: '10px 16px', borderRadius: 9, border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
          <button type="submit" disabled={crear.isPending} style={{ padding: '10px 20px', borderRadius: 9, border: 'none', background: '#16a34a', color: '#fff', fontWeight: 800, fontSize: 13, cursor: crear.isPending ? 'wait' : 'pointer' }}>{crear.isPending ? 'Creando…' : '➕ Crear producto'}</button>
        </div>
      </form>
    </div>
  );
}
