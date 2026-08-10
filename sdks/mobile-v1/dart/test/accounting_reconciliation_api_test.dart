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


/// tests for AccountingReconciliationApi
void main() {
  // final instance = AccountingReconciliationApi();

  group('tests for AccountingReconciliationApi', () {
    // Consultar conciliación de gastos
    //
    // Lista gastos pendientes de conciliación bancaria. Permite precisar la consulta mediante tipoGasto, fecha inicial, fecha final, página, límite por página.
    //
    //Future<GetAccountingReconciliationExpensesResponse> mobileGetAccountingReconciliationExpenses({ String tipoGasto, DateTime fechaDesde, DateTime fechaHasta, int page, int limit }) async
    test('test mobileGetAccountingReconciliationExpenses', () async {
      // TODO
    });

    // Consultar historial de conciliaciones de gastos
    //
    // Devuelve el historial completo de conciliaciones de gastos. Permite precisar la consulta mediante tipoGasto, cuenta bancaria, fecha inicial, fecha final, periodo, reconciliadoPor, página, límite por página.
    //
    //Future<GetAccountingReconciliationExpensesHistoryResponse> mobileGetAccountingReconciliationExpensesHistory({ String tipoGasto, String cuentaId, DateTime fechaDesde, DateTime fechaHasta, String periodo, String reconciliadoPor, int page, int limit }) async
    test('test mobileGetAccountingReconciliationExpensesHistory', () async {
      // TODO
    });

    // Consultar historial paginado de conciliaciones de gastos
    //
    // Devuelve conciliaciones de gastos con estadísticas y control de página. Permite precisar la consulta mediante tipoGasto, cuenta bancaria, fecha inicial, fecha final, periodo, reconciliadoPor, página, límite por página.
    //
    //Future<GetAccountingReconciliationExpensesHistoryResponse> mobileGetAccountingReconciliationExpensesNestedHistory({ String tipoGasto, String cuentaId, DateTime fechaDesde, DateTime fechaHasta, String periodo, String reconciliadoPor, int page, int limit }) async
    test('test mobileGetAccountingReconciliationExpensesNestedHistory', () async {
      // TODO
    });

    // Consultar conciliación de ventas
    //
    // Lista ventas que todavía no tienen conciliación bancaria. Permite precisar la consulta mediante fecha inicial, fecha final, punto de venta, página, límite por página.
    //
    //Future<GetAccountingReconciliationSalesResponse> mobileGetAccountingReconciliationSales({ DateTime fechaInicio, DateTime fechaFin, String puntoDeVentaId, int page, int limit }) async
    test('test mobileGetAccountingReconciliationSales', () async {
      // TODO
    });

    // Consultar historial de conciliaciones de ventas
    //
    // Devuelve el historial completo de conciliaciones de ventas. Permite precisar la consulta mediante fecha inicial, fecha inicial, fecha final, fecha final, cuenta bancaria.
    //
    //Future<GetAccountingReconciliationSalesHistoryResponse> mobileGetAccountingReconciliationSalesHistory({ DateTime fechaDesde, DateTime fechaInicio, DateTime fechaHasta, DateTime fechaFin, String cuentaId }) async
    test('test mobileGetAccountingReconciliationSalesHistory', () async {
      // TODO
    });

    // Consultar historial paginado de conciliaciones de ventas
    //
    // Devuelve conciliaciones de ventas con estadísticas y control de página. Permite precisar la consulta mediante fecha inicial, fecha final, cuenta bancaria.
    //
    //Future<GetAccountingReconciliationSalesHistoryResponse> mobileGetAccountingReconciliationSalesNestedHistory({ DateTime fechaInicio, DateTime fechaFin, String cuentaId }) async
    test('test mobileGetAccountingReconciliationSalesNestedHistory', () async {
      // TODO
    });

    // Consultar conciliación de servicios
    //
    // Lista servicios vendidos pendientes de distribuir entre cuentas bancarias. Permite precisar la consulta mediante fecha inicial, fecha final, página, límite por página.
    //
    //Future<GetAccountingReconciliationServicesResponse> mobileGetAccountingReconciliationServices({ DateTime fechaDesde, DateTime fechaHasta, int page, int limit }) async
    test('test mobileGetAccountingReconciliationServices', () async {
      // TODO
    });

    // Consultar historial de conciliaciones de servicios
    //
    // Devuelve el historial completo de conciliaciones de servicios. Permite precisar la consulta mediante fecha inicial, fecha final, cuenta bancaria.
    //
    //Future<GetAccountingReconciliationServicesHistoryResponse> mobileGetAccountingReconciliationServicesHistory({ DateTime fechaDesde, DateTime fechaHasta, String cuentaId }) async
    test('test mobileGetAccountingReconciliationServicesHistory', () async {
      // TODO
    });

    // Consultar historial paginado de conciliaciones de servicios
    //
    // Devuelve conciliaciones de servicios con estadísticas y control de página. Permite precisar la consulta mediante fecha inicial, fecha final, cuenta bancaria.
    //
    //Future<GetAccountingReconciliationServicesHistoryResponse> mobileGetAccountingReconciliationServicesNestedHistory({ DateTime fechaDesde, DateTime fechaHasta, String cuentaId }) async
    test('test mobileGetAccountingReconciliationServicesNestedHistory', () async {
      // TODO
    });

    // Consultar panel de conciliaciones
    //
    // Resume pendientes, conciliaciones completadas hoy, eficiencia y actividad reciente por módulo.
    //
    //Future<GetAccountingReconciliationStatsResponse> mobileGetAccountingReconciliationStats() async
    test('test mobileGetAccountingReconciliationStats', () async {
      // TODO
    });

    // Registrar conciliación de gastos
    //
    // Distribuye el importe de un gasto entre una o varias cuentas y registra su pago contable.
    //
    //Future<PostAccountingReconciliationExpensesResponse> mobilePostAccountingReconciliationExpenses(ExpenseReconciliationRequest expenseReconciliationRequest, { String tipoGasto, DateTime fechaDesde, DateTime fechaHasta, int page, int limit }) async
    test('test mobilePostAccountingReconciliationExpenses', () async {
      // TODO
    });

    // Registrar conciliación de ventas
    //
    // Abona una venta en la cuenta y medio de pago indicados, respetando el importe conciliable.
    //
    //Future<PostAccountingReconciliationSalesResponse> mobilePostAccountingReconciliationSales(SaleReconciliationRequest saleReconciliationRequest, { DateTime fechaInicio, DateTime fechaFin, String puntoDeVentaId, int page, int limit }) async
    test('test mobilePostAccountingReconciliationSales', () async {
      // TODO
    });

    // Registrar conciliación de servicios
    //
    // Distribuye el total de un servicio entre las cuentas y medios de pago enviados.
    //
    //Future<PostAccountingReconciliationServicesResponse> mobilePostAccountingReconciliationServices(ServiceReconciliationRequest serviceReconciliationRequest, { DateTime fechaDesde, DateTime fechaHasta, int page, int limit }) async
    test('test mobilePostAccountingReconciliationServices', () async {
      // TODO
    });

  });
}
