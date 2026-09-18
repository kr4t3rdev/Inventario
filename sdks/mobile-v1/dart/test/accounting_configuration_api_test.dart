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


/// tests for AccountingConfigurationApi
void main() {
  // final instance = AccountingConfigurationApi();

  group('tests for AccountingConfigurationApi', () {
    // Eliminar tipos de pago
    //
    // Elimina el medio de pago únicamente cuando no tiene conciliaciones asociadas.
    //
    //Future<DeleteAccountingPaymentTypesIdResponse> mobileDeleteAccountingPaymentTypesById(String id) async
    test('test mobileDeleteAccountingPaymentTypesById', () async {
      // TODO
    });

    // Consultar monedas configuradas
    //
    // Devuelve el catálogo de monedas habilitadas para operaciones y reportes contables.
    //
    //Future<GetAccountingExchangeMonedasResponse> mobileGetAccountingExchangeMonedas() async
    test('test mobileGetAccountingExchangeMonedas', () async {
      // TODO
    });

    // Consultar tasas de cambio
    //
    // Devuelve las tasas de cambio vigentes e históricas utilizadas por contabilidad.
    //
    //Future<GetAccountingExchangeTasasResponse> mobileGetAccountingExchangeTasas() async
    test('test mobileGetAccountingExchangeTasas', () async {
      // TODO
    });

    // Consultar eventos de auditoría contable
    //
    // Consulta la trazabilidad de acciones contables registrada por usuario y entidad. Permite precisar la consulta mediante entidad, límite por página, offset.
    //
    //Future<GetAccountingLogsResponse> mobileGetAccountingLogs({ String entidad, int limit, String offset }) async
    test('test mobileGetAccountingLogs', () async {
      // TODO
    });

    // Consultar tipos de pago
    //
    // Lista los medios de pago configurados y su cuenta bancaria predeterminada. Permite precisar la consulta mediante includeInactive, requiereCuenta.
    //
    //Future<GetAccountingPaymentTypesResponse> mobileGetAccountingPaymentTypes({ bool includeInactive, String requiereCuenta }) async
    test('test mobileGetAccountingPaymentTypes', () async {
      // TODO
    });

    // Consultar cuentas disponibles para tipos de pago
    //
    // Lista cuentas activas que pueden asociarse como cuenta predeterminada de un medio de pago. Permite precisar la consulta mediante moneda, tipoCuenta.
    //
    //Future<GetAccountingPaymentTypesAvailableAccountsResponse> mobileGetAccountingPaymentTypesAvailableAccounts({ String moneda, String tipoCuenta }) async
    test('test mobileGetAccountingPaymentTypesAvailableAccounts', () async {
      // TODO
    });

    // Consultar tipos de pago
    //
    // Devuelve el medio de pago identificado, sus conciliaciones asociadas y la cuenta predeterminada.
    //
    //Future<GetAccountingPaymentTypesIdResponse> mobileGetAccountingPaymentTypesById(String id) async
    test('test mobileGetAccountingPaymentTypesById', () async {
      // TODO
    });

    // Actualizar tipos de pago
    //
    // Actualiza nombre, descripción, requisito de cuenta, cuenta predeterminada o estado activo del medio de pago.
    //
    //Future<PutAccountingPaymentTypesIdResponse> mobilePutAccountingPaymentTypesById(String id, PaymentTypeUpdateRequest paymentTypeUpdateRequest) async
    test('test mobilePutAccountingPaymentTypesById', () async {
      // TODO
    });

  });
}
