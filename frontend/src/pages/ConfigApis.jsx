import React, { useState } from 'react';
import toast from 'react-hot-toast';

const S = {
  card: { background: '#fff', borderRadius: 10, padding: 24, boxShadow: 'var(--shadow)', border: '1px solid var(--color-border)', marginBottom: 16 },
  cardTitle: { fontSize: 14, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 16 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px' },
  group: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: { fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)' },
  input: { padding: '9px 12px', border: '1.5px solid var(--color-border)', borderRadius: 8, fontSize: 13 },
  btn: { padding: '10px 20px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', marginTop: 14 },
  info: { padding: '12px 16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, fontSize: 12, color: '#1d4ed8', marginTop: 8 },
};

export default function ConfigApis() {
  const [form, setForm] = useState({
    dniUrl: '', dniKey: '',
    rucUrl: '', rucKey: '',
    ceUrl: '', ceKey: '',
  });

  const set = (f) => (e) => setForm((prev) => ({ ...prev, [f]: e.target.value }));

  const handleSave = () => {
    toast.success('Para aplicar los cambios, actualiza las variables de entorno en tu archivo .env y reinicia el servidor.');
  };

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Configuración de APIs externas</h1>

      <div style={S.info}>
        ℹ️ Las claves de API se guardan en las variables de entorno del servidor, no en la base de datos. Edita el archivo .env del backend y reinicia el servicio para aplicar cambios.
      </div>

      <div style={{ marginTop: 20 }}>
        {[
          { titulo: 'API de consulta DNI', urlKey: 'dniUrl', apiKey: 'dniKey', placeholder: 'https://api.ejemplo.com/dni/{numero}', var: 'API_DNI_URL / API_DNI_KEY' },
          { titulo: 'API de consulta RUC', urlKey: 'rucUrl', apiKey: 'rucKey', placeholder: 'https://api.ejemplo.com/ruc/{numero}', var: 'API_RUC_URL / API_RUC_KEY' },
          { titulo: 'API de consulta CE (Carnet extranjería)', urlKey: 'ceUrl', apiKey: 'ceKey', placeholder: 'https://api.ejemplo.com/ce/{numero}', var: 'API_CE_URL / API_CE_KEY' },
        ].map(({ titulo, urlKey, apiKey, placeholder, var: varName }) => (
          <div key={urlKey} style={S.card}>
            <div style={S.cardTitle}>{titulo}</div>
            <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--color-text-muted)', marginBottom: 12 }}>Variables: {varName}</div>
            <div style={S.grid}>
              <div style={S.group}>
                <label style={S.label}>URL del endpoint</label>
                <input style={S.input} value={form[urlKey]} onChange={set(urlKey)} placeholder={placeholder} />
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Usa {'{numero}'} donde va el número de documento</span>
              </div>
              <div style={S.group}>
                <label style={S.label}>API Key / Token</label>
                <input style={S.input} type="password" value={form[apiKey]} onChange={set(apiKey)} placeholder="Clave de autenticación" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Mapeo de campos (apiMapping.js)</div>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 12 }}>
          El archivo <code style={{ fontFamily: 'monospace', background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>/backend/src/config/apiMapping.js</code> define cómo se mapean los campos del JSON de cada API al modelo Cliente del CRM.
          Edita ese archivo directamente cuando tengas el JSON real de tu proveedor.
        </p>
        <pre style={{ background: '#1e293b', color: '#e2e8f0', borderRadius: 8, padding: 16, fontSize: 12, overflow: 'auto' }}>{`// Ejemplo: tu API DNI devuelve:
{ "nombres": "JUAN JOSE", "apellidoPaterno": "GARCIA", "apellidoMaterno": "LOPEZ", "direccion": "AV. LIMA 123" }

// El mapeo en apiMapping.js sería:
dni: {
  nombre: 'nombres',
  apellidos: ['apellidoPaterno', 'apellidoMaterno'],
  direccion: 'direccion'
}`}
        </pre>
      </div>

      <button style={S.btn} onClick={handleSave}>Guardar referencia</button>
    </div>
  );
}
