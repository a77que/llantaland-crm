import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { leadsApi } from '../services/api';

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    [
      { freq: 880, start: 0,    dur: 0.15 },
      { freq: 1320, start: 0.15, dur: 0.2  },
    ].forEach(({ freq, start, dur }) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur + 0.05);
    });
  } catch { /* AudioContext no soportado */ }
}

const LeadsNotificationContext = createContext({
  nuevosIds: new Set(),
  marcarVisto: () => {},
  marcarTodosVistos: () => {},
  count: 0,
});

export function LeadsNotificationProvider({ children }) {
  const [nuevosIds, setNuevosIds] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem('leads_unread_ids') || '[]'));
    } catch { return new Set(); }
  });

  const seenIdsRef = useRef((() => {
    try {
      return new Set(JSON.parse(localStorage.getItem('leads_seen_ids') || '[]'));
    } catch { return new Set(); }
  })());

  // Pedir permiso de notificaciones del browser una sola vez
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const marcarVisto = useCallback((id) => {
    setNuevosIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      localStorage.setItem('leads_unread_ids', JSON.stringify([...next]));
      return next;
    });
  }, []);

  const marcarTodosVistos = useCallback(() => {
    setNuevosIds(new Set());
    localStorage.setItem('leads_unread_ids', JSON.stringify([]));
  }, []);

  // Polling global — corre en cualquier página mientras el usuario esté logueado
  const { data } = useQuery({
    queryKey: ['leads-notif-poll'],
    queryFn: () => leadsApi.listar({ page: 1, limit: 50, orderBy: 'updatedAt', orderDir: 'desc' }),
    refetchInterval: 20_000,
    staleTime: 0,
  });

  useEffect(() => {
    if (!data || !seenIdsRef.current) return;
    const currentIds = (data.leads || []).map(l => l.id);
    const currentSet = new Set(currentIds);
    const pasoMap    = new Map((data.leads || []).map(l => [l.id, l.pasoActual]));

    // Auto-reconciliar: quitar badge solo de leads que ya no aparecen en los resultados
    setNuevosIds(prev => {
      if (prev.size === 0) return prev;
      const reconciled = new Set([...prev].filter(id => currentSet.has(id)));
      if (reconciled.size !== prev.size) {
        localStorage.setItem('leads_unread_ids', JSON.stringify([...reconciled]));
        return reconciled;
      }
      return prev;
    });

    // Primera visita: tomar todos como línea base sin notificar
    if (seenIdsRef.current.size === 0 && currentIds.length > 0) {
      currentIds.forEach(id => seenIdsRef.current.add(id));
      localStorage.setItem('leads_seen_ids', JSON.stringify(currentIds.slice(-1000)));
      return;
    }

    const nuevosArr = currentIds.filter(id => !seenIdsRef.current.has(id));
    if (nuevosArr.length === 0) return;

    nuevosArr.forEach(id => seenIdsRef.current.add(id));
    localStorage.setItem('leads_seen_ids', JSON.stringify([...seenIdsRef.current].slice(-1000)));

    setNuevosIds(prev => {
      const next = new Set(prev);
      nuevosArr.forEach(id => next.add(id));
      localStorage.setItem('leads_unread_ids', JSON.stringify([...next]));
      return next;
    });

    // Sonido — siempre, sin importar en qué pestaña esté el usuario
    playNotificationSound();

    // Notificación del browser cuando la ventana está minimizada o en otra pestaña
    if (document.hidden && Notification.permission === 'granted') {
      try {
        new Notification('📱 Nuevo lead WhatsApp', {
          body: `${nuevosArr.length} nuevo${nuevosArr.length > 1 ? 's' : ''} lead${nuevosArr.length > 1 ? 's' : ''} esperando atención`,
          icon: '/OsoLogoSVG.svg',
          tag: 'lead-nuevo',
        });
      } catch { /* browsers que bloquean notificaciones */ }
    }

    toast(
      `📱 ${nuevosArr.length} nuevo${nuevosArr.length > 1 ? 's' : ''} lead${nuevosArr.length > 1 ? 's' : ''} de WhatsApp`,
      {
        icon: '🔔',
        duration: 5000,
        style: { background: '#0f0f0f', color: '#f5c400', border: '1px solid #f5c400', fontWeight: 700 },
      }
    );
  }, [data]);

  return (
    <LeadsNotificationContext.Provider value={{ nuevosIds, marcarVisto, marcarTodosVistos, count: nuevosIds.size }}>
      {children}
    </LeadsNotificationContext.Provider>
  );
}

export function useLeadsNotification() {
  return useContext(LeadsNotificationContext);
}
