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


/// tests for SalesApi
void main() {
  // final instance = SalesApi();

  group('tests for SalesApi', () {
    // Consultar ventas
    //
    // Devuelve las ventas activas con sus líneas, totales y relaciones de facturación.
    //
    //Future<GetSalesResponse> mobileGetSales() async
    test('test mobileGetSales', () async {
      // TODO
    });

    // Consultar venta
    //
    // Devuelve la venta identificada con líneas, cliente, turno, factura y conciliaciones.
    //
    //Future<GetSalesIdResponse> mobileGetSalesById(String id) async
    test('test mobileGetSalesById', () async {
      // TODO
    });

    // Actualizar datos de venta
    //
    // Modifica únicamente el descuento y las observaciones editables de la venta seleccionada.
    //
    //Future<PatchSalesIdUpdateResponse> mobilePatchSalesByIdUpdate(String id, SaleUpdateRequest saleUpdateRequest) async
    test('test mobilePatchSalesByIdUpdate', () async {
      // TODO
    });

    // Anular venta
    //
    // Anula la venta seleccionada y revierte los efectos permitidos sobre inventario y conciliaciones.
    //
    //Future<PostSalesIdCancelResponse> mobilePostSalesByIdCancel(String id, SaleCancelRequest saleCancelRequest) async
    test('test mobilePostSalesByIdCancel', () async {
      // TODO
    });

    // Registrar venta
    //
    // Crea la venta, sus líneas y los efectos de inventario, turno y facturación que correspondan.
    //
    //Future<PostSalesCreateResponse> mobilePostSalesCreate(SaleCreateRequest saleCreateRequest) async
    test('test mobilePostSalesCreate', () async {
      // TODO
    });

  });
}
