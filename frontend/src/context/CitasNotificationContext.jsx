import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { citasApi } from '../services/api';
import { useAuth } from '../hooks/useAuth';

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    [
      { freq: 660,  start: 0,    dur: 0.15 },
      { freq: 990,  start: 0.12, dur: 0.15 },
      { freq: 1320, start: 0.25, dur: 0.22 },
    ].forEach(({ freq, start, dur }) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur + 0.05);
    });
  } catch { /* AudioContext no soportado */ }
}

const LABEL_NEGOCIO = { LLANTAS: 'Llantaland', PATRON: 'Sorprendete Perú' };

const CitasNotificationContext = createContext({
  nuevasIds: new Set(),
  marcarVisto: () => {},
  marcarTodosVistos: () => {},
  count: 0,
  countLlantas: 0,
  countPatron: 0,
});

// Mismo patrón que LeadsNotificationContext: un poll independiente por negocio,
// con su propio set de "vistos" y su propio localStorage namespaced.
function useNegocioPoll(tipoNegocio) {
  const [unreadIds, setUnreadIds] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(`citas_unread_ids_${tipoNegocio}`) || '[]'));
    } catch { return new Set(); }
  });

  const seenIdsRef = useRef((() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(`citas_seen_ids_${tipoNegocio}`) || '[]'));
    } catch { return new Set(); }
  })());

  const marcarVisto = useCallback((id) => {
    setUnreadIds(prev => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      localStorage.setItem(`citas_unread_ids_${tipoNegocio}`, JSON.stringify([...next]));
      return next;
    });
  }, [tipoNegocio]);

  const marcarTodosVistos = useCallback(() => {
    setUnreadIds(new Set());
    localStorage.setItem(`citas_unread_ids_${tipoNegocio}`, JSON.stringify([]));
  }, [tipoNegocio]);

  const { data } = useQuery({
    queryKey: ['citas-notif-poll', tipoNegocio],
    queryFn: () => citasApi.poll({ tipoNegocio }),
    refetchInterval: 20_000,
    staleTime: 0,
  });

  useEffect(() => {
    if (!data) return;
    const currentIds = data.ids || [];
    const currentSet = new Set(currentIds);

    setUnreadIds(prev => {
      if (prev.size === 0) return prev;
      const reconciled = new Set([...prev].filter(id => currentSet.has(id)));
      if (reconciled.size !== prev.size) {
        localStorage.setItem(`citas_unread_ids_${tipoNegocio}`, JSON.stringify([...reconciled]));
        return reconciled;
      }
      return prev;
    });

    if (seenIdsRef.current.size === 0 && currentIds.length > 0) {
      currentIds.forEach(id => seenIdsRef.current.add(id));
      localStorage.setItem(`citas_seen_ids_${tipoNegocio}`, JSON.stringify(currentIds.slice(-1000)));
      return;
    }

    const nuevasArr = currentIds.filter(id => !seenIdsRef.current.has(id));
    if (nuevasArr.length === 0) return;

    nuevasArr.forEach(id => seenIdsRef.current.add(id));
    localStorage.setItem(`citas_seen_ids_${tipoNegocio}`, JSON.stringify([...seenIdsRef.current].slice(-1000)));

    setUnreadIds(prev => {
      const next = new Set(prev);
      nuevasArr.forEach(id => next.add(id));
      localStorage.setItem(`citas_unread_ids_${tipoNegocio}`, JSON.stringify([...next]));
      return next;
    });

    playNotificationSound();

    if (document.hidden && Notification.permission === 'granted') {
      try {
        new Notification(`📅 Nueva cita — ${LABEL_NEGOCIO[tipoNegocio]}`, {
          body: `${nuevasArr.length} nueva${nuevasArr.length > 1 ? 's' : ''} cita${nuevasArr.length > 1 ? 's' : ''} registrada${nuevasArr.length > 1 ? 's' : ''}`,
          icon: '/OsoLogoSVG.svg',
          tag: `cita-nueva-${tipoNegocio}`,
        });
      } catch { /* ignorar */ }
    }

    toast(
      `📅 ${nuevasArr.length} nueva${nuevasArr.length > 1 ? 's' : ''} cita${nuevasArr.length > 1 ? 's' : ''} de ${LABEL_NEGOCIO[tipoNegocio]}`,
      {
        icon: '🗓️',
        duration: 5000,
        style: { background: '#0f0f0f', color: '#22c55e', border: '1px solid #22c55e', fontWeight: 700 },
      }
    );
  }, [data, tipoNegocio]);

  return { unreadIds, marcarVisto, marcarTodosVistos };
}

export function CitasNotificationProvider({ children }) {
  const llantas = useNegocioPoll('LLANTAS');
  const patron  = useNegocioPoll('PATRON');
  const { businessType } = useAuth();
  const activo = businessType === 'patron' ? patron : llantas;

  return (
    <CitasNotificationContext.Provider value={{
      nuevasIds: activo.unreadIds,
      marcarVisto: activo.marcarVisto,
      marcarTodosVistos: activo.marcarTodosVistos,
      count: activo.unreadIds.size,
      countLlantas: llantas.unreadIds.size,
      countPatron: patron.unreadIds.size,
    }}>
      {children}
    </CitasNotificationContext.Provider>
  );
}

export function useCitasNotification() {
  return useContext(CitasNotificationContext);
}
