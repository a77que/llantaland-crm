import React, { useState, useRef } from 'react';
import { clientesApi } from '../../services/api';

const DOC_CONFIG = {
  DNI:      { label: 'DNI', maxLength: 8, placeholder: '12345678' },
  RUC:      { label: 'RUC', maxLength: 11, placeholder: '20123456789' },
  CE:       { label: 'Carnet Extranjería', maxLength: 12, placeholder: 'Número CE' },
  PASAPORTE:{ label: 'Pasaporte', maxLength: 20, placeholder: 'Número pasaporte' },
};

const S = {
  wrapper: { marginBottom: 16 },
  row: { display: 'flex', gap: 8 },
  tipoSelect: {
    padding: '9px 12px', border: '1.5px solid var(--color-border)', borderRadius: 8,
    fontSize: 13, background: '#fff', flexShrink: 0, minWidth: 170,
  },
  inputWrapper: { position: 'relative', flex: 1 },
  input: (state) => ({
    width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13, outline: 'none',
    border: `1.5px solid ${state === 'ok' ? '#16a34a' : state === 'error' ? '#dc2626' : state === 'loading' ? '#2563eb' : 'var(--color-border)'}`,
    background: state === 'ok' ? '#f0fdf4' : state === 'error' ? '#fef2f2' : state === 'loading' ? '#eff6ff' : '#fff',
    transition: 'border-color .2s, background .2s',
  }),
  searchBtn: {
    padding: '9px 16px', background: 'var(--color-primary)', color: '#fff',
    border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
  },
  statusMsg: (state) => ({
    marginTop: 6, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5,
    color: state === 'ok' ? '#16a34a' : state === 'error' ? '#dc2626' : state === 'loading' ? '#2563eb' : 'transparent',
  }),
  resultBox: {
    marginTop: 10, padding: '12px 14px', borderRadius: 8,
    border: '1px solid var(--color-border)', background: '#f8fafc', fontSize: 13,
  },
  extraJson: { marginTop: 8, padding: '8px 10px', background: '#1e293b', color: '#e2e8f0', borderRadius: 6, fontSize: 10, fontFamily: 'monospace', maxHeight: 100, overflow: 'auto' },
};

/**
 * Componente de autocompletado de documentos de identidad.
 * Props:
 *   tipoDoc, numDoc — valores controlados
 *   onTipoChange(tipo) — callback al cambiar tipo
 *   onNumDocChange(num) — callback al escribir número
 *   onResult(datos, rawJson) — callback cuando la API devuelve datos
 */
export default function DocLookup({ tipoDoc, numDoc, onTipoChange, onNumDocChange, onResult }) {
  const [state, setState] = useState('idle'); // idle | loading | ok | error
  const [msg, setMsg] = useState('');
  const [resultData, setResultData] = useState(null);
  const [crmExistente, setCrmExistente] = useState(null);
  const timeoutRef = useRef(null);

  const config = DOC_CONFIG[tipoDoc] || DOC_CONFIG.DNI;

  const buscar = async (num = numDoc) => {
    const n = String(num).trim();
    if (!n) return;
    setState('loading');
    setMsg('Consultando...');
    setResultData(null);
    setCrmExistente(null);

    try {
      const resp = await clientesApi.lookup({ tipoDoc, numDoc: n });

      if (resp.encontrado) {
        setResultData(resp.datos);
        setState('ok');
        setMsg('Datos encontrados ✓');
        if (onResult) onResult(resp.datos, resp.rawJson);

        // Buscar si ya existe en el CRM
        try {
          const existing = await clientesApi.buscar(n);
          if (existing?.length > 0) setCrmExistente(existing[0]);
        } catch (_) {}
      } else {
        setState('error');
        setMsg(resp.mensaje || `No se encontró ${tipoDoc}: ${n}`);
        if (onResult) onResult({}, null);
      }
    } catch (err) {
      setState('error');
      setMsg(err?.mensaje || err?.error || 'Error al consultar la API');
    }
  };

  const handleNumChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, config.maxLength);
    onNumDocChange(val);
    setState('idle');
    setMsg('');
    setResultData(null);
    setCrmExistente(null);

    // Auto-buscar al completar todos los dígitos
    if (val.length === config.maxLength && tipoDoc !== 'PASAPORTE') {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => buscar(val), 300);
    }
  };

  const icons = { idle: '', loading: '⏳', ok: '✅', error: '❌' };

  return (
    <div style={S.wrapper}>
      <div style={S.row}>
        <select style={S.tipoSelect} value={tipoDoc} onChange={(e) => { onTipoChange(e.target.value); setState('idle'); setMsg(''); setResultData(null); }}>
          {Object.entries(DOC_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>

        <div style={S.inputWrapper}>
          <input
            style={S.input(state)}
            value={numDoc}
            onChange={handleNumChange}
            placeholder={config.placeholder}
            maxLength={config.maxLength}
            inputMode="numeric"
          />
        </div>

        <button style={S.searchBtn} onClick={() => buscar()} disabled={state === 'loading' || !numDoc.trim()}>
          {state === 'loading' ? '...' : '🔍 Buscar'}
        </button>
      </div>

      {msg && (
        <div style={S.statusMsg(state)}>
          {icons[state]} {msg}
        </div>
      )}

      {resultData && Object.keys(resultData).length > 0 && (
        <div style={S.resultBox}>
          <div style={{ fontWeight: 700, marginBottom: 6, color: '#16a34a' }}>Datos encontrados:</div>
          {resultData.nombre && <div><strong>Nombre:</strong> {resultData.nombre}</div>}
          {resultData.apellidos && <div><strong>Apellidos:</strong> {resultData.apellidos}</div>}
          {resultData.razonSocial && <div><strong>Razón Social:</strong> {resultData.razonSocial}</div>}
          {resultData.direccion && <div><strong>Dirección:</strong> {resultData.direccion}</div>}
        </div>
      )}

      {crmExistente && (
        <div style={{ ...S.resultBox, background: '#fffbeb', border: '1px solid #fde047', marginTop: 8 }}>
          <div style={{ fontWeight: 700, color: '#92400e', marginBottom: 4 }}>⚠️ Cliente ya registrado en CRM</div>
          <div style={{ fontSize: 13 }}>
            <strong>{crmExistente.razonSocial || `${crmExistente.nombre || ''} ${crmExistente.apellidos || ''}`.trim()}</strong>
            {' '}— Cel: {crmExistente.celular || '—'}
            {' '}— <a href={`/clientes/${crmExistente.id}`} style={{ color: '#2563eb' }}>Ver ficha →</a>
          </div>
        </div>
      )}
    </div>
  );
}
