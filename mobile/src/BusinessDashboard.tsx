import { useMemo, useState, type ReactNode } from 'react';
import { Button, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, View, useColorScheme } from 'react-native';
import type { MobileGetProductsStockRequest } from '../../sdks/mobile-v1/typescript/src';
import type { BusinessApi } from './business-api';
import { useBusinessSurface } from './use-business-surface';

const locationTypes: Array<{ value: MobileGetProductsStockRequest['tipoUbicacion']; label: string }> = [
  { value: 'almacen', label: 'Almacén' },
  { value: 'punto_venta', label: 'Punto de venta' },
];

const lightTheme = {
  background: '#ffffff',
  text: '#1f2937',
  muted: '#4b5563',
  border: '#6b7280',
  surface: '#f9fafb',
};

const darkTheme = {
  background: '#111827',
  text: '#f9fafb',
  muted: '#d1d5db',
  border: '#9ca3af',
  surface: '#1f2937',
};

interface BusinessDashboardProps {
  api: BusinessApi;
}

/**
 * @description Shows the first authenticated dashboard, catalog, and stock sections.
 * @param {BusinessDashboardProps} props - Business API adapter.
 * @returns {JSX.Element} Accessible mobile business surface.
 */
export function BusinessDashboard({ api }: BusinessDashboardProps): JSX.Element {
  const [locationType, setLocationType] = useState<MobileGetProductsStockRequest['tipoUbicacion']>();
  const [locationId, setLocationId] = useState('');
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? darkTheme : lightTheme;
  const stockParams = useMemo(() => ({
    tipoUbicacion: locationType,
    ...(locationId.trim() ? { ubicacionId: locationId.trim() } : {}),
  }), [locationId, locationType]);
  const stockReady = Boolean(locationType && locationId.trim());
  const { data, errors, loading, retry } = useBusinessSurface(api, stockParams);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0 }]}>
      <ScrollView contentContainerStyle={styles.content} accessibilityLabel="Panel principal">
      <Text style={[styles.title, { color: theme.text }]}>Resumen</Text>
      <Section theme={theme} title="Indicadores" error={errors.dashboard} loading={loading && !data.dashboard} onRetry={retry}>
        {data.dashboard ? <View style={styles.metrics}>
          <Metric theme={theme} label="Total" value={data.dashboard.total} />
          <Metric theme={theme} label="Pendiente" value={data.dashboard.pendiente} />
          <Metric theme={theme} label="Pagado" value={data.dashboard.pagado} />
          <Metric theme={theme} label="Vencido" value={data.dashboard.vencido} />
        </View> : null}
      </Section>

      <Section theme={theme} title="Productos" error={errors.products} loading={loading && !data.products} onRetry={retry}>
        {data.products?.items.length ? data.products.items.map((product, index) => (
          <View key={product.id ?? product.codigo ?? `producto-${index}`} style={styles.row} accessible accessibilityLabel={`Producto ${product.nombre ?? 'sin nombre'}`}>
            <Text style={[styles.rowTitle, { color: theme.text }]}>{product.nombre ?? 'Producto sin nombre'}</Text>
            {product.codigo ? <Text style={[styles.muted, { color: theme.muted }]}>Código: {product.codigo}</Text> : null}
            {typeof product.precio === 'number' ? <Text style={[styles.muted, { color: theme.muted }]}>Precio: {product.precio}</Text> : null}
          </View>
        )) : data.products ? <Text style={[styles.muted, { color: theme.muted }]}>No hay productos para mostrar.</Text> : null}
      </Section>

      <Section theme={theme} title="Existencias" error={errors.stock} loading={loading && !data.stock && stockReady} onRetry={retry}>
        <Text style={[styles.muted, { color: theme.muted }]}>
          {stockReady ? `Ubicación: ${locationTypes.find((item) => item.value === locationType)?.label}` : 'Selecciona un tipo de ubicación e ingresa el identificador requerido para consultar existencias.'}
        </Text>
        <View style={styles.locationButtons} accessibilityLabel="Tipo de ubicación">
          {locationTypes.map((item) => <Button key={item.value} title={`Seleccionar ${item.label}`} accessibilityLabel={`Seleccionar tipo ${item.label}`} onPress={() => setLocationType(item.value)} />)}
        </View>
        <TextInput accessibilityLabel="Identificador de ubicación requerido" placeholder="ID de ubicación (requerido)" value={locationId} onChangeText={setLocationId} style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.surface }]} />
        {data.stock?.items.length ? data.stock.items.map((product, index) => (
          <Text key={product.id ?? product.codigo ?? `existencia-${index}`} style={[styles.row, { color: theme.text }]}>{product.nombre ?? 'Producto sin nombre'}: {product.stock ?? 0}</Text>
        )) : data.stock ? <Text style={[styles.muted, { color: theme.muted }]}>No hay existencias para mostrar.</Text> : null}
      </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * @description Displays a metric from the generated dashboard response.
 * @param {{ label: string; value?: number }} props - Metric label and value.
 * @returns {JSX.Element} Metric view.
 */
function Metric({ theme, label, value }: { theme: typeof lightTheme; label: string; value?: number }): JSX.Element {
  return <View style={styles.metric}><Text style={[styles.metricValue, { color: theme.text }]}>{value ?? '—'}</Text><Text style={[styles.muted, { color: theme.muted }]}>{label}</Text></View>;
}

/**
 * @description Displays loading, error, retry, and successful section content.
 * @param {{ title: string; error: Error | null; loading: boolean; onRetry: () => void; children: React.ReactNode }} props - Section state.
 * @returns {JSX.Element} Section view.
 */
function Section({ theme, title, error, loading, onRetry, children }: { theme: typeof lightTheme; title: string; error: Error | null; loading: boolean; onRetry: () => void; children: ReactNode }): JSX.Element {
  return <View style={[styles.section, { borderColor: theme.border, backgroundColor: theme.surface }]}><Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>{loading ? <Text accessibilityRole="text" style={{ color: theme.text }}>Cargando…</Text> : null}{error ? <View><Text accessibilityRole="alert" style={{ color: theme.text }}>No se pudo cargar esta sección.</Text><Button title="Reintentar" accessibilityLabel={`Reintentar ${title}`} onPress={onRetry} /></View> : children}</View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { gap: 16, padding: 20 },
  title: { fontSize: 28, fontWeight: '700' },
  section: { gap: 10, padding: 16, borderWidth: 1, borderColor: '#9ca3af', borderRadius: 12 },
  sectionTitle: { fontSize: 20, fontWeight: '700' },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metric: { minWidth: '44%', gap: 4 },
  metricValue: { fontSize: 22, fontWeight: '700' },
  row: { paddingVertical: 8 },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  muted: {},
  locationButtons: { gap: 8 },
  input: { borderWidth: 1, borderRadius: 8, padding: 10 },
});
