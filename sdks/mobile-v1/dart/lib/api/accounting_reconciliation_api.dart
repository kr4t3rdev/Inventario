//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;


class AccountingReconciliationApi {
  AccountingReconciliationApi([ApiClient? apiClient]) : apiClient = apiClient ?? defaultApiClient;

  final ApiClient apiClient;

  /// Consultar conciliación de gastos
  ///
  /// Lista gastos pendientes de conciliación bancaria. Permite precisar la consulta mediante tipoGasto, fecha inicial, fecha final, página, límite por página.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] tipoGasto:
  ///   Valor de tipoGasto aceptado por el handler.
  ///
  /// * [DateTime] fechaDesde:
  ///   Valor de fechaDesde aceptado por el handler.
  ///
  /// * [DateTime] fechaHasta:
  ///   Valor de fechaHasta aceptado por el handler.
  ///
  /// * [int] page:
  ///   Página solicitada, comenzando en 1.
  ///
  /// * [int] limit:
  ///   Cantidad máxima de elementos por página.
  Future<Response> mobileGetAccountingReconciliationExpensesWithHttpInfo({ String? tipoGasto, DateTime? fechaDesde, DateTime? fechaHasta, int? page, int? limit, }) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/reconciliation/expenses';

    // ignore: prefer_final_locals
    Object? postBody;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    if (tipoGasto != null) {
      queryParams.addAll(_queryParams('', 'tipoGasto', tipoGasto));
    }
    if (fechaDesde != null) {
      queryParams.addAll(_queryParams('', 'fechaDesde', fechaDesde));
    }
    if (fechaHasta != null) {
      queryParams.addAll(_queryParams('', 'fechaHasta', fechaHasta));
    }
    if (page != null) {
      queryParams.addAll(_queryParams('', 'page', page));
    }
    if (limit != null) {
      queryParams.addAll(_queryParams('', 'limit', limit));
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

  /// Consultar conciliación de gastos
  ///
  /// Lista gastos pendientes de conciliación bancaria. Permite precisar la consulta mediante tipoGasto, fecha inicial, fecha final, página, límite por página.
  ///
  /// Parameters:
  ///
  /// * [String] tipoGasto:
  ///   Valor de tipoGasto aceptado por el handler.
  ///
  /// * [DateTime] fechaDesde:
  ///   Valor de fechaDesde aceptado por el handler.
  ///
  /// * [DateTime] fechaHasta:
  ///   Valor de fechaHasta aceptado por el handler.
  ///
  /// * [int] page:
  ///   Página solicitada, comenzando en 1.
  ///
  /// * [int] limit:
  ///   Cantidad máxima de elementos por página.
  Future<GetAccountingReconciliationExpensesResponse?> mobileGetAccountingReconciliationExpenses({ String? tipoGasto, DateTime? fechaDesde, DateTime? fechaHasta, int? page, int? limit, }) async {
    final response = await mobileGetAccountingReconciliationExpensesWithHttpInfo( tipoGasto: tipoGasto, fechaDesde: fechaDesde, fechaHasta: fechaHasta, page: page, limit: limit, );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetAccountingReconciliationExpensesResponse',) as GetAccountingReconciliationExpensesResponse;
    
    }
    return null;
  }

  /// Consultar historial de conciliaciones de gastos
  ///
  /// Devuelve el historial completo de conciliaciones de gastos. Permite precisar la consulta mediante tipoGasto, cuenta bancaria, fecha inicial, fecha final, periodo, reconciliadoPor, página, límite por página.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] tipoGasto:
  ///   Valor de tipoGasto aceptado por el handler.
  ///
  /// * [String] cuentaId:
  ///   Identificador de la cuenta bancaria.
  ///
  /// * [DateTime] fechaDesde:
  ///   Valor de fechaDesde aceptado por el handler.
  ///
  /// * [DateTime] fechaHasta:
  ///   Valor de fechaHasta aceptado por el handler.
  ///
  /// * [String] periodo:
  ///   Valor de periodo aceptado por el handler.
  ///
  /// * [String] reconciliadoPor:
  ///   Valor de reconciliadoPor aceptado por el handler.
  ///
  /// * [int] page:
  ///   Página solicitada, comenzando en 1.
  ///
  /// * [int] limit:
  ///   Cantidad máxima de elementos por página.
  Future<Response> mobileGetAccountingReconciliationExpensesHistoryWithHttpInfo({ String? tipoGasto, String? cuentaId, DateTime? fechaDesde, DateTime? fechaHasta, String? periodo, String? reconciliadoPor, int? page, int? limit, }) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/reconciliation/expenses-history';

