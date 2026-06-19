import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { adminApi } from '../services/api';
import { useIsMobile } from '../hooks/useIsMobile';
import LoadingSpinner from '../components/common/LoadingSpinner';

const ESTADO_UI = {
  ok:             { color: '#16a34a', bg: '#dcfce7', icon: '✅', txt: 'Funcionando' },
  responde:       { color: '#16a34a', bg: '#dcfce7', icon: '✅', txt: 'Conectada' },
  configurada:    { color: '#2563eb', bg: '#dbeafe', icon: 'ℹ️', txt: 'Configurada' },
  error:          { color: '#dc2626', bg: '#fee2e2', icon: '❌', txt: 'Error' },
  no_configurada: { color: '#b45309', bg: '#fef3c7', icon: '⚠️', txt: 'No configurada' },
};

const S = {
  card: { background: '#fff', borderRadius: 10, padding: 24, boxShadow: 'var(--shadow)', border: '1px solid var(--color-border)', marginBottom: 16 },
  cardTitle: { fontSize: 14, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 16 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px' },
  group: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: { fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)' },
  input: { padding: '9px 12px', border: '1.5px solid var(--color-border)', borderRadius: 8, fontSize: 13, width: '100%' },
  btn: { padding: '10px 20px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  info: { padding: '12px 16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, fontSize: 12, color: '#1d4ed8' },
};

// Definición de los servicios y sus campos
const SERVICIOS = [
  { titulo: 'Consulta DNI',  urlKey: 'dniUrl', keyKey: 'dniKey', keySet: 'dniKeySet', placeholder: 'https://api.ejemplo.com/dni/{numero}' },
  { titulo: 'Consulta RUC',  urlKey: 'rucUrl', keyKey: 'rucKey', keySet: 'rucKeySet', placeholder: 'https://api.ejemplo.com/ruc/{numero}' },
  { titulo: 'Consulta CE (carné de extranjería)', urlKey: 'ceUrl', keyKey: 'ceKey', keySet: 'ceKeySet', placeholder: 'https://api.ejemplo.com/ce/{numero}' },
];

export default function ConfigApis() {
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const gridStyle = { ...S.grid, gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr' };
  const { data: cfg, isLoading } = useQuery({ queryKey: ['config-apis'], queryFn: adminApi.getConfigApis });

  const [form, setForm] = useState({
    dniUrl: '', rucUrl: '', ceUrl: '', factilizaUrl: '',
    dniKey: '', rucKey: '', ceKey: '',
    factilizaToken: '', groqKey: '', geminiKey: '',
    iaPrioridad: 'groq', groqActivo: true, geminiActivo: true,
  });
  useEffect(() => {
    if (cfg) setForm((f) => ({ ...f, dniUrl: cfg.dniUrl || '', rucUrl: cfg.rucUrl || '', ceUrl: cfg.ceUrl || '', factilizaUrl: cfg.factilizaUrl || '',
      iaPrioridad: cfg.iaPrioridad || 'groq', groqActivo: cfg.groqActivo !== false, geminiActivo: cfg.geminiActivo !== false }));
  }, [cfg]);

  const set = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }));

  const guardar = useMutation({
    mutationFn: () => {
      // URLs siempre; claves solo si se escribió algo (vacío = no cambiar)
      const payload = { dniUrl: form.dniUrl, rucUrl: form.rucUrl, ceUrl: form.ceUrl, factilizaUrl: form.factilizaUrl,
        iaPrioridad: form.iaPrioridad, groqActivo: form.groqActivo, geminiActivo: form.geminiActivo };
      ['dniKey', 'rucKey', 'ceKey', 'factilizaToken', 'groqKey', 'geminiKey'].forEach((k) => {
        if (form[k] && form[k].trim()) payload[k] = form[k].trim();
      });
      return adminApi.saveConfigApis(payload);
    },
    onSuccess: () => {
      toast.success('Configuración guardada. Se aplica de inmediato (sin reiniciar).');
      setForm((p) => ({ ...p, dniKey: '', rucKey: '', ceKey: '', factilizaToken: '', groqKey: '', geminiKey: '' }));
      qc.invalidateQueries({ queryKey: ['config-apis'] });
    },
    onError: () => toast.error('No se pudo guardar la configuración'),
  });

  // Probador en vivo
  const [diag, setDiag] = useState(null);
  const [probando, setProbando] = useState(false);
  const probar = async () => {
    setProbando(true);
    try { const r = await adminApi.diagnosticoApis(); setDiag(r.apis); }
    catch { toast.error('No se pudo ejecutar el diagnóstico'); }
    finally { setProbando(false); }
  };

  const keyPlaceholder = (isSet) => (isSet ? '•••••••• (configurada — déjala vacía para no cambiar)' : 'Sin configurar');

  if (isLoading) return <LoadingSpinner fullPage />;

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Configuración de APIs externas</h1>

      <div style={S.info}>
        🔒 Solo administradores. Las claves se guardan cifradas en la base de datos del CRM y se aplican <b>de inmediato</b>, sin reiniciar el servidor ni editar archivos.
      </div>

      {/* Probador en vivo */}
      <div style={{ ...S.card, marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div style={S.cardTitle}>Estado de las APIs de búsqueda</div>
          <button style={{ ...S.btn, opacity: probando ? 0.7 : 1 }} onClick={probar} disabled={probando}>
            {probando ? 'Probando…' : '🔍 Probar conexión'}
          </button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 0 }}>
          Hace una consulta de prueba real a cada servicio (DNI, RUC, CE, placa e IA de versiones) y muestra si responden.
        </p>
        {diag && (
          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            {Object.values(diag).map((a) => {
              const ui = ESTADO_UI[a.estado] || ESTADO_UI.error;
              return (
                <div key={a.servicio} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8, background: ui.bg }}>
                  <span style={{ fontSize: 16 }}>{ui.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{a.servicio}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{a.mensaje}</div>
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 12, color: ui.color, whiteSpace: 'nowrap' }}>{ui.txt}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* DNI / RUC / CE */}
      {SERVICIOS.map((sv) => (
        <div key={sv.urlKey} style={S.card}>
          <div style={S.cardTitle}>{sv.titulo}</div>
          <div style={gridStyle}>
            <div style={S.group}>
              <label style={S.label}>URL del endpoint</label>
              <input style={S.input} value={form[sv.urlKey]} onChange={set(sv.urlKey)} placeholder={sv.placeholder} />
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Usa {'{numero}'} donde va el documento (o se agrega al final).</span>
            </div>
            <div style={S.group}>
              <label style={S.label}>API Key / Token</label>
              <input style={S.input} type="password" value={form[sv.keyKey]} onChange={set(sv.keyKey)} placeholder={keyPlaceholder(cfg?.[sv.keySet])} />
            </div>
          </div>
        </div>
      ))}

      {/* Placa */}
      <div style={S.card}>
        <div style={S.cardTitle}>Consulta de placa</div>
        <div style={gridStyle}>
          <div style={S.group}>
            <label style={S.label}>URL del endpoint</label>
            <input style={S.input} value={form.factilizaUrl} onChange={set('factilizaUrl')} placeholder="https://api.tu-proveedor.com/placa/{placa}" />
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Usa {'{placa}'} donde va la placa (o se agrega al final). Cámbiala si cambias de proveedor.</span>
          </div>
          <div style={S.group}>
            <label style={S.label}>Token / API Key</label>
            <input style={S.input} type="password" value={form.factilizaToken} onChange={set('factilizaToken')} placeholder={keyPlaceholder(cfg?.factilizaTokenSet)} />
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Se envía como <code>Authorization: Bearer</code>.</span>
          </div>
        </div>
      </div>

      {/* IA */}
      <div style={S.card}>
        <div style={S.cardTitle}>IA (rellenar ficha y versiones de vehículo)</div>

        {/* Prioridad + activación */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={S.label}>Prioridad:</span>
            {[['groq', 'Groq primero'], ['gemini', 'Gemini primero']].map(([k, lab]) => (
              <button key={k} type="button" onClick={() => setForm(p => ({ ...p, iaPrioridad: k }))}
                style={{ padding: '6px 12px', borderRadius: 8, border: `1.5px solid ${form.iaPrioridad === k ? '#6366f1' : 'var(--color-border)'}`, background: form.iaPrioridad === k ? '#eef2ff' : 'var(--color-surface)', color: form.iaPrioridad === k ? '#4338ca' : 'var(--color-text)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                {lab}
              </button>
            ))}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.groqActivo} onChange={e => setForm(p => ({ ...p, groqActivo: e.target.checked }))} style={{ accentColor: '#16a34a' }} /> Groq activo
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.geminiActivo} onChange={e => setForm(p => ({ ...p, geminiActivo: e.target.checked }))} style={{ accentColor: '#16a34a' }} /> Gemini activo
          </label>
        </div>

        <div style={gridStyle}>
          <div style={S.group}>
            <label style={S.label}>Groq API Key {!form.groqActivo && '(desactivada)'}</label>
            <input style={{ ...S.input, opacity: form.groqActivo ? 1 : 0.5 }} type="password" value={form.groqKey} onChange={set('groqKey')} placeholder={keyPlaceholder(cfg?.groqKeySet)} />
          </div>
          <div style={S.group}>
            <label style={S.label}>Gemini API Key {!form.geminiActivo && '(desactivada)'}</label>
            <input style={{ ...S.input, opacity: form.geminiActivo ? 1 : 0.5 }} type="password" value={form.geminiKey} onChange={set('geminiKey')} placeholder={keyPlaceholder(cfg?.geminiKeySet)} />
          </div>
        </div>
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
          Se intenta primero la IA con prioridad; si falla o está desactivada, usa la otra (si está activa). Si desactivas una, no se usa aunque tenga clave.
        </span>
      </div>

      <button style={{ ...S.btn, padding: '12px 28px' }} onClick={() => guardar.mutate()} disabled={guardar.isPending}>
        {guardar.isPending ? 'Guardando…' : '💾 Guardar configuración'}
      </button>

      <div style={{ ...S.info, marginTop: 16, background: '#f8fafc', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
        Nota: el mapeo de campos del JSON de cada proveedor al cliente del CRM se define en <code>/backend/src/config/apiMapping.js</code>. Ajústalo si tu proveedor devuelve nombres de campo distintos.
      </div>
    </div>
  );
}
