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

  /// Consultar promedio diario de ingresos
  ///
  /// Promedio de ingresos diarios (30 días).
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
  Future<Response> mobileGetDashboardDailyAverageWithHttpInfo({ String? ubicacionId, String? tipoUbicacion, }) async {
    // ignore: prefer_const_declarations
    final path = r'/dashboard/daily-average';

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

  /// Consultar promedio diario de ingresos
  ///
  /// Promedio de ingresos diarios (30 días).
  ///
  /// Parameters:
  ///
  /// * [String] ubicacionId:
  ///   Valor de ubicacionId aceptado por el handler.
  ///
  /// * [String] tipoUbicacion:
  ///   Valor de tipoUbicacion aceptado por el handler.
  Future<DashboardValueResponse?> mobileGetDashboardDailyAverage({ String? ubicacionId, String? tipoUbicacion, }) async {
    final response = await mobileGetDashboardDailyAverageWithHttpInfo( ubicacionId: ubicacionId, tipoUbicacion: tipoUbicacion, );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'DashboardValueResponse',) as DashboardValueResponse;
    
    }
    return null;
  }

  /// Consultar ingresos vs gastos del panel
  ///
  /// Ingresos y gastos totales más la serie mensual para la gráfica del panel.
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
  Future<Response> mobileGetDashboardIncomeExpensesWithHttpInfo({ String? ubicacionId, String? tipoUbicacion, }) async {
    // ignore: prefer_const_declarations
    final path = r'/dashboard/income-expenses';

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

  /// Consultar ingresos vs gastos del panel
  ///
  /// Ingresos y gastos totales más la serie mensual para la gráfica del panel.
  ///
  /// Parameters:
  ///
  /// * [String] ubicacionId:
  ///   Valor de ubicacionId aceptado por el handler.
  ///
  /// * [String] tipoUbicacion:
  ///   Valor de tipoUbicacion aceptado por el handler.
  Future<DashboardIncomeExpenseResponse?> mobileGetDashboardIncomeExpenses({ String? ubicacionId, String? tipoUbicacion, }) async {
    final response = await mobileGetDashboardIncomeExpensesWithHttpInfo( ubicacionId: ubicacionId, tipoUbicacion: tipoUbicacion, );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'DashboardIncomeExpenseResponse',) as DashboardIncomeExpenseResponse;
    
    }
    return null;
  }

  /// Consultar valor total del inventario
  ///
  /// Valor total del inventario en stock.
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
  Future<Response> mobileGetDashboardInventoryValueWithHttpInfo({ String? ubicacionId, String? tipoUbicacion, }) async {
    // ignore: prefer_const_declarations
    final path = r'/dashboard/inventory-value';

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

  /// Consultar valor total del inventario
  ///
  /// Valor total del inventario en stock.
  ///
  /// Parameters:
  ///
  /// * [String] ubicacionId:
  ///   Valor de ubicacionId aceptado por el handler.
  ///
  /// * [String] tipoUbicacion:
  ///   Valor de tipoUbicacion aceptado por el handler.
  Future<DashboardValueResponse?> mobileGetDashboardInventoryValue({ String? ubicacionId, String? tipoUbicacion, }) async {
    final response = await mobileGetDashboardInventoryValueWithHttpInfo( ubicacionId: ubicacionId, tipoUbicacion: tipoUbicacion, );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'DashboardValueResponse',) as DashboardValueResponse;
    
    }
    return null;
  }

  /// Consultar productos con stock bajo
  ///
  /// Productos con stock bajo o crítico (top 5).
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
  Future<Response> mobileGetDashboardLowStockWithHttpInfo({ String? ubicacionId, String? tipoUbicacion, }) async {
    // ignore: prefer_const_declarations
    final path = r'/dashboard/low-stock';

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

  /// Consultar productos con stock bajo
  ///
  /// Productos con stock bajo o crítico (top 5).
  ///
  /// Parameters:
  ///
  /// * [String] ubicacionId:
  ///   Valor de ubicacionId aceptado por el handler.
  ///
  /// * [String] tipoUbicacion:
  ///   Valor de tipoUbicacion aceptado por el handler.
  Future<DashboardLowStockResponse?> mobileGetDashboardLowStock({ String? ubicacionId, String? tipoUbicacion, }) async {
    final response = await mobileGetDashboardLowStockWithHttpInfo( ubicacionId: ubicacionId, tipoUbicacion: tipoUbicacion, );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'DashboardLowStockResponse',) as DashboardLowStockResponse;
    
    }
    return null;
  }

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

  /// Consultar distribución de stock
  ///
  /// Distribución de stock por categoría.
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
  Future<Response> mobileGetDashboardStockDistributionWithHttpInfo({ String? ubicacionId, String? tipoUbicacion, }) async {
    // ignore: prefer_const_declarations
    final path = r'/dashboard/stock-distribution';

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

  /// Consultar distribución de stock
  ///
  /// Distribución de stock por categoría.
  ///
  /// Parameters:
  ///
  /// * [String] ubicacionId:
  ///   Valor de ubicacionId aceptado por el handler.
  ///
  /// * [String] tipoUbicacion:
  ///   Valor de tipoUbicacion aceptado por el handler.
  Future<DashboardStockDistributionResponse?> mobileGetDashboardStockDistribution({ String? ubicacionId, String? tipoUbicacion, }) async {
    final response = await mobileGetDashboardStockDistributionWithHttpInfo( ubicacionId: ubicacionId, tipoUbicacion: tipoUbicacion, );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'DashboardStockDistributionResponse',) as DashboardStockDistributionResponse;
    
    }
    return null;
  }

  /// Consultar ventas de hoy
  ///
  /// Ingresos por ventas del día actual.
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
  Future<Response> mobileGetDashboardTodaySalesWithHttpInfo({ String? ubicacionId, String? tipoUbicacion, }) async {
    // ignore: prefer_const_declarations
    final path = r'/dashboard/today-sales';

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

  /// Consultar ventas de hoy
  ///
  /// Ingresos por ventas del día actual.
  ///
  /// Parameters:
  ///
  /// * [String] ubicacionId:
  ///   Valor de ubicacionId aceptado por el handler.
  ///
  /// * [String] tipoUbicacion:
  ///   Valor de tipoUbicacion aceptado por el handler.
  Future<DashboardValueResponse?> mobileGetDashboardTodaySales({ String? ubicacionId, String? tipoUbicacion, }) async {
    final response = await mobileGetDashboardTodaySalesWithHttpInfo( ubicacionId: ubicacionId, tipoUbicacion: tipoUbicacion, );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'DashboardValueResponse',) as DashboardValueResponse;
    
    }
    return null;
  }

  /// Consultar productos más vendidos
  ///
  /// Top 10 de productos más vendidos del período.
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
  Future<Response> mobileGetDashboardTopProductsWithHttpInfo({ String? ubicacionId, String? tipoUbicacion, }) async {
    // ignore: prefer_const_declarations
    final path = r'/dashboard/top-products';

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

  /// Consultar productos más vendidos
  ///
  /// Top 10 de productos más vendidos del período.
  ///
  /// Parameters:
  ///
  /// * [String] ubicacionId:
  ///   Valor de ubicacionId aceptado por el handler.
  ///
  /// * [String] tipoUbicacion:
  ///   Valor de tipoUbicacion aceptado por el handler.
  Future<DashboardTopProductsResponse?> mobileGetDashboardTopProducts({ String? ubicacionId, String? tipoUbicacion, }) async {
    final response = await mobileGetDashboardTopProductsWithHttpInfo( ubicacionId: ubicacionId, tipoUbicacion: tipoUbicacion, );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'DashboardTopProductsResponse',) as DashboardTopProductsResponse;
    
    }
    return null;
  }

  /// Consultar transferencias entre ubicaciones
  ///
  /// Conteo de transferencias entre almacenes y puntos de venta.
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
  Future<Response> mobileGetDashboardTransfersWithHttpInfo({ String? ubicacionId, String? tipoUbicacion, }) async {
    // ignore: prefer_const_declarations
    final path = r'/dashboard/transfers';

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

  /// Consultar transferencias entre ubicaciones
  ///
  /// Conteo de transferencias entre almacenes y puntos de venta.
  ///
  /// Parameters:
  ///
  /// * [String] ubicacionId:
  ///   Valor de ubicacionId aceptado por el handler.
  ///
  /// * [String] tipoUbicacion:
  ///   Valor de tipoUbicacion aceptado por el handler.
  Future<DashboardTransfersResponse?> mobileGetDashboardTransfers({ String? ubicacionId, String? tipoUbicacion, }) async {
    final response = await mobileGetDashboardTransfersWithHttpInfo( ubicacionId: ubicacionId, tipoUbicacion: tipoUbicacion, );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'DashboardTransfersResponse',) as DashboardTransfersResponse;
    
    }
    return null;
  }
}
