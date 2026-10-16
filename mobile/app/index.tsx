import { useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { api, useAuth } from '../src/store';

export default function Chats() {
  const router = useRouter();
  const { usuario, logout } = useAuth();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['leads'],
    queryFn: () => api('/api/leads?limit=60&orderBy=updatedAt&orderDir=desc'),
    refetchInterval: 10000,
  });
  const leads = data?.leads || [];

  useEffect(() => {}, [usuario]);

  const item = ({ item }: any) => {
    const web = item.canal === 'web';
    const activo = item.humanTakeover?.agenteActivo;
    const nombre = item.nombreCliente || (web ? 'Cliente web' : item.telefono);
    return (
      <TouchableOpacity style={s.card} onPress={() => router.push('/chat/' + item.id)}>
        <View style={[s.avatar, { backgroundColor: web ? '#1d4ed8' : '#16a34a' }]}>
          <Text style={s.avatarTxt}>{web ? '💻' : '📱'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.nombre} numberOfLines={1}>{nombre}</Text>
          <Text style={s.meta} numberOfLines={1}>{(item.pasoActual || 'nuevo').replace(/_/g, ' ')}</Text>
        </View>
        {activo ? <View style={s.badge}><Text style={s.badgeTxt}>Tú atiendes</Text></View> : null}
      </TouchableOpacity>
    );
  };

  return (
    <View style={s.cont}>
      <View style={s.topbar}>
        <Text style={s.hola}>Hola, {usuario?.nombre?.split(' ')[0] || 'vendedor'}</Text>
        <TouchableOpacity onPress={logout}><Text style={s.salir}>Salir</Text></TouchableOpacity>
      </View>
      <FlatList
        data={leads}
        keyExtractor={(l: any) => l.id}
        renderItem={item}
        contentContainerStyle={{ padding: 12 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#f5c400" />}
        ListEmptyComponent={<Text style={s.vacio}>{isLoading ? 'Cargando…' : 'Aún no hay conversaciones.'}</Text>}
      />
    </View>
  );
}

const s = StyleSheet.create({
  cont: { flex: 1, backgroundColor: '#0f172a' },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, backgroundColor: '#111827' },
  hola: { color: '#fff', fontWeight: '700' },
  salir: { color: '#f5c400', fontWeight: '700' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 20 },
  nombre: { fontWeight: '800', fontSize: 15, color: '#111' },
  meta: { color: '#64748b', fontSize: 12, marginTop: 2, textTransform: 'capitalize' },
  badge: { backgroundColor: '#fef3c7', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  badgeTxt: { color: '#92400e', fontSize: 10, fontWeight: '800' },
  vacio: { color: '#94a3b8', textAlign: 'center', marginTop: 40 },
});
