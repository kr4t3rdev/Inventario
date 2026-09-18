//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;


class AccountingReportsApi {
  AccountingReportsApi([ApiClient? apiClient]) : apiClient = apiClient ?? defaultApiClient;

  final ApiClient apiClient;

  /// Consultar anticipos de clientes
  ///
  /// Agrupa los anticipos recibidos de clientes para el período consultado. Permite precisar la consulta mediante cliente, fecha inicial, fecha final.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] clienteId:
  ///   Identificador del cliente.
  ///
  /// * [DateTime] fechaInicio:
  ///   Inicio inclusivo del período consultado.
  ///
  /// * [DateTime] fechaFin:
  ///   Fin inclusivo del período consultado.
  Future<Response> mobileGetAccountingAdvancesReportsCustomersWithHttpInfo({ String? clienteId, DateTime? fechaInicio, DateTime? fechaFin, }) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/advances/reports/customers';

    // ignore: prefer_final_locals
    Object? postBody;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    if (clienteId != null) {
      queryParams.addAll(_queryParams('', 'clienteId', clienteId));
    }
    if (fechaInicio != null) {
      queryParams.addAll(_queryParams('', 'fechaInicio', fechaInicio));
    }
    if (fechaFin != null) {
      queryParams.addAll(_queryParams('', 'fechaFin', fechaFin));
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

  /// Consultar anticipos de clientes
  ///
  /// Agrupa los anticipos recibidos de clientes para el período consultado. Permite precisar la consulta mediante cliente, fecha inicial, fecha final.
  ///
  /// Parameters:
  ///
  /// * [String] clienteId:
  ///   Identificador del cliente.
  ///
  /// * [DateTime] fechaInicio:
  ///   Inicio inclusivo del período consultado.
  ///
  /// * [DateTime] fechaFin:
  ///   Fin inclusivo del período consultado.
  Future<GetAccountingAdvancesReportsCustomersResponse?> mobileGetAccountingAdvancesReportsCustomers({ String? clienteId, DateTime? fechaInicio, DateTime? fechaFin, }) async {
    final response = await mobileGetAccountingAdvancesReportsCustomersWithHttpInfo( clienteId: clienteId, fechaInicio: fechaInicio, fechaFin: fechaFin, );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetAccountingAdvancesReportsCustomersResponse',) as GetAccountingAdvancesReportsCustomersResponse;
    
    }
    return null;
  }

  /// Consultar anticipos a proveedores
  ///
  /// Agrupa los anticipos entregados a proveedores para el período consultado. Permite precisar la consulta mediante proveedor, fecha inicial, fecha final.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] proveedorId:
  ///   Identificador del proveedor.
  ///
  /// * [DateTime] fechaInicio:
  ///   Inicio inclusivo del período consultado.
  ///
  /// * [DateTime] fechaFin:
  ///   Fin inclusivo del período consultado.
  Future<Response> mobileGetAccountingAdvancesReportsProvidersWithHttpInfo({ String? proveedorId, DateTime? fechaInicio, DateTime? fechaFin, }) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/advances/reports/providers';

    // ignore: prefer_final_locals
    Object? postBody;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    if (proveedorId != null) {
      queryParams.addAll(_queryParams('', 'proveedorId', proveedorId));
    }
    if (fechaInicio != null) {
      queryParams.addAll(_queryParams('', 'fechaInicio', fechaInicio));
    }
    if (fechaFin != null) {
      queryParams.addAll(_queryParams('', 'fechaFin', fechaFin));
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

  /// Consultar anticipos a proveedores
  ///
  /// Agrupa los anticipos entregados a proveedores para el período consultado. Permite precisar la consulta mediante proveedor, fecha inicial, fecha final.
  ///
  /// Parameters:
  ///
  /// * [String] proveedorId:
  ///   Identificador del proveedor.
  ///
  /// * [DateTime] fechaInicio:
  ///   Inicio inclusivo del período consultado.
  ///
  /// * [DateTime] fechaFin:
  ///   Fin inclusivo del período consultado.
  Future<GetAccountingAdvancesReportsProvidersResponse?> mobileGetAccountingAdvancesReportsProviders({ String? proveedorId, DateTime? fechaInicio, DateTime? fechaFin, }) async {
    final response = await mobileGetAccountingAdvancesReportsProvidersWithHttpInfo( proveedorId: proveedorId, fechaInicio: fechaInicio, fechaFin: fechaFin, );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetAccountingAdvancesReportsProvidersResponse',) as GetAccountingAdvancesReportsProvidersResponse;
    
    }
    return null;
  }

