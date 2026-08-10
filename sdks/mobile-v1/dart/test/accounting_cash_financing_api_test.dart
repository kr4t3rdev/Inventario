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


/// tests for AccountingCashFinancingApi
void main() {
  // final instance = AccountingCashFinancingApi();

  group('tests for AccountingCashFinancingApi', () {
    // Consultar deudas de efectivo
    //
    // Lista deudas de efectivo con proveedores, sus vencimientos y saldos. Permite precisar la consulta mediante estado, proveedor, moneda, página, límite por página.
    //
    //Future<GetAccountingCashDebtsResponse> mobileGetAccountingCashDebts({ bool estado, String proveedorId, String moneda, int page, int limit }) async
    test('test mobileGetAccountingCashDebts', () async {
      // TODO
    });

    // Consultar deudas de efectivo
    //
    // Devuelve la deuda identificada con proveedor, cuenta por pagar y pagos relacionados.
    //
    //Future<GetAccountingCashDebtsIdResponse> mobileGetAccountingCashDebtsById(String id) async
    test('test mobileGetAccountingCashDebtsById', () async {
      // TODO
    });

    // Consultar indicadores de deudas de efectivo
    //
    // Calcula cantidad, capital y saldo pendiente de las deudas de efectivo.
    //
    //Future<GetAccountingCashDebtsStatsResponse> mobileGetAccountingCashDebtsStats() async
    test('test mobileGetAccountingCashDebtsStats', () async {
      // TODO
    });

    // Consultar préstamos de efectivo
    //
    // Lista préstamos de efectivo otorgados a clientes, con vencimientos y saldos. Permite precisar la consulta mediante estado, cliente, moneda, página, límite por página.
    //
    //Future<GetAccountingCashLoansResponse> mobileGetAccountingCashLoans({ bool estado, String clienteId, String moneda, int page, int limit }) async
    test('test mobileGetAccountingCashLoans', () async {
      // TODO
    });

    // Consultar préstamos de efectivo
    //
    // Devuelve el préstamo identificado con cliente, cuenta por cobrar y pagos relacionados.
    //
    //Future<GetAccountingCashLoansIdResponse> mobileGetAccountingCashLoansById(String id) async
    test('test mobileGetAccountingCashLoansById', () async {
      // TODO
    });

    // Descargar comprobante de préstamos de efectivo
    //
    // Genera el comprobante PDF del registro solicitado, conservando sus importes y referencias contables.
    //
    //Future<MultipartFile> mobileGetAccountingCashLoansByIdComprobante(String id) async
    test('test mobileGetAccountingCashLoansByIdComprobante', () async {
      // TODO
    });

    // Consultar historial de préstamos de efectivo
    //
    // Devuelve los movimientos cronológicos asociados al registro solicitado para facilitar su trazabilidad.
    //
    //Future<GetAccountingCashLoansIdHistoryResponse> mobileGetAccountingCashLoansByIdNestedHistory(String id) async
    test('test mobileGetAccountingCashLoansByIdNestedHistory', () async {
      // TODO
    });

    // Consultar indicadores de préstamos de efectivo
    //
    // Calcula cantidad, capital y saldo pendiente de los préstamos de efectivo.
    //
    //Future<GetAccountingCashLoansStatsResponse> mobileGetAccountingCashLoansStats() async
    test('test mobileGetAccountingCashLoansStats', () async {
      // TODO
    });

    // Registrar deudas de efectivo
    //
    // Registra financiamiento recibido de un proveedor, incrementa la cuenta bancaria y crea la cuenta por pagar.
    //
    //Future<PostAccountingCashDebtsResponse> mobilePostAccountingCashDebts(CashDebtCreateRequest cashDebtCreateRequest, { bool estado, String proveedorId, String moneda, int page, int limit }) async
    test('test mobilePostAccountingCashDebts', () async {
      // TODO
    });

    // Registrar pago de deudas de efectivo
    //
    // Aplica un pago al saldo pendiente y registra sus efectos bancarios y contables.
    //
    //Future<PostAccountingCashDebtsIdPaymentsResponse> mobilePostAccountingCashDebtsByIdPayments(String id, CashPaymentRequest cashPaymentRequest) async
    test('test mobilePostAccountingCashDebtsByIdPayments', () async {
      // TODO
    });

    // Registrar préstamos de efectivo
    //
    // Registra un préstamo a un cliente, descuenta fondos de la cuenta bancaria y crea la cuenta por cobrar.
    //
    //Future<PostAccountingCashLoansResponse> mobilePostAccountingCashLoans(CashLoanCreateRequest cashLoanCreateRequest, { bool estado, String clienteId, String moneda, int page, int limit }) async
    test('test mobilePostAccountingCashLoans', () async {
      // TODO
    });

    // Registrar pago de préstamos de efectivo
    //
    // Aplica un pago al saldo pendiente y registra sus efectos bancarios y contables.
    //
    //Future<PostAccountingCashLoansIdPaymentsResponse> mobilePostAccountingCashLoansByIdPayments(String id, CashPaymentRequest cashPaymentRequest) async
    test('test mobilePostAccountingCashLoansByIdPayments', () async {
      // TODO
    });

    // Actualizar deudas de efectivo
    //
    // Actualiza vencimiento, tasa de interés u observaciones de la deuda identificada.
    //
    //Future<PutAccountingCashDebtsIdResponse> mobilePutAccountingCashDebtsById(String id, CashOperationUpdateRequest cashOperationUpdateRequest) async
    test('test mobilePutAccountingCashDebtsById', () async {
      // TODO
    });

    // Actualizar préstamos de efectivo
    //
    // Actualiza vencimiento, tasa de interés u observaciones del préstamo identificado.
    //
    //Future<PutAccountingCashLoansIdResponse> mobilePutAccountingCashLoansById(String id, CashOperationUpdateRequest cashOperationUpdateRequest) async
    test('test mobilePutAccountingCashLoansById', () async {
      // TODO
    });

  });
}
