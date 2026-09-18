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


/// tests for AccountingBankingApi
void main() {
  // final instance = AccountingBankingApi();

  group('tests for AccountingBankingApi', () {
    // Consultar cuentas bancarias
    //
    // Lista las cuentas bancarias activas disponibles para operaciones contables.
    //
    //Future<GetAccountingBankAccountsResponse> mobileGetAccountingBankAccounts() async
    test('test mobileGetAccountingBankAccounts', () async {
      // TODO
    });

    // Consultar cuentas bancaria
    //
    // Devuelve datos, saldo y moneda de la cuenta bancaria identificada.
    //
    //Future<GetAccountingBankAccountsIdResponse> mobileGetAccountingBankAccountsById(String id) async
    test('test mobileGetAccountingBankAccountsById', () async {
      // TODO
    });

    // Consultar historial de cuentas bancarias
    //
    // Devuelve los movimientos cronológicos asociados al registro solicitado para facilitar su trazabilidad.
    //
    //Future<GetAccountingBankAccountsIdHistoryResponse> mobileGetAccountingBankAccountsByIdNestedHistory(String id, { DateTime fechaInicio, DateTime fechaFin, String tipoMovimiento, int page, int limit }) async
    test('test mobileGetAccountingBankAccountsByIdNestedHistory', () async {
      // TODO
    });

    // Consultar ajustes bancarios
    //
    // Lista ingresos y egresos manuales registrados sobre cuentas bancarias. Permite precisar la consulta mediante cuenta bancaria, tipo, fecha inicial, fecha final, página, límite por página.
    //
    //Future<GetAccountingBankAdjustmentsResponse> mobileGetAccountingBankAdjustments({ String cuentaId, String tipo, DateTime fechaInicio, DateTime fechaFin, int page, int limit }) async
    test('test mobileGetAccountingBankAdjustments', () async {
      // TODO
    });

    // Consultar transferencias bancarias
    //
    // Lista transferencias entre cuentas con importes de origen, destino y tasa aplicada. Permite precisar la consulta mediante fecha inicial, fecha final, cuenta bancaria.
    //
    //Future<GetAccountingBankTransfersResponse> mobileGetAccountingBankTransfers({ DateTime fechaInicio, DateTime fechaFin, String cuentaId }) async
    test('test mobileGetAccountingBankTransfers', () async {
      // TODO
    });

    // Consultar transferencias bancaria
    //
    // Devuelve importes, cuentas, moneda, tasa y comprobante de la transferencia identificada.
    //
    //Future<GetAccountingBankTransfersIdResponse> mobileGetAccountingBankTransfersById(String id) async
    test('test mobileGetAccountingBankTransfersById', () async {
      // TODO
    });

    // Descargar comprobante de transferencias bancarias
    //
    // Genera el comprobante PDF del registro solicitado, conservando sus importes y referencias contables.
    //
    //Future<MultipartFile> mobileGetAccountingBankTransfersByIdComprobante(String id) async
    test('test mobileGetAccountingBankTransfersByIdComprobante', () async {
      // TODO
    });

    // Registrar ajustes bancarios
    //
    // Registra un ingreso o egreso manual y actualiza el saldo de la cuenta bancaria seleccionada.
    //
    //Future<PostAccountingBankAdjustmentsResponse> mobilePostAccountingBankAdjustments(BankAdjustmentRequest bankAdjustmentRequest, { String cuentaId, String tipo, DateTime fechaInicio, DateTime fechaFin, int page, int limit }) async
    test('test mobilePostAccountingBankAdjustments', () async {
      // TODO
    });

    // Registrar transferencias bancarias
    //
    // Transfiere fondos entre dos cuentas, aplicando conversión cuando las monedas son diferentes.
    //
    //Future<PostAccountingBankTransfersResponse> mobilePostAccountingBankTransfers(BankTransferCreateRequest bankTransferCreateRequest, { DateTime fechaInicio, DateTime fechaFin, String cuentaId }) async
    test('test mobilePostAccountingBankTransfers', () async {
      // TODO
    });

    // Validar transferencia bancaria
    //
    // Comprueba cuentas, monedas, saldo e importes antes de registrar una transferencia.
    //
    //Future<PostAccountingBankTransfersValidateResponse> mobilePostAccountingBankTransfersValidate(BankTransferValidationRequest bankTransferValidationRequest) async
    test('test mobilePostAccountingBankTransfersValidate', () async {
      // TODO
    });

  });
}