    // ignore: prefer_final_locals
    Object? postBody;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    if (tipoGasto != null) {
      queryParams.addAll(_queryParams('', 'tipoGasto', tipoGasto));
    }
    if (cuentaId != null) {
      queryParams.addAll(_queryParams('', 'cuentaId', cuentaId));
    }
    if (fechaDesde != null) {
      queryParams.addAll(_queryParams('', 'fechaDesde', fechaDesde));
    }
    if (fechaHasta != null) {
      queryParams.addAll(_queryParams('', 'fechaHasta', fechaHasta));
    }
    if (periodo != null) {
      queryParams.addAll(_queryParams('', 'periodo', periodo));
    }
    if (reconciliadoPor != null) {
      queryParams.addAll(_queryParams('', 'reconciliadoPor', reconciliadoPor));
    }
    if (page != null) {
      queryParams.addAll(_queryParams('', 'page', page));
    }
    if (limit != null) {
      queryParams.addAll(_queryParams('', 'limit', limit));
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

  /// Consultar historial de conciliaciones de gastos
  ///
  /// Devuelve el historial completo de conciliaciones de gastos. Permite precisar la consulta mediante tipoGasto, cuenta bancaria, fecha inicial, fecha final, periodo, reconciliadoPor, página, límite por página.
  ///
  /// Parameters:
  ///
  /// * [String] tipoGasto:
  ///   Valor de tipoGasto aceptado por el handler.
  ///
  /// * [String] cuentaId:
  ///   Identificador de la cuenta bancaria.
  ///
  /// * [DateTime] fechaDesde:
  ///   Valor de fechaDesde aceptado por el handler.
  ///
  /// * [DateTime] fechaHasta:
  ///   Valor de fechaHasta aceptado por el handler.
  ///
  /// * [String] periodo:
  ///   Valor de periodo aceptado por el handler.
  ///
  /// * [String] reconciliadoPor:
  ///   Valor de reconciliadoPor aceptado por el handler.
  ///
  /// * [int] page:
  ///   Página solicitada, comenzando en 1.
  ///
  /// * [int] limit:
  ///   Cantidad máxima de elementos por página.
  Future<GetAccountingReconciliationExpensesHistoryResponse?> mobileGetAccountingReconciliationExpensesHistory({ String? tipoGasto, String? cuentaId, DateTime? fechaDesde, DateTime? fechaHasta, String? periodo, String? reconciliadoPor, int? page, int? limit, }) async {
    final response = await mobileGetAccountingReconciliationExpensesHistoryWithHttpInfo( tipoGasto: tipoGasto, cuentaId: cuentaId, fechaDesde: fechaDesde, fechaHasta: fechaHasta, periodo: periodo, reconciliadoPor: reconciliadoPor, page: page, limit: limit, );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetAccountingReconciliationExpensesHistoryResponse',) as GetAccountingReconciliationExpensesHistoryResponse;
    
    }
    return null;
  }

  /// Consultar historial paginado de conciliaciones de gastos
  ///
  /// Devuelve conciliaciones de gastos con estadísticas y control de página. Permite precisar la consulta mediante tipoGasto, cuenta bancaria, fecha inicial, fecha final, periodo, reconciliadoPor, página, límite por página.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] tipoGasto:
  ///   Valor de tipoGasto aceptado por el handler.
  ///
  /// * [String] cuentaId:
  ///   Identificador de la cuenta bancaria.
  ///
  /// * [DateTime] fechaDesde:
  ///   Valor de fechaDesde aceptado por el handler.
  ///
  /// * [DateTime] fechaHasta:
  ///   Valor de fechaHasta aceptado por el handler.
  ///
  /// * [String] periodo:
  ///   Valor de periodo aceptado por el handler.
  ///
  /// * [String] reconciliadoPor:
  ///   Valor de reconciliadoPor aceptado por el handler.
  ///
  /// * [int] page:
  ///   Página solicitada, comenzando en 1.
  ///
  /// * [int] limit:
  ///   Cantidad máxima de elementos por página.
  Future<Response> mobileGetAccountingReconciliationExpensesNestedHistoryWithHttpInfo({ String? tipoGasto, String? cuentaId, DateTime? fechaDesde, DateTime? fechaHasta, String? periodo, String? reconciliadoPor, int? page, int? limit, }) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/reconciliation/expenses/history';

