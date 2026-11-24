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


/// tests for ProductsApi
void main() {
  // final instance = ProductsApi();

  group('tests for ProductsApi', () {
    // Consultar productos
    //
    // Devuelve el catálogo de productos disponible para el tenant autenticado.
    //
    //Future<GetProductsResponse> mobileGetProducts() async
    test('test mobileGetProducts', () async {
      // TODO
    });

    // Consultar producto
    //
    // Devuelve precio, costo, estado y datos de inventario del producto identificado.
    //
    //Future<GetProductsIdResponse> mobileGetProductsById(String id) async
    test('test mobileGetProductsById', () async {
      // TODO
    });

    // Consultar existencias por ubicación
    //
    // Devuelve el inventario disponible en un almacén o punto de venta específico.
    //
    //Future<GetProductsStockResponse> mobileGetProductsStock({ String ubicacionId, String tipoUbicacion, String includeZero }) async
    test('test mobileGetProductsStock', () async {
      // TODO
    });

    // Consultar cambios incrementales de productos
    //
    // Entrega cambios de producto y stock en orden ascendente de secuencia. La ventana queda acotada durante la paginación; no se aplica expiración automática ni purga de eventos en esta fase.
    //
    //Future<GetProductsSyncChangesResponse> mobileGetProductsSyncChanges(String cursor, { int limit }) async
    test('test mobileGetProductsSyncChanges', () async {
      // TODO
    });

    // Obtener una página inicial del catálogo sincronizable
    //
    // Devuelve páginas ordenadas por identificador y una marca de agua fija. Los cambios posteriores a esa marca se reproducen desde el feed; el cliente debe aplicar upserts de forma idempotente. La respuesta no incluye costo.
    //
    //Future<GetProductsSyncSnapshotResponse> mobileGetProductsSyncSnapshot({ int limit, String pageToken }) async
    test('test mobileGetProductsSyncSnapshot', () async {
      // TODO
    });

  });
}
