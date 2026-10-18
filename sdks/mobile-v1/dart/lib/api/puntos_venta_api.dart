//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;


class PuntosVentaApi {
  PuntosVentaApi([ApiClient? apiClient]) : apiClient = apiClient ?? defaultApiClient;

  final ApiClient apiClient;

  /// Detalle de punto de venta
  ///
  /// Detalle de un punto de venta.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  Future<Response> mobileGetPuntoVentaByIdWithHttpInfo(String id,) async {
    // ignore: prefer_const_declarations
    final path = r'/puntos-venta/{id}'
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

  /// Detalle de punto de venta
  ///
  /// Detalle de un punto de venta.
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  Future<GetPuntosVentaDetailResponse?> mobileGetPuntoVentaById(String id,) async {
    final response = await mobileGetPuntoVentaByIdWithHttpInfo(id,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetPuntosVentaDetailResponse',) as GetPuntosVentaDetailResponse;
    
    }
    return null;
  }

  /// Listar puntos de venta
  ///
  /// Puntos de venta del tenant.
  ///
  /// Note: This method returns the HTTP [Response].
  Future<Response> mobileListPuntosVentaWithHttpInfo() async {
    // ignore: prefer_const_declarations
    final path = r'/puntos-venta';

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

  /// Listar puntos de venta
  ///
  /// Puntos de venta del tenant.
  Future<GetPuntosVentaListResponse?> mobileListPuntosVenta() async {
    final response = await mobileListPuntosVentaWithHttpInfo();
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetPuntosVentaListResponse',) as GetPuntosVentaListResponse;
    
    }
    return null;
  }
}
