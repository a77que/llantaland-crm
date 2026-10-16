import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { io, Socket } from 'socket.io-client';
import { api, API } from '../../src/store';

type Msg = { id?: string; rol: string; mensaje: string; timestamp?: any };

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [lead, setLead] = useState<any>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [texto, setTexto] = useState('');
  const [activo, setActivo] = useState(false);
  const listRef = useRef<FlatList>(null);
  const socketRef = useRef<Socket | null>(null);

  const esWeb = lead?.canal === 'web';
  const sessionId = lead?.telefono;

  const push = (m: Msg) => setMsgs((prev) => {
    if (m.id && prev.some((x) => x.id === m.id)) return prev;
    return [...prev, m];
  });

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const d = await api('/api/leads/' + id);
        if (!vivo) return;
        setLead(d);
        setMsgs(d.historial || []);
        setActivo(!!d.humanTakeover?.agenteActivo);
      } catch (e: any) { Alert.alert('Error', e.message); }
    })();
    return () => { vivo = false; };
  }, [id]);

  useEffect(() => {
    if (!sessionId) return;
    const sock = io(API, { path: '/socket.io', transports: ['websocket', 'polling'] });
    socketRef.current = sock;
    sock.on('connect', () => sock.emit('vendedor:join'));
    const onCliente = (d: any) => { if (d.sessionId === sessionId) push({ rol: 'cliente', mensaje: d.texto }); };
    const onBot = (d: any) => { if (d.sessionId === sessionId) push({ rol: d.vendedor ? 'vendedor' : 'bot', mensaje: d.texto }); };
    sock.on('chat:cliente', onCliente);
    sock.on('chat:bot', onBot);
    return () => { sock.disconnect(); };
  }, [sessionId]);

  useEffect(() => { setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80); }, [msgs.length]);

  const enviar = async () => {
    const t = texto.trim();
    if (!t || !esWeb) return;
    setTexto('');
    push({ rol: 'vendedor', mensaje: t });
    try { await api('/api/chat/vendedor', { method: 'POST', body: JSON.stringify({ sessionId, texto: t }) }); setActivo(true); }
    catch (e: any) { Alert.alert('No se envió', e.message); }
  };

  const toggleBot = async () => {
    try {
      const d = await api('/api/leads/' + id + '/takeover', { method: 'POST', body: JSON.stringify({ activo: !activo }) });
      setActivo(!!d.agenteActivo);
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const burbuja = ({ item }: { item: Msg }) => {
    const cli = item.rol === 'cliente';
    return (
      <View style={[s.b, cli ? s.cli : (item.rol === 'vendedor' ? s.vend : s.bot)]}>
        <Text style={s.rol}>{cli ? '🧑 Cliente' : item.rol === 'vendedor' ? '🙋 Tú' : '🤖 Bot'}</Text>
        <Text style={[s.txt, cli ? null : s.txtB]}>{item.mensaje}</Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={s.cont} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TouchableOpacity style={[s.toggle, activo ? s.toggleOn : s.toggleOff]} onPress={toggleBot}>
        <Text style={s.toggleTxt}>{activo ? '🙋 Tú atiendes — tocar para devolver al bot' : '🤖 Bot atendiendo — tocar para atender tú'}</Text>
      </TouchableOpacity>
      <FlatList ref={listRef} data={msgs} keyExtractor={(m, i) => m.id || String(i)} renderItem={burbuja}
        contentContainerStyle={{ padding: 12, gap: 8 }} />
      {esWeb ? (
        <View style={s.foot}>
          <TextInput style={s.input} placeholder="Escribe una respuesta…" placeholderTextColor="#9ca3af"
            value={texto} onChangeText={setTexto} onSubmitEditing={enviar} />
          <TouchableOpacity style={s.send} onPress={enviar}><Text style={s.sendTxt}>➤</Text></TouchableOpacity>
        </View>
      ) : (
        <Text style={s.waNota}>Este cliente llegó por WhatsApp: respóndele desde WhatsApp. Aquí ves la conversación y puedes pausar el bot.</Text>
      )}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  cont: { flex: 1, backgroundColor: '#f1f5f9' },
  toggle: { padding: 10, alignItems: 'center' },
  toggleOn: { backgroundColor: '#fffbeb' }, toggleOff: { backgroundColor: '#eef2ff' },
  toggleTxt: { fontWeight: '700', fontSize: 12, color: '#334155' },
  b: { maxWidth: '85%', padding: 10, borderRadius: 12 },
  cli: { alignSelf: 'flex-start', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  bot: { alignSelf: 'flex-end', backgroundColor: '#111827' },
  vend: { alignSelf: 'flex-end', backgroundColor: '#16a34a' },
  rol: { fontSize: 9, opacity: 0.6, marginBottom: 2, color: '#000' },
  txt: { fontSize: 14, color: '#111' }, txtB: { color: '#fff' },
  foot: { flexDirection: 'row', gap: 8, padding: 10, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  input: { flex: 1, backgroundColor: '#f1f5f9', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  send: { backgroundColor: '#111827', width: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  sendTxt: { color: '#f5c400', fontSize: 18 },
  waNota: { padding: 12, color: '#64748b', fontSize: 12, textAlign: 'center', backgroundColor: '#fff' },
});
