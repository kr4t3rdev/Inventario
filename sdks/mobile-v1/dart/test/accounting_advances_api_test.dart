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


/// tests for AccountingAdvancesApi
void main() {
  // final instance = AccountingAdvancesApi();

  group('tests for AccountingAdvancesApi', () {
    // Eliminar anticipo
    //
    // Elimina el anticipo identificado después de comprobar que pertenece al tenant.
    //
    //Future<DeleteAccountingAdvancesIdResponse> mobileDeleteAccountingAdvancesById(String id) async
    test('test mobileDeleteAccountingAdvancesById', () async {
      // TODO
    });

    // Consultar anticipos
    //
    // Consulta anticipos de pago o cobro con su saldo disponible y vigencia.
    //
    //Future<GetAccountingAdvancesResponse> mobileGetAccountingAdvances() async
    test('test mobileGetAccountingAdvances', () async {
      // TODO
    });

    // Consultar anticipos disponibles
    //
    // Busca anticipos reservados con saldo que todavía pueden aplicarse a una compra o factura. Permite precisar la consulta mediante contexto de uso, proveedor, cliente, moneda, estado.
    //
    //Future<GetAccountingAdvancesAvailableResponse> mobileGetAccountingAdvancesAvailable({ String contexto, String proveedorId, String clienteId, String moneda, bool estado }) async
    test('test mobileGetAccountingAdvancesAvailable', () async {
      // TODO
    });

    // Consultar anticipo
    //
    // Devuelve el anticipo solicitado con contrato, contraparte y movimientos relacionados.
    //
    //Future<GetAccountingAdvancesIdResponse> mobileGetAccountingAdvancesById(String id) async
    test('test mobileGetAccountingAdvancesById', () async {
      // TODO
    });

    // Registrar anticipos
    //
    // Crea una reserva de anticipo de pago o cobro, vinculada al contrato y contraparte indicados.
    //
    //Future<PostAccountingAdvancesResponse> mobilePostAccountingAdvances(AccountingAdvancesPostRequest accountingAdvancesPostRequest) async
    test('test mobilePostAccountingAdvances', () async {
      // TODO
    });

    // Ejecutar anticipo reservado
    //
    // Aplica el saldo completo del anticipo al documento destino con control de idempotencia y período contable.
    //
    //Future<PostAccountingAdvancesIdEjecutarResponse> mobilePostAccountingAdvancesByIdEjecutar(String id, AccountingAdvancesIdEjecutarPostRequest accountingAdvancesIdEjecutarPostRequest) async
    test('test mobilePostAccountingAdvancesByIdEjecutar', () async {
      // TODO
    });

    // Revertir ejecución de anticipo
    //
    // Revierte el importe aplicado al documento destino y restablece el estado contable correspondiente.
    //
    //Future<PostAccountingAdvancesIdRevertirResponse> mobilePostAccountingAdvancesByIdRevertir(String id, AccountingAdvancesIdRevertirPostRequest accountingAdvancesIdRevertirPostRequest) async
    test('test mobilePostAccountingAdvancesByIdRevertir', () async {
      // TODO
    });

    // Actualizar anticipo
    //
    // Modifica estado, saldo disponible, vigencia o referencia externa del anticipo existente.
    //
    //Future<PutAccountingAdvancesIdResponse> mobilePutAccountingAdvancesById(String id, AccountingAdvancesIdPutRequest accountingAdvancesIdPutRequest) async
    test('test mobilePutAccountingAdvancesById', () async {
      // TODO
    });

  });
}