  /// Consultar resumen de anticipos
  ///
  /// Resume importes y estados de anticipos de pago y cobro. Permite precisar la consulta mediante tipo, fecha inicial, fecha final.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] tipo:
  ///   Tipo de registro solicitado.
  ///
  /// * [DateTime] fechaInicio:
  ///   Inicio inclusivo del período consultado.
  ///
  /// * [DateTime] fechaFin:
  ///   Fin inclusivo del período consultado.
  Future<Response> mobileGetAccountingAdvancesReportsSummaryWithHttpInfo({ String? tipo, DateTime? fechaInicio, DateTime? fechaFin, }) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/advances/reports/summary';

    // ignore: prefer_final_locals
    Object? postBody;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    if (tipo != null) {
      queryParams.addAll(_queryParams('', 'tipo', tipo));
    }
    if (fechaInicio != null) {
      queryParams.addAll(_queryParams('', 'fechaInicio', fechaInicio));
    }
    if (fechaFin != null) {
      queryParams.addAll(_queryParams('', 'fechaFin', fechaFin));
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

  /// Consultar resumen de anticipos
  ///
  /// Resume importes y estados de anticipos de pago y cobro. Permite precisar la consulta mediante tipo, fecha inicial, fecha final.
  ///
  /// Parameters:
  ///
  /// * [String] tipo:
  ///   Tipo de registro solicitado.
  ///
  /// * [DateTime] fechaInicio:
  ///   Inicio inclusivo del período consultado.
  ///
  /// * [DateTime] fechaFin:
  ///   Fin inclusivo del período consultado.
  Future<GetAccountingAdvancesReportsSummaryResponse?> mobileGetAccountingAdvancesReportsSummary({ String? tipo, DateTime? fechaInicio, DateTime? fechaFin, }) async {
    final response = await mobileGetAccountingAdvancesReportsSummaryWithHttpInfo( tipo: tipo, fechaInicio: fechaInicio, fechaFin: fechaFin, );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetAccountingAdvancesReportsSummaryResponse',) as GetAccountingAdvancesReportsSummaryResponse;
    
    }
    return null;
  }

  /// Consultar análisis de cuenta de cliente
  ///
  /// Analiza deuda, pagos, vencimientos y actividad de una cuenta de cliente. Permite precisar la consulta mediante cliente.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] clienteId:
  ///   Identificador del cliente.
  Future<Response> mobileGetAccountingReportsClientAccountAnalysisWithHttpInfo({ String? clienteId, }) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/reports/client-account-analysis';

    // ignore: prefer_final_locals
    Object? postBody;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    if (clienteId != null) {
      queryParams.addAll(_queryParams('', 'clienteId', clienteId));
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

  /// Consultar análisis de cuenta de cliente
  ///
  /// Analiza deuda, pagos, vencimientos y actividad de una cuenta de cliente. Permite precisar la consulta mediante cliente.
  ///
  /// Parameters:
  ///
  /// * [String] clienteId:
  ///   Identificador del cliente.
  Future<GetAccountingReportsClientAccountAnalysisResponse?> mobileGetAccountingReportsClientAccountAnalysis({ String? clienteId, }) async {
    final response = await mobileGetAccountingReportsClientAccountAnalysisWithHttpInfo( clienteId: clienteId, );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetAccountingReportsClientAccountAnalysisResponse',) as GetAccountingReportsClientAccountAnalysisResponse;
    
    }
    return null;
  }

