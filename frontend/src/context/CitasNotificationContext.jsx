import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { citasApi } from '../services/api';

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

const CitasNotificationContext = createContext({
  nuevasIds: new Set(),
  marcarVisto: () => {},
  marcarTodosVistos: () => {},
  count: 0,
});

export function CitasNotificationProvider({ children }) {
  const [nuevasIds, setNuevasIds] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem('citas_unread_ids') || '[]'));
    } catch { return new Set(); }
  });

  const seenIdsRef = useRef((() => {
    try {
      return new Set(JSON.parse(localStorage.getItem('citas_seen_ids') || '[]'));
    } catch { return new Set(); }
  })());

  const marcarVisto = useCallback((id) => {
    setNuevasIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      localStorage.setItem('citas_unread_ids', JSON.stringify([...next]));
      return next;
    });
  }, []);

  const marcarTodosVistos = useCallback(() => {
    setNuevasIds(new Set());
    localStorage.setItem('citas_unread_ids', JSON.stringify([]));
  }, []);

  // Polling global — igual que leads
  const { data } = useQuery({
    queryKey: ['citas-notif-poll'],
    queryFn: () => citasApi.poll(),
    refetchInterval: 20_000,
    staleTime: 0,
  });

  useEffect(() => {
    if (!data || !seenIdsRef.current) return;
    const currentIds = data.ids || [];
    const currentSet = new Set(currentIds);
    const pasoMap   = data.pasos || {};

    // Auto-reconciliar: quitar badge de citas que ya no están en pasos de cita
    setNuevasIds(prev => {
      if (prev.size === 0) return prev;
      const reconciled = new Set([...prev].filter(id => currentSet.has(id)));
      if (reconciled.size !== prev.size) {
        localStorage.setItem('citas_unread_ids', JSON.stringify([...reconciled]));
        return reconciled;
      }
      return prev;
    });

    // Primera visita: tomar todo como línea base sin notificar
    if (seenIdsRef.current.size === 0 && currentIds.length > 0) {
      currentIds.forEach(id => seenIdsRef.current.add(id));
      localStorage.setItem('citas_seen_ids', JSON.stringify(currentIds.slice(-1000)));
      return;
    }

    const nuevasArr = currentIds.filter(id => !seenIdsRef.current.has(id));
    if (nuevasArr.length === 0) return;

    nuevasArr.forEach(id => seenIdsRef.current.add(id));
    localStorage.setItem('citas_seen_ids', JSON.stringify([...seenIdsRef.current].slice(-1000)));

    setNuevasIds(prev => {
      const next = new Set(prev);
      nuevasArr.forEach(id => next.add(id));
      localStorage.setItem('citas_unread_ids', JSON.stringify([...next]));
      return next;
    });

    playNotificationSound();

    if (document.hidden && Notification.permission === 'granted') {
      try {
        new Notification('📅 Nueva cita WhatsApp', {
          body: `${nuevasArr.length} nueva${nuevasArr.length > 1 ? 's' : ''} cita${nuevasArr.length > 1 ? 's' : ''} registrada${nuevasArr.length > 1 ? 's' : ''}`,
          icon: '/OsoLogoSVG.svg',
          tag: 'cita-nueva',
        });
      } catch { /* ignorar */ }
    }

    toast(
      `📅 ${nuevasArr.length} nueva${nuevasArr.length > 1 ? 's' : ''} cita${nuevasArr.length > 1 ? 's' : ''} registrada${nuevasArr.length > 1 ? 's' : ''}`,
      {
        icon: '🗓️',
        duration: 5000,
        style: { background: '#0f0f0f', color: '#22c55e', border: '1px solid #22c55e', fontWeight: 700 },
      }
    );
  }, [data]);

  return (
    <CitasNotificationContext.Provider value={{ nuevasIds, marcarVisto, marcarTodosVistos, count: nuevasIds.size }}>
      {children}
    </CitasNotificationContext.Provider>
  );
}

export function useCitasNotification() {
  return useContext(CitasNotificationContext);
}
