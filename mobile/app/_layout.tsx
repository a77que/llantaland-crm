import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from '../src/store';

const queryClient = new QueryClient();

export default function RootLayout() {
  const { token, cargando, init } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => { init(); }, []);

  useEffect(() => {
    if (cargando) return;
    const enLogin = segments[0] === 'login';
    if (!token && !enLogin) router.replace('/login');
    else if (token && enLogin) router.replace('/');
  }, [token, cargando, segments]);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerStyle: { backgroundColor: '#111827' }, headerTintColor: '#f5c400', headerTitleStyle: { fontWeight: '800' } }}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="index" options={{ title: '🛞 Llantaland — Chats' }} />
          <Stack.Screen name="chat/[id]" options={{ title: 'Conversación' }} />
        </Stack>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