  /// Consultar reporte de cambio de moneda
  ///
  /// Reúne tasas y conversiones monetarias para evaluar operaciones de cambio. Permite precisar la consulta mediante fecha inicial, fecha final, monedaOrigen, monedaDestino, formato de exportación.
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
  /// * [String] monedaOrigen:
  ///   Valor de monedaOrigen aceptado por el handler.
  ///
  /// * [String] monedaDestino:
  ///   Valor de monedaDestino aceptado por el handler.
  ///
  /// * [String] export_:
  ///   Valor de export aceptado por el handler.
  Future<Response> mobileGetAccountingReportsExchangeWithHttpInfo({ DateTime? fechaInicio, DateTime? fechaFin, String? monedaOrigen, String? monedaDestino, String? export_, }) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/reports/exchange';

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
    if (monedaOrigen != null) {
      queryParams.addAll(_queryParams('', 'monedaOrigen', monedaOrigen));
    }
    if (monedaDestino != null) {
      queryParams.addAll(_queryParams('', 'monedaDestino', monedaDestino));
    }
    if (export_ != null) {
      queryParams.addAll(_queryParams('', 'export', export_));
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

  /// Consultar reporte de cambio de moneda
  ///
  /// Reúne tasas y conversiones monetarias para evaluar operaciones de cambio. Permite precisar la consulta mediante fecha inicial, fecha final, monedaOrigen, monedaDestino, formato de exportación.
  ///
  /// Parameters:
  ///
  /// * [DateTime] fechaInicio:
  ///   Inicio inclusivo del período consultado.
  ///
  /// * [DateTime] fechaFin:
  ///   Fin inclusivo del período consultado.
  ///
  /// * [String] monedaOrigen:
  ///   Valor de monedaOrigen aceptado por el handler.
  ///
  /// * [String] monedaDestino:
  ///   Valor de monedaDestino aceptado por el handler.
  ///
  /// * [String] export_:
  ///   Valor de export aceptado por el handler.
  Future<GetAccountingReportsExchangeResponse?> mobileGetAccountingReportsExchange({ DateTime? fechaInicio, DateTime? fechaFin, String? monedaOrigen, String? monedaDestino, String? export_, }) async {
    final response = await mobileGetAccountingReportsExchangeWithHttpInfo( fechaInicio: fechaInicio, fechaFin: fechaFin, monedaOrigen: monedaOrigen, monedaDestino: monedaDestino, export_: export_, );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetAccountingReportsExchangeResponse',) as GetAccountingReportsExchangeResponse;
    
    }
    return null;
  }

  /// Consultar impacto de variaciones cambiarias
  ///
  /// Calcula el efecto de las tasas aplicadas sobre movimientos y saldos convertidos. Permite precisar la consulta mediante fecha inicial, fecha final, monedaBase, tipoAnalisis.
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
  /// * [String] monedaBase:
  ///   Valor de monedaBase aceptado por el handler.
  ///
  /// * [String] tipoAnalisis:
  ///   Valor de tipoAnalisis aceptado por el handler.
  Future<Response> mobileGetAccountingReportsExchangeImpactWithHttpInfo({ DateTime? fechaInicio, DateTime? fechaFin, String? monedaBase, String? tipoAnalisis, }) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/reports/exchange-impact';

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
    if (monedaBase != null) {
      queryParams.addAll(_queryParams('', 'monedaBase', monedaBase));
    }
    if (tipoAnalisis != null) {
      queryParams.addAll(_queryParams('', 'tipoAnalisis', tipoAnalisis));
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

  /// Consultar impacto de variaciones cambiarias
  ///
  /// Calcula el efecto de las tasas aplicadas sobre movimientos y saldos convertidos. Permite precisar la consulta mediante fecha inicial, fecha final, monedaBase, tipoAnalisis.
  ///
  /// Parameters:
  ///
  /// * [DateTime] fechaInicio:
  ///   Inicio inclusivo del período consultado.
  ///
  /// * [DateTime] fechaFin:
  ///   Fin inclusivo del período consultado.
  ///
  /// * [String] monedaBase:
  ///   Valor de monedaBase aceptado por el handler.
  ///
  /// * [String] tipoAnalisis:
  ///   Valor de tipoAnalisis aceptado por el handler.
  Future<GetAccountingReportsExchangeImpactResponse?> mobileGetAccountingReportsExchangeImpact({ DateTime? fechaInicio, DateTime? fechaFin, String? monedaBase, String? tipoAnalisis, }) async {
    final response = await mobileGetAccountingReportsExchangeImpactWithHttpInfo( fechaInicio: fechaInicio, fechaFin: fechaFin, monedaBase: monedaBase, tipoAnalisis: tipoAnalisis, );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetAccountingReportsExchangeImpactResponse',) as GetAccountingReportsExchangeImpactResponse;
    
    }
    return null;
  }

