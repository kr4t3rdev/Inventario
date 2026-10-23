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


/// tests for AccountingCapitalApi
void main() {
  // final instance = AccountingCapitalApi();

  group('tests for AccountingCapitalApi', () {
    // Consultar inyecciones de capital
    //
    // Lista aportes de capital registrados para el tenant. Permite precisar la consulta mediante tipo.
    //
    //Future<GetAccountingCapitalInjectionsResponse> mobileGetAccountingCapitalInjections({ String tipo }) async
    test('test mobileGetAccountingCapitalInjections', () async {
      // TODO
    });

    // Registrar inyecciones de capital
    //
    // Registra un aporte de capital y lo vincula con la cuenta bancaria indicada cuando corresponde. Para idempotencia, acepta idempotencyKey en el cuerpo o Idempotency-Key en el encabezado. Si ambos están presentes, prevalece el valor del cuerpo. La clave debe ser una cadena de 1 a 64 caracteres; se eliminan espacios al inicio y al final.
    //
    //Future<PostAccountingCapitalInjectionsResponse> mobilePostAccountingCapitalInjections(CapitalInjectionCreateRequest capitalInjectionCreateRequest, { String idempotencyKey, String tipo }) async
    test('test mobilePostAccountingCapitalInjections', () async {
      // TODO
    });

    // Registrar pago de inyecciones de capital
    //
    // Aplica un pago al saldo pendiente y registra sus efectos bancarios y contables.
    //
    //Future<PostAccountingCapitalInjectionsIdPaymentsResponse> mobilePostAccountingCapitalInjectionsByIdPayments(String id, CapitalPaymentRequest capitalPaymentRequest) async
    test('test mobilePostAccountingCapitalInjectionsByIdPayments', () async {
      // TODO
    });

  });
}
