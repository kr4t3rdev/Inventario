//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;


class ProductsApi {
  ProductsApi([ApiClient? apiClient]) : apiClient = apiClient ?? defaultApiClient;

  final ApiClient apiClient;

  /// Consultar productos
  ///
  /// Devuelve el catálogo de productos disponible para el tenant autenticado.
  ///
  /// Note: This method returns the HTTP [Response].
  Future<Response> mobileGetProductsWithHttpInfo() async {
    // ignore: prefer_const_declarations
    final path = r'/products';

    // ignore: prefer_final_locals
    Object? postBody;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    const contentTypes = <String>[];


    return apiClient.invokeAPI(
      path,
      'GET',
      queryParams,
      postBody,
      headerParams,
      formParams,
      contentTypes.isEmpty ? null : contentTypes.first,
    );
  }

  /// Consultar productos
  ///
  /// Devuelve el catálogo de productos disponible para el tenant autenticado.
  Future<GetProductsResponse?> mobileGetProducts() async {
    final response = await mobileGetProductsWithHttpInfo();
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetProductsResponse',) as GetProductsResponse;
    
    }
    return null;
  }

  /// Consultar producto
  ///
  /// Devuelve precio, costo, estado y datos de inventario del producto identificado.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador único del recurso.
  Future<Response> mobileGetProductsByIdWithHttpInfo(String id,) async {
    // ignore: prefer_const_declarations
    final path = r'/products/{id}'
      .replaceAll('{id}', id);

    // ignore: prefer_final_locals
    Object? postBody;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    const contentTypes = <String>[];


    return apiClient.invokeAPI(
      path,
      'GET',
      queryParams,
      postBody,
      headerParams,
      formParams,
      contentTypes.isEmpty ? null : contentTypes.first,
    );
  }

  /// Consultar producto
  ///
  /// Devuelve precio, costo, estado y datos de inventario del producto identificado.
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador único del recurso.
  Future<GetProductsIdResponse?> mobileGetProductsById(String id,) async {
    final response = await mobileGetProductsByIdWithHttpInfo(id,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetProductsIdResponse',) as GetProductsIdResponse;
    
    }
    return null;
  }

  /// Consultar existencias por ubicación
  ///
  /// Devuelve el inventario disponible en un almacén o punto de venta específico.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] ubicacionId:
  ///   Valor de ubicacionId aceptado por el handler.
  ///
  /// * [String] tipoUbicacion:
  ///   Valor de tipoUbicacion aceptado por el handler.
  ///
  /// * [String] includeZero:
  ///   Valor de includeZero aceptado por el handler.
  Future<Response> mobileGetProductsStockWithHttpInfo({ String? ubicacionId, String? tipoUbicacion, String? includeZero, }) async {
    // ignore: prefer_const_declarations
    final path = r'/products/stock';

    // ignore: prefer_final_locals
    Object? postBody;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    if (ubicacionId != null) {
      queryParams.addAll(_queryParams('', 'ubicacionId', ubicacionId));
    }
    if (tipoUbicacion != null) {
      queryParams.addAll(_queryParams('', 'tipoUbicacion', tipoUbicacion));
    }
    if (includeZero != null) {
      queryParams.addAll(_queryParams('', 'includeZero', includeZero));
    }

    const contentTypes = <String>[];


    return apiClient.invokeAPI(
      path,
      'GET',
      queryParams,
      postBody,
      headerParams,
      formParams,
      contentTypes.isEmpty ? null : contentTypes.first,
    );
  }

  /// Consultar existencias por ubicación
  ///
  /// Devuelve el inventario disponible en un almacén o punto de venta específico.
  ///
  /// Parameters:
  ///
  /// * [String] ubicacionId:
  ///   Valor de ubicacionId aceptado por el handler.
  ///
  /// * [String] tipoUbicacion:
  ///   Valor de tipoUbicacion aceptado por el handler.
  ///
  /// * [String] includeZero:
  ///   Valor de includeZero aceptado por el handler.
  Future<GetProductsStockResponse?> mobileGetProductsStock({ String? ubicacionId, String? tipoUbicacion, String? includeZero, }) async {
    final response = await mobileGetProductsStockWithHttpInfo( ubicacionId: ubicacionId, tipoUbicacion: tipoUbicacion, includeZero: includeZero, );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetProductsStockResponse',) as GetProductsStockResponse;
    
    }
    return null;
  }
}