  /// Consultar movimientos contables
  ///
  /// Lista entradas y salidas contables y puede devolver su exportación CSV. Permite precisar la consulta mediante texto libre, fecha inicial, fecha final, cuenta bancaria, tipo de movimiento, moneda, página, límite por página, formato de exportación.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] busqueda:
  ///   Valor de busqueda aceptado por el handler.
  ///
  /// * [DateTime] fechaInicio:
  ///   Inicio inclusivo del período consultado.
  ///
  /// * [DateTime] fechaFin:
  ///   Fin inclusivo del período consultado.
  ///
  /// * [String] cuentaId:
  ///   Identificador de la cuenta bancaria.
  ///
  /// * [String] tipoMovimiento:
  ///   Valor de tipoMovimiento aceptado por el handler.
  ///
  /// * [String] moneda:
  ///   Código de moneda.
  ///
  /// * [int] page:
  ///   Página solicitada, comenzando en 1.
  ///
  /// * [int] limit:
  ///   Cantidad máxima de elementos por página.
  ///
  /// * [String] formato:
  ///   Valor de formato aceptado por el handler.
  Future<Response> mobileGetAccountingReportsMovementsWithHttpInfo({ String? busqueda, DateTime? fechaInicio, DateTime? fechaFin, String? cuentaId, String? tipoMovimiento, String? moneda, int? page, int? limit, String? formato, }) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/reports/movements';

    // ignore: prefer_final_locals
    Object? postBody;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    if (busqueda != null) {
      queryParams.addAll(_queryParams('', 'busqueda', busqueda));
    }
    if (fechaInicio != null) {
      queryParams.addAll(_queryParams('', 'fechaInicio', fechaInicio));
    }
    if (fechaFin != null) {
      queryParams.addAll(_queryParams('', 'fechaFin', fechaFin));
    }
    if (cuentaId != null) {
      queryParams.addAll(_queryParams('', 'cuentaId', cuentaId));
    }
    if (tipoMovimiento != null) {
      queryParams.addAll(_queryParams('', 'tipoMovimiento', tipoMovimiento));
    }
    if (moneda != null) {
      queryParams.addAll(_queryParams('', 'moneda', moneda));
    }
    if (page != null) {
      queryParams.addAll(_queryParams('', 'page', page));
    }
    if (limit != null) {
      queryParams.addAll(_queryParams('', 'limit', limit));
    }
    if (formato != null) {
      queryParams.addAll(_queryParams('', 'formato', formato));
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

  /// Consultar movimientos contables
  ///
  /// Lista entradas y salidas contables y puede devolver su exportación CSV. Permite precisar la consulta mediante texto libre, fecha inicial, fecha final, cuenta bancaria, tipo de movimiento, moneda, página, límite por página, formato de exportación.
  ///
  /// Parameters:
  ///
  /// * [String] busqueda:
  ///   Valor de busqueda aceptado por el handler.
  ///
  /// * [DateTime] fechaInicio:
  ///   Inicio inclusivo del período consultado.
  ///
  /// * [DateTime] fechaFin:
  ///   Fin inclusivo del período consultado.
  ///
  /// * [String] cuentaId:
  ///   Identificador de la cuenta bancaria.
  ///
  /// * [String] tipoMovimiento:
  ///   Valor de tipoMovimiento aceptado por el handler.
  ///
  /// * [String] moneda:
  ///   Código de moneda.
  ///
  /// * [int] page:
  ///   Página solicitada, comenzando en 1.
  ///
  /// * [int] limit:
  ///   Cantidad máxima de elementos por página.
  ///
  /// * [String] formato:
  ///   Valor de formato aceptado por el handler.
  Future<GetAccountingReportsMovementsResponse?> mobileGetAccountingReportsMovements({ String? busqueda, DateTime? fechaInicio, DateTime? fechaFin, String? cuentaId, String? tipoMovimiento, String? moneda, int? page, int? limit, String? formato, }) async {
    final response = await mobileGetAccountingReportsMovementsWithHttpInfo( busqueda: busqueda, fechaInicio: fechaInicio, fechaFin: fechaFin, cuentaId: cuentaId, tipoMovimiento: tipoMovimiento, moneda: moneda, page: page, limit: limit, formato: formato, );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetAccountingReportsMovementsResponse',) as GetAccountingReportsMovementsResponse;
    
    }
    return null;
  }

