import { useCallback, useEffect, useState, type JSX } from 'react';
import {
  Button,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import type { Sale } from '../../sdks/mobile-v1/typescript/src';
import type { SalesApiClient } from './sales-api';
import { buildSaleCreateRequest, type SaleFormState } from './sales-validation';

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

interface SalesSurfaceProps {
  api: SalesApiClient;
  onNavigateToDashboard?: () => void;
}

const initialForm: SaleFormState = {
  puntoDeVentaId: '',
  productoId: '',
  cantidad: '',
  precioUnitario: '',
  observaciones: '',
};

/**
 * @description Lists sales and creates a sale using the existing mobile API contract.
 * @param {SalesSurfaceProps} props - Authenticated sales API adapter.
 * @returns {JSX.Element} Accessible sales surface.
 */
export function SalesSurface({ api, onNavigateToDashboard }: SalesSurfaceProps): JSX.Element {
  const [sales, setSales] = useState<Sale[]>([]);
  const [form, setForm] = useState<SaleFormState>(initialForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? darkTheme : lightTheme;

  const loadSales = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.list();
      setSales(response.items);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError : new Error('Error de conexión'));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void loadSales();
  }, [loadSales]);

  const updateForm = (field: keyof SaleFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFormError(null);
  };

  const handleCreate = async () => {
    const result = buildSaleCreateRequest(form);
    if (!result.request) {
      setFormError(result.error);
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      await api.create(result.request);
      setForm(initialForm);
      await loadSales();
    } catch (createError) {
      setFormError('No se pudo crear la venta. Verifica los datos e inténtalo nuevamente.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0 }]}>
      <ScrollView contentContainerStyle={styles.content} accessibilityLabel="Ventas">
        <View style={styles.headingRow}>
          <Text style={[styles.title, { color: theme.text }]}>Ventas</Text>
          {onNavigateToDashboard ? <Button title="Resumen" onPress={onNavigateToDashboard} accessibilityLabel="Abrir resumen" /> : null}
        </View>
        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Crear venta</Text>
          <Field label="Punto de venta" value={form.puntoDeVentaId} onChangeText={(value) => updateForm('puntoDeVentaId', value)} theme={theme} />
          <Field label="Producto" value={form.productoId} onChangeText={(value) => updateForm('productoId', value)} theme={theme} />
          <Field label="Cantidad" value={form.cantidad} onChangeText={(value) => updateForm('cantidad', value)} keyboardType="decimal-pad" theme={theme} />
          <Field label="Precio unitario" value={form.precioUnitario} onChangeText={(value) => updateForm('precioUnitario', value)} keyboardType="decimal-pad" theme={theme} />
          <Field label="Observaciones (opcional)" value={form.observaciones} onChangeText={(value) => updateForm('observaciones', value)} theme={theme} />
          {formError ? <Text accessibilityRole="alert" style={[styles.error, { color: theme.text }]}>{formError}</Text> : null}
          <Button title={submitting ? 'Creando…' : 'Crear venta'} onPress={() => void handleCreate()} disabled={submitting} accessibilityLabel="Crear venta" />
        </View>

        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.headingRow}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Ventas registradas</Text>
            <Button title="Actualizar" onPress={() => void loadSales()} disabled={loading || submitting} accessibilityLabel="Actualizar ventas" />
          </View>
          {loading ? <Text style={{ color: theme.text }}>Cargando ventas…</Text> : null}
          {error ? <View><Text accessibilityRole="alert" style={[styles.error, { color: theme.text }]}>No se pudieron cargar las ventas.</Text><Button title="Reintentar" onPress={() => void loadSales()} accessibilityLabel="Reintentar carga de ventas" /></View> : null}
          {!loading && !error && sales.length === 0 ? <Text style={{ color: theme.muted }}>No hay ventas para mostrar.</Text> : null}
          {!loading && !error ? sales.map((sale, index) => <SaleRow key={sale.ventaId ?? `venta-${index}`} sale={sale} theme={theme} />) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * @description Renders one controlled input for the sale form.
 * @param {FieldProps} props - Input label, value, and styling theme.
 * @returns {JSX.Element} Accessible text input.
 */
function Field({ label, value, onChangeText, keyboardType, theme }: FieldProps): JSX.Element {
  return <View style={styles.field}><Text style={[styles.label, { color: theme.text }]}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} keyboardType={keyboardType} style={[styles.input, { color: theme.text, borderColor: theme.border }]} /></View>;
}

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'decimal-pad';
  theme: typeof lightTheme;
}

/**
 * @description Displays contractual sale fields without adding business rules.
 * @param {{ sale: Sale; theme: typeof lightTheme }} props - Sale and theme.
 * @returns {JSX.Element} Sale summary.
 */
function SaleRow({ sale, theme }: { sale: Sale; theme: typeof lightTheme }): JSX.Element {
  return <View accessible accessibilityLabel={`Venta ${sale.ventaId ?? 'sin identificador'}`} style={[styles.row, { borderColor: theme.border }]}><Text style={[styles.rowTitle, { color: theme.text }]}>{sale.ventaId ?? 'Venta sin identificador'}</Text><Text style={{ color: theme.muted }}>Punto de venta: {sale.puntoDeVentaId ?? 'No disponible'}</Text><Text style={{ color: theme.muted }}>Total: {sale.total ?? 'No disponible'}</Text></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { gap: 16, padding: 20 },
  title: { fontSize: 28, fontWeight: '700' },
  section: { gap: 12, padding: 16, borderWidth: 1, borderRadius: 12 },
  sectionTitle: { fontSize: 20, fontWeight: '700' },
  headingRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  field: { gap: 4 },
  label: { fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 8, minHeight: 44, paddingHorizontal: 12 },
  error: { fontWeight: '600' },
  row: { borderBottomWidth: 1, gap: 4, paddingVertical: 10 },
  rowTitle: { fontSize: 16, fontWeight: '600' },
});
