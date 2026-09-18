//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;


class SalesApi {
  SalesApi([ApiClient? apiClient]) : apiClient = apiClient ?? defaultApiClient;

  final ApiClient apiClient;

  /// Consultar ventas
  ///
  /// Devuelve las ventas activas con sus líneas, totales y relaciones de facturación.
  ///
  /// Note: This method returns the HTTP [Response].
  Future<Response> mobileGetSalesWithHttpInfo() async {
    // ignore: prefer_const_declarations
    final path = r'/sales';

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

  /// Consultar ventas
  ///
  /// Devuelve las ventas activas con sus líneas, totales y relaciones de facturación.
  Future<GetSalesResponse?> mobileGetSales() async {
    final response = await mobileGetSalesWithHttpInfo();
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetSalesResponse',) as GetSalesResponse;
    
    }
    return null;
  }

  /// Consultar venta
  ///
  /// Devuelve la venta identificada con líneas, cliente, turno, factura y conciliaciones.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador único del recurso.
  Future<Response> mobileGetSalesByIdWithHttpInfo(String id,) async {
    // ignore: prefer_const_declarations
    final path = r'/sales/{id}'
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

  /// Consultar venta
  ///
  /// Devuelve la venta identificada con líneas, cliente, turno, factura y conciliaciones.
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador único del recurso.
  Future<GetSalesIdResponse?> mobileGetSalesById(String id,) async {
    final response = await mobileGetSalesByIdWithHttpInfo(id,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetSalesIdResponse',) as GetSalesIdResponse;
    
    }
    return null;
  }

  /// Actualizar datos de venta
  ///
  /// Modifica únicamente el descuento y las observaciones editables de la venta seleccionada.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador único del recurso.
  ///
  /// * [SaleUpdateRequest] saleUpdateRequest (required):
  Future<Response> mobilePatchSalesByIdUpdateWithHttpInfo(String id, SaleUpdateRequest saleUpdateRequest,) async {
    // ignore: prefer_const_declarations
    final path = r'/sales/{id}/update'
      .replaceAll('{id}', id);

    // ignore: prefer_final_locals
    Object? postBody = saleUpdateRequest;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    const contentTypes = <String>['application/json'];


    return apiClient.invokeAPI(
      path,
      'PATCH',
      queryParams,
      postBody,
      headerParams,
      formParams,
      contentTypes.isEmpty ? null : contentTypes.first,
    );
  }

  /// Actualizar datos de venta
  ///
  /// Modifica únicamente el descuento y las observaciones editables de la venta seleccionada.
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador único del recurso.
  ///
  /// * [SaleUpdateRequest] saleUpdateRequest (required):
  Future<PatchSalesIdUpdateResponse?> mobilePatchSalesByIdUpdate(String id, SaleUpdateRequest saleUpdateRequest,) async {
    final response = await mobilePatchSalesByIdUpdateWithHttpInfo(id, saleUpdateRequest,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'PatchSalesIdUpdateResponse',) as PatchSalesIdUpdateResponse;
    
    }
    return null;
  }

  /// Anular venta
  ///
  /// Anula la venta seleccionada y revierte los efectos permitidos sobre inventario y conciliaciones.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador único del recurso.
  ///
  /// * [SaleCancelRequest] saleCancelRequest (required):
  Future<Response> mobilePostSalesByIdCancelWithHttpInfo(String id, SaleCancelRequest saleCancelRequest,) async {
    // ignore: prefer_const_declarations
    final path = r'/sales/{id}/cancel'
      .replaceAll('{id}', id);

    // ignore: prefer_final_locals
    Object? postBody = saleCancelRequest;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    const contentTypes = <String>['application/json'];


    return apiClient.invokeAPI(
      path,
      'POST',
      queryParams,
      postBody,
      headerParams,
      formParams,
      contentTypes.isEmpty ? null : contentTypes.first,
    );
  }

  /// Anular venta
  ///
  /// Anula la venta seleccionada y revierte los efectos permitidos sobre inventario y conciliaciones.
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador único del recurso.
  ///
  /// * [SaleCancelRequest] saleCancelRequest (required):
  Future<PostSalesIdCancelResponse?> mobilePostSalesByIdCancel(String id, SaleCancelRequest saleCancelRequest,) async {
    final response = await mobilePostSalesByIdCancelWithHttpInfo(id, saleCancelRequest,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'PostSalesIdCancelResponse',) as PostSalesIdCancelResponse;
    
    }
    return null;
  }

  /// Registrar venta
  ///
  /// Crea la venta, sus líneas y los efectos de inventario, turno y facturación que correspondan.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [SaleCreateRequest] saleCreateRequest (required):
  Future<Response> mobilePostSalesCreateWithHttpInfo(SaleCreateRequest saleCreateRequest,) async {
    // ignore: prefer_const_declarations
    final path = r'/sales/create';

    // ignore: prefer_final_locals
    Object? postBody = saleCreateRequest;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    const contentTypes = <String>['application/json'];


    return apiClient.invokeAPI(
      path,
      'POST',
      queryParams,
      postBody,
      headerParams,
      formParams,
      contentTypes.isEmpty ? null : contentTypes.first,
    );
  }

  /// Registrar venta
  ///
  /// Crea la venta, sus líneas y los efectos de inventario, turno y facturación que correspondan.
  ///
  /// Parameters:
  ///
  /// * [SaleCreateRequest] saleCreateRequest (required):
  Future<PostSalesCreateResponse?> mobilePostSalesCreate(SaleCreateRequest saleCreateRequest,) async {
    final response = await mobilePostSalesCreateWithHttpInfo(saleCreateRequest,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'PostSalesCreateResponse',) as PostSalesCreateResponse;
    
    }
    return null;
  }
}