    // ignore: prefer_final_locals
    Object? postBody;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    if (tipoGasto != null) {
      queryParams.addAll(_queryParams('', 'tipoGasto', tipoGasto));
    }
    if (cuentaId != null) {
      queryParams.addAll(_queryParams('', 'cuentaId', cuentaId));
    }
    if (fechaDesde != null) {
      queryParams.addAll(_queryParams('', 'fechaDesde', fechaDesde));
    }
    if (fechaHasta != null) {
      queryParams.addAll(_queryParams('', 'fechaHasta', fechaHasta));
    }
    if (periodo != null) {
      queryParams.addAll(_queryParams('', 'periodo', periodo));
    }
    if (reconciliadoPor != null) {
      queryParams.addAll(_queryParams('', 'reconciliadoPor', reconciliadoPor));
    }
    if (page != null) {
      queryParams.addAll(_queryParams('', 'page', page));
    }
    if (limit != null) {
      queryParams.addAll(_queryParams('', 'limit', limit));
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

  /// Consultar historial paginado de conciliaciones de gastos
  ///
  /// Devuelve conciliaciones de gastos con estadísticas y control de página. Permite precisar la consulta mediante tipoGasto, cuenta bancaria, fecha inicial, fecha final, periodo, reconciliadoPor, página, límite por página.
  ///
  /// Parameters:
  ///
  /// * [String] tipoGasto:
  ///   Valor de tipoGasto aceptado por el handler.
  ///
  /// * [String] cuentaId:
  ///   Identificador de la cuenta bancaria.
  ///
  /// * [DateTime] fechaDesde:
  ///   Valor de fechaDesde aceptado por el handler.
  ///
  /// * [DateTime] fechaHasta:
  ///   Valor de fechaHasta aceptado por el handler.
  ///
  /// * [String] periodo:
  ///   Valor de periodo aceptado por el handler.
  ///
  /// * [String] reconciliadoPor:
  ///   Valor de reconciliadoPor aceptado por el handler.
  ///
  /// * [int] page:
  ///   Página solicitada, comenzando en 1.
  ///
  /// * [int] limit:
  ///   Cantidad máxima de elementos por página.
  Future<GetAccountingReconciliationExpensesHistoryResponse?> mobileGetAccountingReconciliationExpensesNestedHistory({ String? tipoGasto, String? cuentaId, DateTime? fechaDesde, DateTime? fechaHasta, String? periodo, String? reconciliadoPor, int? page, int? limit, }) async {
    final response = await mobileGetAccountingReconciliationExpensesNestedHistoryWithHttpInfo( tipoGasto: tipoGasto, cuentaId: cuentaId, fechaDesde: fechaDesde, fechaHasta: fechaHasta, periodo: periodo, reconciliadoPor: reconciliadoPor, page: page, limit: limit, );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetAccountingReconciliationExpensesHistoryResponse',) as GetAccountingReconciliationExpensesHistoryResponse;
    
    }
    return null;
  }

  /// Consultar conciliación de ventas
  ///
  /// Lista ventas que todavía no tienen conciliación bancaria. Permite precisar la consulta mediante fecha inicial, fecha final, punto de venta, página, límite por página.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [DateTime] fechaInicio:
  ///   Inicio inclusivo del período consultado.
  ///
  /// * [DateTime] fechaFin:
  ///   Fin inclusivo del período consultado.
  ///
  /// * [String] puntoDeVentaId:
  ///   Valor de puntoDeVentaId aceptado por el handler.
  ///
  /// * [int] page:
  ///   Página solicitada, comenzando en 1.
  ///
  /// * [int] limit:
  ///   Cantidad máxima de elementos por página.
  Future<Response> mobileGetAccountingReconciliationSalesWithHttpInfo({ DateTime? fechaInicio, DateTime? fechaFin, String? puntoDeVentaId, int? page, int? limit, }) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/reconciliation/sales';

    // ignore: prefer_final_locals
    Object? postBody;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    if (fechaInicio != null) {
      queryParams.addAll(_queryParams('', 'fechaInicio', fechaInicio));
    }
    if (fechaFin != null) {
      queryParams.addAll(_queryParams('', 'fechaFin', fechaFin));
    }
    if (puntoDeVentaId != null) {
      queryParams.addAll(_queryParams('', 'puntoDeVentaId', puntoDeVentaId));
    }
    if (page != null) {
      queryParams.addAll(_queryParams('', 'page', page));
    }
    if (limit != null) {
      queryParams.addAll(_queryParams('', 'limit', limit));
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

  /// Consultar conciliación de ventas
  ///
  /// Lista ventas que todavía no tienen conciliación bancaria. Permite precisar la consulta mediante fecha inicial, fecha final, punto de venta, página, límite por página.
  ///
  /// Parameters:
  ///
  /// * [DateTime] fechaInicio:
  ///   Inicio inclusivo del período consultado.
  ///
  /// * [DateTime] fechaFin:
  ///   Fin inclusivo del período consultado.
  ///
  /// * [String] puntoDeVentaId:
  ///   Valor de puntoDeVentaId aceptado por el handler.
  ///
  /// * [int] page:
  ///   Página solicitada, comenzando en 1.
  ///
  /// * [int] limit:
  ///   Cantidad máxima de elementos por página.
  Future<GetAccountingReconciliationSalesResponse?> mobileGetAccountingReconciliationSales({ DateTime? fechaInicio, DateTime? fechaFin, String? puntoDeVentaId, int? page, int? limit, }) async {
    final response = await mobileGetAccountingReconciliationSalesWithHttpInfo( fechaInicio: fechaInicio, fechaFin: fechaFin, puntoDeVentaId: puntoDeVentaId, page: page, limit: limit, );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetAccountingReconciliationSalesResponse',) as GetAccountingReconciliationSalesResponse;
    
    }
    return null;
  }

