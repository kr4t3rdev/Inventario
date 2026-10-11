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


/// tests for DashboardApi
void main() {
  // final instance = DashboardApi();

  group('tests for DashboardApi', () {
    // Consultar promedio diario de ingresos
    //
    // Promedio de ingresos diarios (30 días).
    //
    //Future<DashboardValueResponse> mobileGetDashboardDailyAverage({ String ubicacionId, String tipoUbicacion }) async
    test('test mobileGetDashboardDailyAverage', () async {
      // TODO
    });

    // Consultar ingresos vs gastos del panel
    //
    // Ingresos y gastos totales más la serie mensual para la gráfica del panel.
    //
    //Future<DashboardIncomeExpenseResponse> mobileGetDashboardIncomeExpenses({ String ubicacionId, String tipoUbicacion }) async
    test('test mobileGetDashboardIncomeExpenses', () async {
      // TODO
    });

    // Consultar valor total del inventario
    //
    // Valor total del inventario en stock.
    //
    //Future<DashboardValueResponse> mobileGetDashboardInventoryValue({ String ubicacionId, String tipoUbicacion }) async
    test('test mobileGetDashboardInventoryValue', () async {
      // TODO
    });

    // Consultar productos con stock bajo
    //
    // Productos con stock bajo o crítico (top 5).
    //
    //Future<DashboardLowStockResponse> mobileGetDashboardLowStock({ String ubicacionId, String tipoUbicacion }) async
    test('test mobileGetDashboardLowStock', () async {
      // TODO
    });

    // Consultar indicadores del panel principal
    //
    // Resume ventas, ingresos y alertas de inventario para una ubicación operativa. Permite precisar la consulta mediante ubicación, tipo de ubicación.
    //
    //Future<GetDashboardStatsResponse> mobileGetDashboardStats({ String ubicacionId, String tipoUbicacion }) async
    test('test mobileGetDashboardStats', () async {
      // TODO
    });

    // Consultar distribución de stock
    //
    // Distribución de stock por categoría.
    //
    //Future<DashboardStockDistributionResponse> mobileGetDashboardStockDistribution({ String ubicacionId, String tipoUbicacion }) async
    test('test mobileGetDashboardStockDistribution', () async {
      // TODO
    });

    // Consultar ventas de hoy
    //
    // Ingresos por ventas del día actual.
    //
    //Future<DashboardValueResponse> mobileGetDashboardTodaySales({ String ubicacionId, String tipoUbicacion }) async
    test('test mobileGetDashboardTodaySales', () async {
      // TODO
    });

    // Consultar productos más vendidos
    //
    // Top 10 de productos más vendidos del período.
    //
    //Future<DashboardTopProductsResponse> mobileGetDashboardTopProducts({ String ubicacionId, String tipoUbicacion }) async
    test('test mobileGetDashboardTopProducts', () async {
      // TODO
    });

    // Consultar transferencias entre ubicaciones
    //
    // Conteo de transferencias entre almacenes y puntos de venta.
    //
    //Future<DashboardTransfersResponse> mobileGetDashboardTransfers({ String ubicacionId, String tipoUbicacion }) async
    test('test mobileGetDashboardTransfers', () async {
      // TODO
    });

  });
}
