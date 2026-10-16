import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useAuth } from '../src/store';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);

  const entrar = async () => {
    if (!email || !password) return;
    setCargando(true);
    try { await login(email.trim(), password); }
    catch (e: any) { Alert.alert('No se pudo ingresar', e.message || 'Error'); }
    finally { setCargando(false); }
  };

  return (
    <View style={s.cont}>
      <Text style={s.logo}>🛞</Text>
      <Text style={s.titulo}>Llantaland</Text>
      <Text style={s.sub}>Panel del vendedor</Text>
      <TextInput style={s.input} placeholder="Correo" placeholderTextColor="#9ca3af" autoCapitalize="none"
        keyboardType="email-address" value={email} onChangeText={setEmail} />
      <TextInput style={s.input} placeholder="Contraseña" placeholderTextColor="#9ca3af" secureTextEntry
        value={password} onChangeText={setPassword} onSubmitEditing={entrar} />
      <TouchableOpacity style={s.btn} onPress={entrar} disabled={cargando}>
        {cargando ? <ActivityIndicator color="#111" /> : <Text style={s.btnTxt}>Ingresar</Text>}
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  cont: { flex: 1, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center', padding: 28 },
  logo: { fontSize: 56 },
  titulo: { color: '#f5c400', fontSize: 30, fontWeight: '900', marginTop: 6 },
  sub: { color: '#9ca3af', marginBottom: 28 },
  input: { width: '100%', backgroundColor: '#1f2937', color: '#fff', borderRadius: 12, padding: 14, fontSize: 16, marginBottom: 12 },
  btn: { width: '100%', backgroundColor: '#f5c400', borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 6 },
  btnTxt: { color: '#111', fontWeight: '900', fontSize: 16 },
});