  /// Consultar historial de conciliaciones de ventas
  ///
  /// Devuelve el historial completo de conciliaciones de ventas. Permite precisar la consulta mediante fecha inicial, fecha inicial, fecha final, fecha final, cuenta bancaria.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [DateTime] fechaDesde:
  ///   Valor de fechaDesde aceptado por el handler.
  ///
  /// * [DateTime] fechaInicio:
  ///   Inicio inclusivo del período consultado.
  ///
  /// * [DateTime] fechaHasta:
  ///   Valor de fechaHasta aceptado por el handler.
  ///
  /// * [DateTime] fechaFin:
  ///   Fin inclusivo del período consultado.
  ///
  /// * [String] cuentaId:
  ///   Identificador de la cuenta bancaria.
  Future<Response> mobileGetAccountingReconciliationSalesHistoryWithHttpInfo({ DateTime? fechaDesde, DateTime? fechaInicio, DateTime? fechaHasta, DateTime? fechaFin, String? cuentaId, }) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/reconciliation/sales-history';

    // ignore: prefer_final_locals
    Object? postBody;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    if (fechaDesde != null) {
      queryParams.addAll(_queryParams('', 'fechaDesde', fechaDesde));
    }
    if (fechaInicio != null) {
      queryParams.addAll(_queryParams('', 'fechaInicio', fechaInicio));
    }
    if (fechaHasta != null) {
      queryParams.addAll(_queryParams('', 'fechaHasta', fechaHasta));
    }
    if (fechaFin != null) {
      queryParams.addAll(_queryParams('', 'fechaFin', fechaFin));
    }
    if (cuentaId != null) {
      queryParams.addAll(_queryParams('', 'cuentaId', cuentaId));
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

  /// Consultar historial de conciliaciones de ventas
  ///
  /// Devuelve el historial completo de conciliaciones de ventas. Permite precisar la consulta mediante fecha inicial, fecha inicial, fecha final, fecha final, cuenta bancaria.
  ///
  /// Parameters:
  ///
  /// * [DateTime] fechaDesde:
  ///   Valor de fechaDesde aceptado por el handler.
  ///
  /// * [DateTime] fechaInicio:
  ///   Inicio inclusivo del período consultado.
  ///
  /// * [DateTime] fechaHasta:
  ///   Valor de fechaHasta aceptado por el handler.
  ///
  /// * [DateTime] fechaFin:
  ///   Fin inclusivo del período consultado.
  ///
  /// * [String] cuentaId:
  ///   Identificador de la cuenta bancaria.
  Future<GetAccountingReconciliationSalesHistoryResponse?> mobileGetAccountingReconciliationSalesHistory({ DateTime? fechaDesde, DateTime? fechaInicio, DateTime? fechaHasta, DateTime? fechaFin, String? cuentaId, }) async {
    final response = await mobileGetAccountingReconciliationSalesHistoryWithHttpInfo( fechaDesde: fechaDesde, fechaInicio: fechaInicio, fechaHasta: fechaHasta, fechaFin: fechaFin, cuentaId: cuentaId, );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetAccountingReconciliationSalesHistoryResponse',) as GetAccountingReconciliationSalesHistoryResponse;
    
    }
    return null;
  }

  /// Consultar historial paginado de conciliaciones de ventas
  ///
  /// Devuelve conciliaciones de ventas con estadísticas y control de página. Permite precisar la consulta mediante fecha inicial, fecha final, cuenta bancaria.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [DateTime] fechaInicio:
  ///   Inicio inclusivo del período consultado.
  ///
  /// * [DateTime] fechaFin:
  ///   Fin inclusivo del período consultado.
  ///
  /// * [String] cuentaId:
  ///   Identificador de la cuenta bancaria.
  Future<Response> mobileGetAccountingReconciliationSalesNestedHistoryWithHttpInfo({ DateTime? fechaInicio, DateTime? fechaFin, String? cuentaId, }) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/reconciliation/sales/history';

