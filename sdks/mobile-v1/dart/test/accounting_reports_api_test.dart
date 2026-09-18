//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

import 'package:tcp_mobile_v1_sdk/api.dart';
import 'package:test/test.dart';


/// tests for AccountingReportsApi
void main() {
  // final instance = AccountingReportsApi();

  group('tests for AccountingReportsApi', () {
    // Consultar anticipos de clientes
    //
    // Agrupa los anticipos recibidos de clientes para el período consultado. Permite precisar la consulta mediante cliente, fecha inicial, fecha final.
    //
    //Future<GetAccountingAdvancesReportsCustomersResponse> mobileGetAccountingAdvancesReportsCustomers({ String clienteId, DateTime fechaInicio, DateTime fechaFin }) async
    test('test mobileGetAccountingAdvancesReportsCustomers', () async {
      // TODO
    });

    // Consultar anticipos a proveedores
    //
    // Agrupa los anticipos entregados a proveedores para el período consultado. Permite precisar la consulta mediante proveedor, fecha inicial, fecha final.
    //
    //Future<GetAccountingAdvancesReportsProvidersResponse> mobileGetAccountingAdvancesReportsProviders({ String proveedorId, DateTime fechaInicio, DateTime fechaFin }) async
    test('test mobileGetAccountingAdvancesReportsProviders', () async {
      // TODO
    });

    // Consultar resumen de anticipos
    //
    // Resume importes y estados de anticipos de pago y cobro. Permite precisar la consulta mediante tipo, fecha inicial, fecha final.
    //
    //Future<GetAccountingAdvancesReportsSummaryResponse> mobileGetAccountingAdvancesReportsSummary({ String tipo, DateTime fechaInicio, DateTime fechaFin }) async
    test('test mobileGetAccountingAdvancesReportsSummary', () async {
      // TODO
    });

    // Consultar análisis de cuenta de cliente
    //
    // Analiza deuda, pagos, vencimientos y actividad de una cuenta de cliente. Permite precisar la consulta mediante cliente.
    //
    //Future<GetAccountingReportsClientAccountAnalysisResponse> mobileGetAccountingReportsClientAccountAnalysis({ String clienteId }) async
    test('test mobileGetAccountingReportsClientAccountAnalysis', () async {
      // TODO
    });

    // Consultar reporte de cambio de moneda
    //
    // Reúne tasas y conversiones monetarias para evaluar operaciones de cambio. Permite precisar la consulta mediante fecha inicial, fecha final, monedaOrigen, monedaDestino, formato de exportación.
    //
    //Future<GetAccountingReportsExchangeResponse> mobileGetAccountingReportsExchange({ DateTime fechaInicio, DateTime fechaFin, String monedaOrigen, String monedaDestino, String export_ }) async
    test('test mobileGetAccountingReportsExchange', () async {
      // TODO
    });

    // Consultar impacto de variaciones cambiarias
    //
    // Calcula el efecto de las tasas aplicadas sobre movimientos y saldos convertidos. Permite precisar la consulta mediante fecha inicial, fecha final, monedaBase, tipoAnalisis.
    //
    //Future<GetAccountingReportsExchangeImpactResponse> mobileGetAccountingReportsExchangeImpact({ DateTime fechaInicio, DateTime fechaFin, String monedaBase, String tipoAnalisis }) async
    test('test mobileGetAccountingReportsExchangeImpact', () async {
      // TODO
    });

    // Consultar movimientos contables
    //
    // Lista entradas y salidas contables y puede devolver su exportación CSV. Permite precisar la consulta mediante texto libre, fecha inicial, fecha final, cuenta bancaria, tipo de movimiento, moneda, página, límite por página, formato de exportación.
    //
    //Future<GetAccountingReportsMovementsResponse> mobileGetAccountingReportsMovements({ String busqueda, DateTime fechaInicio, DateTime fechaFin, String cuentaId, String tipoMovimiento, String moneda, int page, int limit, String formato }) async
    test('test mobileGetAccountingReportsMovements', () async {
      // TODO
    });

    // Consultar facturas vencidas
    //
    // Identifica facturas cuyo vencimiento pasó y que aún conservan saldo pendiente.
    //
    //Future<GetAccountingReportsOverdueInvoicesResponse> mobileGetAccountingReportsOverdueInvoices() async
    test('test mobileGetAccountingReportsOverdueInvoices', () async {
      // TODO
    });

    // Consultar resumen financiero
    //
    // Consolida saldos, ingresos, egresos y actividad contable del período. Permite precisar la consulta mediante fecha inicial, fecha final, cuenta bancaria, moneda, formato de exportación.
    //
    //Future<GetAccountingReportsSummaryResponse> mobileGetAccountingReportsSummary({ DateTime fechaInicio, DateTime fechaFin, String cuentaId, String moneda, String export_ }) async
    test('test mobileGetAccountingReportsSummary', () async {
      // TODO
    });

    // Consultar reporte de transferencias
    //
    // Analiza transferencias por cuentas, monedas y responsable, con exportación opcional. Permite precisar la consulta mediante fecha inicial, fecha final, cuenta de origen, cuenta de destino, moneda, página, límite por página, usuario responsable, formato de exportación.
    //
    //Future<GetAccountingReportsTransfersResponse> mobileGetAccountingReportsTransfers({ DateTime fechaInicio, DateTime fechaFin, String cuentaOrigenId, String cuentaDestinoId, String moneda, int page, int limit, String realizadoPor, String export_ }) async
    test('test mobileGetAccountingReportsTransfers', () async {
      // TODO
    });

  });
}
