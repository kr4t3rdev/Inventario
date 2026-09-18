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


/// tests for AccountingReceivablesAndPayablesApi
void main() {
  // final instance = AccountingReceivablesAndPayablesApi();

  group('tests for AccountingReceivablesAndPayablesApi', () {
    // Consultar cuentas por pagar
    //
    // Lista obligaciones con proveedores y muestra saldos, estado y métricas de pago. Permite precisar la consulta mediante texto de búsqueda, estado, tipo, página, límite por página.
    //
    //Future<GetAccountingAccountsPayableResponse> mobileGetAccountingAccountsPayable({ String search, bool estado, String tipo, int page, int limit }) async
    test('test mobileGetAccountingAccountsPayable', () async {
      // TODO
    });

    // Consultar cuentas por cobrar
    //
    // Lista obligaciones de clientes y sus saldos pendientes dentro del tenant. Permite precisar la consulta mediante texto de búsqueda, estado, cliente, página, límite por página.
    //
    //Future<GetAccountingAccountsReceivableResponse> mobileGetAccountingAccountsReceivable({ String search, bool estado, String clienteId, int page, int limit }) async
    test('test mobileGetAccountingAccountsReceivable', () async {
      // TODO
    });

    // Consultar métricas de cuentas por cobrar
    //
    // Calcula los importes agregados y estados de las cuentas por cobrar.
    //
    //Future<GetAccountingAccountsReceivableMetricsResponse> mobileGetAccountingAccountsReceivableMetrics() async
    test('test mobileGetAccountingAccountsReceivableMetrics', () async {
      // TODO
    });

  });
}