    // ignore: prefer_final_locals
    Object? postBody;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    if (fechaInicio != null) {
      queryParams.addAll(_queryParams('', 'fechaInicio', fechaInicio));
    }
    if (fechaFin != null) {
      queryParams.addAll(_queryParams('', 'fechaFin', fechaFin));
    }
    if (cuentaId != null) {
      queryParams.addAll(_queryParams('', 'cuentaId', cuentaId));
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

  /// Consultar historial paginado de conciliaciones de ventas
  ///
  /// Devuelve conciliaciones de ventas con estadísticas y control de página. Permite precisar la consulta mediante fecha inicial, fecha final, cuenta bancaria.
  ///
  /// Parameters:
  ///
  /// * [DateTime] fechaInicio:
  ///   Inicio inclusivo del período consultado.
  ///
  /// * [DateTime] fechaFin:
  ///   Fin inclusivo del período consultado.
  ///
  /// * [String] cuentaId:
  ///   Identificador de la cuenta bancaria.
  Future<GetAccountingReconciliationSalesHistoryResponse?> mobileGetAccountingReconciliationSalesNestedHistory({ DateTime? fechaInicio, DateTime? fechaFin, String? cuentaId, }) async {
    final response = await mobileGetAccountingReconciliationSalesNestedHistoryWithHttpInfo( fechaInicio: fechaInicio, fechaFin: fechaFin, cuentaId: cuentaId, );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetAccountingReconciliationSalesHistoryResponse',) as GetAccountingReconciliationSalesHistoryResponse;
    
    }
    return null;
  }

  /// Consultar conciliación de servicios
  ///
  /// Lista servicios vendidos pendientes de distribuir entre cuentas bancarias. Permite precisar la consulta mediante fecha inicial, fecha final, página, límite por página.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [DateTime] fechaDesde:
  ///   Valor de fechaDesde aceptado por el handler.
  ///
  /// * [DateTime] fechaHasta:
  ///   Valor de fechaHasta aceptado por el handler.
  ///
  /// * [int] page:
  ///   Página solicitada, comenzando en 1.
  ///
  /// * [int] limit:
  ///   Cantidad máxima de elementos por página.
  Future<Response> mobileGetAccountingReconciliationServicesWithHttpInfo({ DateTime? fechaDesde, DateTime? fechaHasta, int? page, int? limit, }) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/reconciliation/services';

    // ignore: prefer_final_locals
    Object? postBody;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    if (fechaDesde != null) {
      queryParams.addAll(_queryParams('', 'fechaDesde', fechaDesde));
    }
    if (fechaHasta != null) {
      queryParams.addAll(_queryParams('', 'fechaHasta', fechaHasta));
    }
    if (page != null) {
      queryParams.addAll(_queryParams('', 'page', page));
    }
    if (limit != null) {
      queryParams.addAll(_queryParams('', 'limit', limit));
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

  /// Consultar conciliación de servicios
  ///
  /// Lista servicios vendidos pendientes de distribuir entre cuentas bancarias. Permite precisar la consulta mediante fecha inicial, fecha final, página, límite por página.
  ///
  /// Parameters:
  ///
  /// * [DateTime] fechaDesde:
  ///   Valor de fechaDesde aceptado por el handler.
  ///
  /// * [DateTime] fechaHasta:
  ///   Valor de fechaHasta aceptado por el handler.
  ///
  /// * [int] page:
  ///   Página solicitada, comenzando en 1.
  ///
  /// * [int] limit:
  ///   Cantidad máxima de elementos por página.
  Future<GetAccountingReconciliationServicesResponse?> mobileGetAccountingReconciliationServices({ DateTime? fechaDesde, DateTime? fechaHasta, int? page, int? limit, }) async {
    final response = await mobileGetAccountingReconciliationServicesWithHttpInfo( fechaDesde: fechaDesde, fechaHasta: fechaHasta, page: page, limit: limit, );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetAccountingReconciliationServicesResponse',) as GetAccountingReconciliationServicesResponse;
    
    }
    return null;
  }

  /// Consultar historial de conciliaciones de servicios
  ///
  /// Devuelve el historial completo de conciliaciones de servicios. Permite precisar la consulta mediante fecha inicial, fecha final, cuenta bancaria.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [DateTime] fechaDesde:
  ///   Valor de fechaDesde aceptado por el handler.
  ///
  /// * [DateTime] fechaHasta:
  ///   Valor de fechaHasta aceptado por el handler.
  ///
  /// * [String] cuentaId:
  ///   Identificador de la cuenta bancaria.
  Future<Response> mobileGetAccountingReconciliationServicesHistoryWithHttpInfo({ DateTime? fechaDesde, DateTime? fechaHasta, String? cuentaId, }) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/reconciliation/services-history';

