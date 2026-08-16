import { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, Button, SafeAreaView, StyleSheet, Text, TextInput, View, useColorScheme } from 'react-native';
import Constants from 'expo-constants';
import { createAppSessionManager } from './src/app-session';
import { BusinessDashboard } from './src/BusinessDashboard';
import { createGeneratedBusinessApi } from './src/business-api';
import { SalesSurface } from './src/SalesSurface';
import { createGeneratedSalesApi } from './src/sales-api';
import { handleMobileBack, type MobileScreen } from './src/mobile-navigation';

const lightTheme = {
  background: '#ffffff',
  text: '#1f2937',
  border: '#6b7280',
  error: '#b91c1c',
};

const darkTheme = {
  background: '#111827',
  text: '#f9fafb',
  border: '#9ca3af',
  error: '#fca5a5',
};

/**
 * @description Minimal authentication-only reference client for the TCP mobile API.
 * @returns {JSX.Element} Loading, error, login, or authenticated state.
 */
export default function App(): JSX.Element {
  const apiBaseUrl = String(Constants.expoConfig?.extra?.apiBaseUrl ?? '');
  const [status, setStatus] = useState<'loading' | 'signed-out' | 'signed-in' | 'error'>('loading');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [screen, setScreen] = useState<MobileScreen>('dashboard');
  const manager = useMemo(() => apiBaseUrl ? createAppSessionManager(apiBaseUrl) : null, [apiBaseUrl]);
  const handleUnauthorized = useCallback(async () => {
    if (!manager) return;
    await manager.clearLocalSession();
    setStatus('signed-out');
    setMessage('La sesión ya no es válida. Inicia sesión nuevamente.');
  }, [manager]);
  const businessApi = useMemo(() => manager && apiBaseUrl
    ? createGeneratedBusinessApi(apiBaseUrl, () => manager.getAccessToken(), undefined, handleUnauthorized)
    : null, [apiBaseUrl, handleUnauthorized, manager]);
  const salesApi = useMemo(() => manager && apiBaseUrl
    ? createGeneratedSalesApi(apiBaseUrl, () => manager.getAccessToken(), undefined, handleUnauthorized)
    : null, [apiBaseUrl, handleUnauthorized, manager]);
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? darkTheme : lightTheme;

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => handleMobileBack(screen, setScreen));
    return () => subscription.remove();
  }, [screen]);

  useEffect(() => {
    if (!manager) {
      setStatus('error');
      setMessage('Configura EXPO_PUBLIC_API_BASE_URL para iniciar la aplicación.');
      return;
    }
    manager.restore().then((session) => setStatus(session ? 'signed-in' : 'signed-out')).catch(() => {
      setStatus('signed-out');
      setMessage('La sesión ya no es válida. Inicia sesión nuevamente.');
    });
  }, [manager]);

  if (status === 'loading') return <CenteredText text="Cargando sesión…" theme={theme} />;
  if (status === 'error') return <CenteredText text={message} theme={theme} />;
  if (status === 'signed-in' && businessApi && salesApi) {
    return screen === 'sales'
      ? <SalesSurface api={salesApi} onNavigateToDashboard={() => setScreen('dashboard')} />
      : <BusinessDashboard api={businessApi} onNavigateToSales={() => setScreen('sales')} />;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.text }]}>TCP Mobile</Text>
        <TextInput accessibilityLabel="Correo electrónico" autoCapitalize="none" onChangeText={setEmail} placeholder="Correo electrónico" placeholderTextColor={theme.border} style={[styles.input, { borderColor: theme.border, color: theme.text }]} value={email} />
        <TextInput accessibilityLabel="Contraseña" onChangeText={setPassword} placeholder="Contraseña" placeholderTextColor={theme.border} secureTextEntry style={[styles.input, { borderColor: theme.border, color: theme.text }]} value={password} />
        <Button title="Iniciar sesión" onPress={() => {
          if (!manager) return;
          setMessage('');
          setStatus('loading');
          manager.login(email, password).then(() => setStatus('signed-in')).catch(() => {
            setStatus('signed-out');
            setMessage('No se pudo iniciar sesión. Verifica tus datos.');
          });
        }} />
        {message ? <Text accessibilityRole="alert" style={[styles.error, { color: theme.error }]}>{message}</Text> : null}
      </View>
    </SafeAreaView>
  );
}

/**
 * @description Displays a centered status message.
 * @param {{ text: string }} props - Message content.
 * @returns {JSX.Element} Status view.
 */
function CenteredText({ text, theme }: { text: string; theme: typeof lightTheme }): JSX.Element {
  return <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}><Text style={[styles.content, { color: theme.text }]}>{text}</Text></SafeAreaView>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', gap: 16, padding: 24 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 12 },
  input: { borderRadius: 8, borderWidth: 1, padding: 12 },
  error: { marginTop: 12 },
});
