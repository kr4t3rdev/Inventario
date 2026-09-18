//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;


class DashboardApi {
  DashboardApi([ApiClient? apiClient]) : apiClient = apiClient ?? defaultApiClient;

  final ApiClient apiClient;

  /// Consultar indicadores del panel principal
  ///
  /// Resume ventas, ingresos y alertas de inventario para una ubicación operativa. Permite precisar la consulta mediante ubicación, tipo de ubicación.
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
  Future<Response> mobileGetDashboardStatsWithHttpInfo({ String? ubicacionId, String? tipoUbicacion, }) async {
    // ignore: prefer_const_declarations
    final path = r'/dashboard/stats';

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

  /// Consultar indicadores del panel principal
  ///
  /// Resume ventas, ingresos y alertas de inventario para una ubicación operativa. Permite precisar la consulta mediante ubicación, tipo de ubicación.
  ///
  /// Parameters:
  ///
  /// * [String] ubicacionId:
  ///   Valor de ubicacionId aceptado por el handler.
  ///
  /// * [String] tipoUbicacion:
  ///   Valor de tipoUbicacion aceptado por el handler.
  Future<GetDashboardStatsResponse?> mobileGetDashboardStats({ String? ubicacionId, String? tipoUbicacion, }) async {
    final response = await mobileGetDashboardStatsWithHttpInfo( ubicacionId: ubicacionId, tipoUbicacion: tipoUbicacion, );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetDashboardStatsResponse',) as GetDashboardStatsResponse;
    
    }
    return null;
  }
}