  /// Consultar facturas vencidas
  ///
  /// Identifica facturas cuyo vencimiento pasó y que aún conservan saldo pendiente.
  ///
  /// Note: This method returns the HTTP [Response].
  Future<Response> mobileGetAccountingReportsOverdueInvoicesWithHttpInfo() async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/reports/overdue-invoices';

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

  /// Consultar facturas vencidas
  ///
  /// Identifica facturas cuyo vencimiento pasó y que aún conservan saldo pendiente.
  Future<GetAccountingReportsOverdueInvoicesResponse?> mobileGetAccountingReportsOverdueInvoices() async {
    final response = await mobileGetAccountingReportsOverdueInvoicesWithHttpInfo();
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetAccountingReportsOverdueInvoicesResponse',) as GetAccountingReportsOverdueInvoicesResponse;
    
    }
    return null;
  }

  /// Consultar resumen financiero
  ///
  /// Consolida saldos, ingresos, egresos y actividad contable del período. Permite precisar la consulta mediante fecha inicial, fecha final, cuenta bancaria, moneda, formato de exportación.
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
  ///
  /// * [String] moneda:
  ///   Código de moneda.
  ///
  /// * [String] export_:
  ///   Valor de export aceptado por el handler.
  Future<Response> mobileGetAccountingReportsSummaryWithHttpInfo({ DateTime? fechaInicio, DateTime? fechaFin, String? cuentaId, String? moneda, String? export_, }) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/reports/summary';

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
    if (moneda != null) {
      queryParams.addAll(_queryParams('', 'moneda', moneda));
    }
    if (export_ != null) {
      queryParams.addAll(_queryParams('', 'export', export_));
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

  /// Consultar resumen financiero
  ///
  /// Consolida saldos, ingresos, egresos y actividad contable del período. Permite precisar la consulta mediante fecha inicial, fecha final, cuenta bancaria, moneda, formato de exportación.
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
  ///
  /// * [String] moneda:
  ///   Código de moneda.
  ///
  /// * [String] export_:
  ///   Valor de export aceptado por el handler.
  Future<GetAccountingReportsSummaryResponse?> mobileGetAccountingReportsSummary({ DateTime? fechaInicio, DateTime? fechaFin, String? cuentaId, String? moneda, String? export_, }) async {
    final response = await mobileGetAccountingReportsSummaryWithHttpInfo( fechaInicio: fechaInicio, fechaFin: fechaFin, cuentaId: cuentaId, moneda: moneda, export_: export_, );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetAccountingReportsSummaryResponse',) as GetAccountingReportsSummaryResponse;
    
    }
    return null;
  }

  /// Consultar reporte de transferencias
  ///
  /// Analiza transferencias por cuentas, monedas y responsable, con exportación opcional. Permite precisar la consulta mediante fecha inicial, fecha final, cuenta de origen, cuenta de destino, moneda, página, límite por página, usuario responsable, formato de exportación.
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
  /// * [String] cuentaOrigenId:
  ///   Valor de cuentaOrigenId aceptado por el handler.
  ///
  /// * [String] cuentaDestinoId:
  ///   Valor de cuentaDestinoId aceptado por el handler.
  ///
  /// * [String] moneda:
  ///   Código de moneda.
  ///
  /// * [int] page:
  ///   Página solicitada, comenzando en 1.
  ///
  /// * [int] limit:
  ///   Cantidad máxima de elementos por página.
  ///
  /// * [String] realizadoPor:
  ///   Valor de realizadoPor aceptado por el handler.
  ///
  /// * [String] export_:
  ///   Valor de export aceptado por el handler.
  Future<Response> mobileGetAccountingReportsTransfersWithHttpInfo({ DateTime? fechaInicio, DateTime? fechaFin, String? cuentaOrigenId, String? cuentaDestinoId, String? moneda, int? page, int? limit, String? realizadoPor, String? export_, }) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/reports/transfers';

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
    if (cuentaOrigenId != null) {
      queryParams.addAll(_queryParams('', 'cuentaOrigenId', cuentaOrigenId));
    }
    if (cuentaDestinoId != null) {
      queryParams.addAll(_queryParams('', 'cuentaDestinoId', cuentaDestinoId));
    }
    if (moneda != null) {
      queryParams.addAll(_queryParams('', 'moneda', moneda));
    }
    if (page != null) {
      queryParams.addAll(_queryParams('', 'page', page));
    }
    if (limit != null) {
      queryParams.addAll(_queryParams('', 'limit', limit));
    }
    if (realizadoPor != null) {
      queryParams.addAll(_queryParams('', 'realizadoPor', realizadoPor));
    }
    if (export_ != null) {
      queryParams.addAll(_queryParams('', 'export', export_));
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

  /// Consultar reporte de transferencias
  ///
  /// Analiza transferencias por cuentas, monedas y responsable, con exportación opcional. Permite precisar la consulta mediante fecha inicial, fecha final, cuenta de origen, cuenta de destino, moneda, página, límite por página, usuario responsable, formato de exportación.
  ///
  /// Parameters:
  ///
  /// * [DateTime] fechaInicio:
  ///   Inicio inclusivo del período consultado.
  ///
  /// * [DateTime] fechaFin:
  ///   Fin inclusivo del período consultado.
  ///
  /// * [String] cuentaOrigenId:
  ///   Valor de cuentaOrigenId aceptado por el handler.
  ///
  /// * [String] cuentaDestinoId:
  ///   Valor de cuentaDestinoId aceptado por el handler.
  ///
  /// * [String] moneda:
  ///   Código de moneda.
  ///
  /// * [int] page:
  ///   Página solicitada, comenzando en 1.
  ///
  /// * [int] limit:
  ///   Cantidad máxima de elementos por página.
  ///
  /// * [String] realizadoPor:
  ///   Valor de realizadoPor aceptado por el handler.
  ///
  /// * [String] export_:
  ///   Valor de export aceptado por el handler.
  Future<GetAccountingReportsTransfersResponse?> mobileGetAccountingReportsTransfers({ DateTime? fechaInicio, DateTime? fechaFin, String? cuentaOrigenId, String? cuentaDestinoId, String? moneda, int? page, int? limit, String? realizadoPor, String? export_, }) async {
    final response = await mobileGetAccountingReportsTransfersWithHttpInfo( fechaInicio: fechaInicio, fechaFin: fechaFin, cuentaOrigenId: cuentaOrigenId, cuentaDestinoId: cuentaDestinoId, moneda: moneda, page: page, limit: limit, realizadoPor: realizadoPor, export_: export_, );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetAccountingReportsTransfersResponse',) as GetAccountingReportsTransfersResponse;
    
    }
    return null;
  }
}