    // ignore: prefer_final_locals
    Object? postBody;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    if (fechaDesde != null) {
      queryParams.addAll(_queryParams('', 'fechaDesde', fechaDesde));
    }
    if (fechaHasta != null) {
      queryParams.addAll(_queryParams('', 'fechaHasta', fechaHasta));
    }
    if (cuentaId != null) {
      queryParams.addAll(_queryParams('', 'cuentaId', cuentaId));
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

  /// Consultar historial de conciliaciones de servicios
  ///
  /// Devuelve el historial completo de conciliaciones de servicios. Permite precisar la consulta mediante fecha inicial, fecha final, cuenta bancaria.
  ///
  /// Parameters:
  ///
  /// * [DateTime] fechaDesde:
  ///   Valor de fechaDesde aceptado por el handler.
  ///
  /// * [DateTime] fechaHasta:
  ///   Valor de fechaHasta aceptado por el handler.
  ///
  /// * [String] cuentaId:
  ///   Identificador de la cuenta bancaria.
  Future<GetAccountingReconciliationServicesHistoryResponse?> mobileGetAccountingReconciliationServicesHistory({ DateTime? fechaDesde, DateTime? fechaHasta, String? cuentaId, }) async {
    final response = await mobileGetAccountingReconciliationServicesHistoryWithHttpInfo( fechaDesde: fechaDesde, fechaHasta: fechaHasta, cuentaId: cuentaId, );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetAccountingReconciliationServicesHistoryResponse',) as GetAccountingReconciliationServicesHistoryResponse;
    
    }
    return null;
  }

  /// Consultar historial paginado de conciliaciones de servicios
  ///
  /// Devuelve conciliaciones de servicios con estadísticas y control de página. Permite precisar la consulta mediante fecha inicial, fecha final, cuenta bancaria.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [DateTime] fechaDesde:
  ///   Valor de fechaDesde aceptado por el handler.
  ///
  /// * [DateTime] fechaHasta:
  ///   Valor de fechaHasta aceptado por el handler.
  ///
  /// * [String] cuentaId:
  ///   Identificador de la cuenta bancaria.
  Future<Response> mobileGetAccountingReconciliationServicesNestedHistoryWithHttpInfo({ DateTime? fechaDesde, DateTime? fechaHasta, String? cuentaId, }) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/reconciliation/services/history';

    // ignore: prefer_final_locals
    Object? postBody;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    if (fechaDesde != null) {
      queryParams.addAll(_queryParams('', 'fechaDesde', fechaDesde));
    }
    if (fechaHasta != null) {
      queryParams.addAll(_queryParams('', 'fechaHasta', fechaHasta));
    }
    if (cuentaId != null) {
      queryParams.addAll(_queryParams('', 'cuentaId', cuentaId));
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

  /// Consultar historial paginado de conciliaciones de servicios
  ///
  /// Devuelve conciliaciones de servicios con estadísticas y control de página. Permite precisar la consulta mediante fecha inicial, fecha final, cuenta bancaria.
  ///
  /// Parameters:
  ///
  /// * [DateTime] fechaDesde:
  ///   Valor de fechaDesde aceptado por el handler.
  ///
  /// * [DateTime] fechaHasta:
  ///   Valor de fechaHasta aceptado por el handler.
  ///
  /// * [String] cuentaId:
  ///   Identificador de la cuenta bancaria.
  Future<GetAccountingReconciliationServicesHistoryResponse?> mobileGetAccountingReconciliationServicesNestedHistory({ DateTime? fechaDesde, DateTime? fechaHasta, String? cuentaId, }) async {
    final response = await mobileGetAccountingReconciliationServicesNestedHistoryWithHttpInfo( fechaDesde: fechaDesde, fechaHasta: fechaHasta, cuentaId: cuentaId, );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetAccountingReconciliationServicesHistoryResponse',) as GetAccountingReconciliationServicesHistoryResponse;
    
    }
    return null;
  }

  /// Consultar panel de conciliaciones
  ///
  /// Resume pendientes, conciliaciones completadas hoy, eficiencia y actividad reciente por módulo.
  ///
  /// Note: This method returns the HTTP [Response].
  Future<Response> mobileGetAccountingReconciliationStatsWithHttpInfo() async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/reconciliation/stats';

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

