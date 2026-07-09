import React, { useState } from 'react';
import toast from 'react-hot-toast';

// Normaliza un teléfono peruano a formato internacional sin "+": 9 dígitos → 51XXXXXXXXX
export function normalizarTelefono(tel) {
  const d = String(tel || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.length === 9 && d.startsWith('9')) return '51' + d;     // celular peruano sin código
  if (d.length === 11 && d.startsWith('51')) return d;          // ya tiene 51
  if (d.length === 12 && d.startsWith('051')) return d.slice(1);
  return d;
}

// Construye el enlace de WhatsApp.
// En celular usa wa.me (abre la app); en escritorio usa WhatsApp Web directamente
// (evita la página de "descarga WhatsApp" que muestra wa.me en PC).
export function waLink(tel, texto) {
  const t = normalizarTelefono(tel);
  if (!t) return null;
  const esMovil = typeof navigator !== 'undefined' &&
    /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(navigator.userAgent || '');
  if (esMovil) {
    return `https://wa.me/${t}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`;
  }
  return `https://web.whatsapp.com/send?phone=${t}${texto ? `&text=${encodeURIComponent(texto)}` : ''}`;
}

// Abre WhatsApp con el teléfono del cliente (chat directo)
export function BotonWhatsApp({ telefono, texto, label = 'WhatsApp', size = 'sm', style = {} }) {
  const link = waLink(telefono, texto);
  if (!link) return null;
  const pad = size === 'lg' ? '11px 16px' : '5px 10px';
  const fs = size === 'lg' ? 14 : 11.5;
  return (
    <a
      href={link} target="_blank" rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title={`Conversar por WhatsApp con ${normalizarTelefono(telefono)}`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: pad, fontSize: fs, fontWeight: 700, background: '#25D366', color: '#fff', borderRadius: 8, textDecoration: 'none', whiteSpace: 'nowrap', border: 'none', cursor: 'pointer', ...style }}
    >
      <span style={{ fontSize: fs + 2 }}>🟢</span> {label}
    </a>
  );
}

/**
 * Abre en una pestaña nueva la URL que devuelve una función async (ej. generar
 * un PDF). La pestaña se abre en blanco DENTRO del gesto del usuario (clic),
 * antes de esperar la respuesta — así el navegador nunca la bloquea como
 * pop-up, aunque el backend tarde un momento en responder. Recién se redirige
 * cuando la URL está lista.
 */
export async function abrirAsync(fn, { onError } = {}) {
  const win = window.open('', '_blank');
  try {
    const r = await fn();
    const url = r?.pdfUrl;
    if (!url) throw new Error('No se generó el archivo');
    if (win && !win.closed) win.location.href = url;
    else window.location.href = url; // fallback si la pestaña fue bloqueada igual
  } catch (err) {
    if (win && !win.closed) win.close();
    if (onError) onError(err);
    else toast.error(err?.error || err?.message || 'No se pudo generar el archivo');
  }
}

/**
 * Genera un PDF (vía la función pdfFn que devuelve { pdfUrl }) y ofrece
 * abrirlo por WhatsApp con un mensaje que incluye el enlace público al PDF.
 *
 * Flujo en 2 pasos a propósito: "Enviar" genera el PDF, y una vez listo el
 * botón se convierte en un link real "Abrir WhatsApp" que el usuario hace
 * clic él mismo. Se probó el patrón de abrir una pestaña en blanco y
 * redirigirla luego (como hace abrirAsync) y en varios casos WhatsApp se
 * queda pegado en su pantalla de "Open app" sin completar la apertura,
 * porque esa navegación ya no ocurre dentro de un clic directo y confiable
 * del usuario. Un segundo clic real sobre un <a> es lo único que funciona
 * de forma consistente en PC y celular.
 */
export function BotonEnviarPdfWhatsApp({ telefono, pdfFn, tipo = 'documento', mensajeBase, size = 'sm', style = {} }) {
  const [estado, setEstado] = useState('idle'); // idle | cargando | listo
  const [link, setLink] = useState(null);
  const tel = normalizarTelefono(telefono);
  if (!tel) return null;

  const generar = async (e) => {
    e.stopPropagation();
    if (estado === 'cargando') return;
    setEstado('cargando');
    try {
      const r = await pdfFn();
      if (!r?.pdfUrl) throw new Error('No se generó el PDF');
      const url = r.pdfUrl.startsWith('http') ? r.pdfUrl : `${window.location.origin}${r.pdfUrl}`;
      const texto = `${mensajeBase || `Hola, te comparto tu ${tipo} de Llantaland`}:\n${url}`;
      setLink(waLink(tel, texto));
      setEstado('listo');
    } catch (err) {
      toast.error(err?.error || err?.message || 'No se pudo generar el PDF');
      setEstado('idle');
    }
  };

  const pad = size === 'lg' ? '11px 16px' : '5px 10px';
  const fs = size === 'lg' ? 14 : 11.5;

  if (estado === 'listo' && link) {
    return (
      <a
        href={link} target="_blank" rel="noopener noreferrer"
        onClick={(e) => { e.stopPropagation(); setTimeout(() => setEstado('idle'), 400); }}
        title={`Abrir WhatsApp con ${tel}`}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: pad, fontSize: fs, fontWeight: 700, background: '#25D366', color: '#fff', borderRadius: 8, textDecoration: 'none', whiteSpace: 'nowrap', border: 'none', cursor: 'pointer', ...style }}
      >
        <span style={{ fontSize: fs + 2 }}>✅</span> Abrir WhatsApp
      </a>
    );
  }

  return (
    <button
      onClick={generar} disabled={estado === 'cargando'}
      title={`Enviar ${tipo} por WhatsApp`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: pad, fontSize: fs, fontWeight: 700, background: estado === 'cargando' ? '#94a3b8' : '#128C7E', color: '#fff', borderRadius: 8, border: 'none', cursor: estado === 'cargando' ? 'wait' : 'pointer', whiteSpace: 'nowrap', ...style }}
    >
      <span style={{ fontSize: fs + 2 }}>📤</span> {estado === 'cargando' ? 'Generando...' : `Enviar ${tipo}`}
    </button>
  );
}