  /// Consultar panel de conciliaciones
  ///
  /// Resume pendientes, conciliaciones completadas hoy, eficiencia y actividad reciente por módulo.
  Future<GetAccountingReconciliationStatsResponse?> mobileGetAccountingReconciliationStats() async {
    final response = await mobileGetAccountingReconciliationStatsWithHttpInfo();
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetAccountingReconciliationStatsResponse',) as GetAccountingReconciliationStatsResponse;
    
    }
    return null;
  }

  /// Registrar conciliación de gastos
  ///
  /// Distribuye el importe de un gasto entre una o varias cuentas y registra su pago contable.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [ExpenseReconciliationRequest] expenseReconciliationRequest (required):
  ///
  /// * [String] tipoGasto:
  ///   Valor de tipoGasto aceptado por el handler.
  ///
  /// * [DateTime] fechaDesde:
  ///   Valor de fechaDesde aceptado por el handler.
  ///
  /// * [DateTime] fechaHasta:
  ///   Valor de fechaHasta aceptado por el handler.
  ///
  /// * [int] page:
  ///   Página solicitada, comenzando en 1.
  ///
  /// * [int] limit:
  ///   Cantidad máxima de elementos por página.
  Future<Response> mobilePostAccountingReconciliationExpensesWithHttpInfo(ExpenseReconciliationRequest expenseReconciliationRequest, { String? tipoGasto, DateTime? fechaDesde, DateTime? fechaHasta, int? page, int? limit, }) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/reconciliation/expenses';

    // ignore: prefer_final_locals
    Object? postBody = expenseReconciliationRequest;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    if (tipoGasto != null) {
      queryParams.addAll(_queryParams('', 'tipoGasto', tipoGasto));
    }
    if (fechaDesde != null) {
      queryParams.addAll(_queryParams('', 'fechaDesde', fechaDesde));
    }
    if (fechaHasta != null) {
      queryParams.addAll(_queryParams('', 'fechaHasta', fechaHasta));
    }
    if (page != null) {
      queryParams.addAll(_queryParams('', 'page', page));
    }
    if (limit != null) {
      queryParams.addAll(_queryParams('', 'limit', limit));
    }

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

  /// Registrar conciliación de gastos
  ///
  /// Distribuye el importe de un gasto entre una o varias cuentas y registra su pago contable.
  ///
  /// Parameters:
  ///
  /// * [ExpenseReconciliationRequest] expenseReconciliationRequest (required):
  ///
  /// * [String] tipoGasto:
  ///   Valor de tipoGasto aceptado por el handler.
  ///
  /// * [DateTime] fechaDesde:
  ///   Valor de fechaDesde aceptado por el handler.
  ///
  /// * [DateTime] fechaHasta:
  ///   Valor de fechaHasta aceptado por el handler.
  ///
  /// * [int] page:
  ///   Página solicitada, comenzando en 1.
  ///
  /// * [int] limit:
  ///   Cantidad máxima de elementos por página.
  Future<PostAccountingReconciliationExpensesResponse?> mobilePostAccountingReconciliationExpenses(ExpenseReconciliationRequest expenseReconciliationRequest, { String? tipoGasto, DateTime? fechaDesde, DateTime? fechaHasta, int? page, int? limit, }) async {
    final response = await mobilePostAccountingReconciliationExpensesWithHttpInfo(expenseReconciliationRequest,  tipoGasto: tipoGasto, fechaDesde: fechaDesde, fechaHasta: fechaHasta, page: page, limit: limit, );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'PostAccountingReconciliationExpensesResponse',) as PostAccountingReconciliationExpensesResponse;
    
    }
    return null;
  }

  /// Registrar conciliación de ventas
  ///
  /// Abona una venta en la cuenta y medio de pago indicados, respetando el importe conciliable.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [SaleReconciliationRequest] saleReconciliationRequest (required):
  ///
  /// * [DateTime] fechaInicio:
  ///   Inicio inclusivo del período consultado.
  ///
  /// * [DateTime] fechaFin:
  ///   Fin inclusivo del período consultado.
  ///
  /// * [String] puntoDeVentaId:
  ///   Valor de puntoDeVentaId aceptado por el handler.
  ///
  /// * [int] page:
  ///   Página solicitada, comenzando en 1.
  ///
  /// * [int] limit:
  ///   Cantidad máxima de elementos por página.
  Future<Response> mobilePostAccountingReconciliationSalesWithHttpInfo(SaleReconciliationRequest saleReconciliationRequest, { DateTime? fechaInicio, DateTime? fechaFin, String? puntoDeVentaId, int? page, int? limit, }) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/reconciliation/sales';

    // ignore: prefer_final_locals
    Object? postBody = saleReconciliationRequest;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    if (fechaInicio != null) {
      queryParams.addAll(_queryParams('', 'fechaInicio', fechaInicio));
    }
    if (fechaFin != null) {
      queryParams.addAll(_queryParams('', 'fechaFin', fechaFin));
    }
    if (puntoDeVentaId != null) {
      queryParams.addAll(_queryParams('', 'puntoDeVentaId', puntoDeVentaId));
    }
    if (page != null) {
      queryParams.addAll(_queryParams('', 'page', page));
    }
    if (limit != null) {
      queryParams.addAll(_queryParams('', 'limit', limit));
    }

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

  /// Registrar conciliación de ventas
  ///
  /// Abona una venta en la cuenta y medio de pago indicados, respetando el importe conciliable.
  ///
  /// Parameters:
  ///
  /// * [SaleReconciliationRequest] saleReconciliationRequest (required):
  ///
  /// * [DateTime] fechaInicio:
  ///   Inicio inclusivo del período consultado.
  ///
  /// * [DateTime] fechaFin:
  ///   Fin inclusivo del período consultado.
  ///
  /// * [String] puntoDeVentaId:
  ///   Valor de puntoDeVentaId aceptado por el handler.
  ///
  /// * [int] page:
  ///   Página solicitada, comenzando en 1.
  ///
  /// * [int] limit:
  ///   Cantidad máxima de elementos por página.
  Future<PostAccountingReconciliationSalesResponse?> mobilePostAccountingReconciliationSales(SaleReconciliationRequest saleReconciliationRequest, { DateTime? fechaInicio, DateTime? fechaFin, String? puntoDeVentaId, int? page, int? limit, }) async {
    final response = await mobilePostAccountingReconciliationSalesWithHttpInfo(saleReconciliationRequest,  fechaInicio: fechaInicio, fechaFin: fechaFin, puntoDeVentaId: puntoDeVentaId, page: page, limit: limit, );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'PostAccountingReconciliationSalesResponse',) as PostAccountingReconciliationSalesResponse;
    
    }
    return null;
  }

  /// Registrar conciliación de servicios
  ///
  /// Distribuye el total de un servicio entre las cuentas y medios de pago enviados.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [ServiceReconciliationRequest] serviceReconciliationRequest (required):
  ///
  /// * [DateTime] fechaDesde:
  ///   Valor de fechaDesde aceptado por el handler.
  ///
  /// * [DateTime] fechaHasta:
  ///   Valor de fechaHasta aceptado por el handler.
  ///
  /// * [int] page:
  ///   Página solicitada, comenzando en 1.
  ///
  /// * [int] limit:
  ///   Cantidad máxima de elementos por página.
  Future<Response> mobilePostAccountingReconciliationServicesWithHttpInfo(ServiceReconciliationRequest serviceReconciliationRequest, { DateTime? fechaDesde, DateTime? fechaHasta, int? page, int? limit, }) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/reconciliation/services';

    // ignore: prefer_final_locals
    Object? postBody = serviceReconciliationRequest;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    if (fechaDesde != null) {
      queryParams.addAll(_queryParams('', 'fechaDesde', fechaDesde));
    }
    if (fechaHasta != null) {
      queryParams.addAll(_queryParams('', 'fechaHasta', fechaHasta));
    }
    if (page != null) {
      queryParams.addAll(_queryParams('', 'page', page));
    }
    if (limit != null) {
      queryParams.addAll(_queryParams('', 'limit', limit));
    }

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

  /// Registrar conciliación de servicios
  ///
  /// Distribuye el total de un servicio entre las cuentas y medios de pago enviados.
  ///
  /// Parameters:
  ///
  /// * [ServiceReconciliationRequest] serviceReconciliationRequest (required):
  ///
  /// * [DateTime] fechaDesde:
  ///   Valor de fechaDesde aceptado por el handler.
  ///
  /// * [DateTime] fechaHasta:
  ///   Valor de fechaHasta aceptado por el handler.
  ///
  /// * [int] page:
  ///   Página solicitada, comenzando en 1.
  ///
  /// * [int] limit:
  ///   Cantidad máxima de elementos por página.
  Future<PostAccountingReconciliationServicesResponse?> mobilePostAccountingReconciliationServices(ServiceReconciliationRequest serviceReconciliationRequest, { DateTime? fechaDesde, DateTime? fechaHasta, int? page, int? limit, }) async {
    final response = await mobilePostAccountingReconciliationServicesWithHttpInfo(serviceReconciliationRequest,  fechaDesde: fechaDesde, fechaHasta: fechaHasta, page: page, limit: limit, );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'PostAccountingReconciliationServicesResponse',) as PostAccountingReconciliationServicesResponse;
    
    }
    return null;
  }
}
