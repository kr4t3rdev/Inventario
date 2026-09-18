//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;


class AccountingConfigurationApi {
  AccountingConfigurationApi([ApiClient? apiClient]) : apiClient = apiClient ?? defaultApiClient;

  final ApiClient apiClient;

  /// Eliminar tipos de pago
  ///
  /// Elimina el medio de pago únicamente cuando no tiene conciliaciones asociadas.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador único del recurso.
  Future<Response> mobileDeleteAccountingPaymentTypesByIdWithHttpInfo(String id,) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/payment-types/{id}'
      .replaceAll('{id}', id);

    // ignore: prefer_final_locals
    Object? postBody;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    const contentTypes = <String>[];


    return apiClient.invokeAPI(
      path,
      'DELETE',
      queryParams,
      postBody,
      headerParams,
      formParams,
      contentTypes.isEmpty ? null : contentTypes.first,
    );
  }

  /// Eliminar tipos de pago
  ///
  /// Elimina el medio de pago únicamente cuando no tiene conciliaciones asociadas.
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador único del recurso.
  Future<DeleteAccountingPaymentTypesIdResponse?> mobileDeleteAccountingPaymentTypesById(String id,) async {
    final response = await mobileDeleteAccountingPaymentTypesByIdWithHttpInfo(id,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'DeleteAccountingPaymentTypesIdResponse',) as DeleteAccountingPaymentTypesIdResponse;
    
    }
    return null;
  }

  /// Consultar monedas configuradas
  ///
  /// Devuelve el catálogo de monedas habilitadas para operaciones y reportes contables.
  ///
  /// Note: This method returns the HTTP [Response].
  Future<Response> mobileGetAccountingExchangeMonedasWithHttpInfo() async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/exchange/monedas';

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

  /// Consultar monedas configuradas
  ///
  /// Devuelve el catálogo de monedas habilitadas para operaciones y reportes contables.
  Future<GetAccountingExchangeMonedasResponse?> mobileGetAccountingExchangeMonedas() async {
    final response = await mobileGetAccountingExchangeMonedasWithHttpInfo();
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetAccountingExchangeMonedasResponse',) as GetAccountingExchangeMonedasResponse;
    
    }
    return null;
  }

  /// Consultar tasas de cambio
  ///
  /// Devuelve las tasas de cambio vigentes e históricas utilizadas por contabilidad.
  ///
  /// Note: This method returns the HTTP [Response].
  Future<Response> mobileGetAccountingExchangeTasasWithHttpInfo() async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/exchange/tasas';

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

  /// Consultar tasas de cambio
  ///
  /// Devuelve las tasas de cambio vigentes e históricas utilizadas por contabilidad.
  Future<GetAccountingExchangeTasasResponse?> mobileGetAccountingExchangeTasas() async {
    final response = await mobileGetAccountingExchangeTasasWithHttpInfo();
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetAccountingExchangeTasasResponse',) as GetAccountingExchangeTasasResponse;
    
    }
    return null;
  }

  /// Consultar eventos de auditoría contable
  ///
  /// Consulta la trazabilidad de acciones contables registrada por usuario y entidad. Permite precisar la consulta mediante entidad, límite por página, offset.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] entidad:
  ///   Valor de entidad aceptado por el handler.
  ///
  /// * [int] limit:
  ///   Cantidad máxima de elementos por página.
  ///
  /// * [String] offset:
  ///   Valor de offset aceptado por el handler.
  Future<Response> mobileGetAccountingLogsWithHttpInfo({ String? entidad, int? limit, String? offset, }) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/logs';

    // ignore: prefer_final_locals
    Object? postBody;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    if (entidad != null) {
      queryParams.addAll(_queryParams('', 'entidad', entidad));
    }
    if (limit != null) {
      queryParams.addAll(_queryParams('', 'limit', limit));
    }
    if (offset != null) {
      queryParams.addAll(_queryParams('', 'offset', offset));
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

  /// Consultar eventos de auditoría contable
  ///
  /// Consulta la trazabilidad de acciones contables registrada por usuario y entidad. Permite precisar la consulta mediante entidad, límite por página, offset.
  ///
  /// Parameters:
  ///
  /// * [String] entidad:
  ///   Valor de entidad aceptado por el handler.
  ///
  /// * [int] limit:
  ///   Cantidad máxima de elementos por página.
  ///
  /// * [String] offset:
  ///   Valor de offset aceptado por el handler.
  Future<GetAccountingLogsResponse?> mobileGetAccountingLogs({ String? entidad, int? limit, String? offset, }) async {
    final response = await mobileGetAccountingLogsWithHttpInfo( entidad: entidad, limit: limit, offset: offset, );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetAccountingLogsResponse',) as GetAccountingLogsResponse;
    
    }
    return null;
  }

  /// Consultar tipos de pago
  ///
  /// Lista los medios de pago configurados y su cuenta bancaria predeterminada. Permite precisar la consulta mediante includeInactive, requiereCuenta.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [bool] includeInactive:
  ///   Valor de includeInactive aceptado por el handler.
  ///
  /// * [String] requiereCuenta:
  ///   Valor de requiereCuenta aceptado por el handler.
  Future<Response> mobileGetAccountingPaymentTypesWithHttpInfo({ bool? includeInactive, String? requiereCuenta, }) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/payment-types';

    // ignore: prefer_final_locals
    Object? postBody;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    if (includeInactive != null) {
      queryParams.addAll(_queryParams('', 'includeInactive', includeInactive));
    }
    if (requiereCuenta != null) {
      queryParams.addAll(_queryParams('', 'requiereCuenta', requiereCuenta));
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

  /// Consultar tipos de pago
  ///
  /// Lista los medios de pago configurados y su cuenta bancaria predeterminada. Permite precisar la consulta mediante includeInactive, requiereCuenta.
  ///
  /// Parameters:
  ///
  /// * [bool] includeInactive:
  ///   Valor de includeInactive aceptado por el handler.
  ///
  /// * [String] requiereCuenta:
  ///   Valor de requiereCuenta aceptado por el handler.
  Future<GetAccountingPaymentTypesResponse?> mobileGetAccountingPaymentTypes({ bool? includeInactive, String? requiereCuenta, }) async {
    final response = await mobileGetAccountingPaymentTypesWithHttpInfo( includeInactive: includeInactive, requiereCuenta: requiereCuenta, );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetAccountingPaymentTypesResponse',) as GetAccountingPaymentTypesResponse;
    
    }
    return null;
  }

  /// Consultar cuentas disponibles para tipos de pago
  ///
  /// Lista cuentas activas que pueden asociarse como cuenta predeterminada de un medio de pago. Permite precisar la consulta mediante moneda, tipoCuenta.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] moneda:
  ///   Código de moneda.
  ///
  /// * [String] tipoCuenta:
  ///   Valor de tipoCuenta aceptado por el handler.
  Future<Response> mobileGetAccountingPaymentTypesAvailableAccountsWithHttpInfo({ String? moneda, String? tipoCuenta, }) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/payment-types/available-accounts';

    // ignore: prefer_final_locals
    Object? postBody;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    if (moneda != null) {
      queryParams.addAll(_queryParams('', 'moneda', moneda));
    }
    if (tipoCuenta != null) {
      queryParams.addAll(_queryParams('', 'tipoCuenta', tipoCuenta));
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

  /// Consultar cuentas disponibles para tipos de pago
  ///
  /// Lista cuentas activas que pueden asociarse como cuenta predeterminada de un medio de pago. Permite precisar la consulta mediante moneda, tipoCuenta.
  ///
  /// Parameters:
  ///
  /// * [String] moneda:
  ///   Código de moneda.
  ///
  /// * [String] tipoCuenta:
  ///   Valor de tipoCuenta aceptado por el handler.
  Future<GetAccountingPaymentTypesAvailableAccountsResponse?> mobileGetAccountingPaymentTypesAvailableAccounts({ String? moneda, String? tipoCuenta, }) async {
    final response = await mobileGetAccountingPaymentTypesAvailableAccountsWithHttpInfo( moneda: moneda, tipoCuenta: tipoCuenta, );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetAccountingPaymentTypesAvailableAccountsResponse',) as GetAccountingPaymentTypesAvailableAccountsResponse;
    
    }
    return null;
  }

  /// Consultar tipos de pago
  ///
  /// Devuelve el medio de pago identificado, sus conciliaciones asociadas y la cuenta predeterminada.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador único del recurso.
  Future<Response> mobileGetAccountingPaymentTypesByIdWithHttpInfo(String id,) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/payment-types/{id}'
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

  /// Consultar tipos de pago
  ///
  /// Devuelve el medio de pago identificado, sus conciliaciones asociadas y la cuenta predeterminada.
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador único del recurso.
  Future<GetAccountingPaymentTypesIdResponse?> mobileGetAccountingPaymentTypesById(String id,) async {
    final response = await mobileGetAccountingPaymentTypesByIdWithHttpInfo(id,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'GetAccountingPaymentTypesIdResponse',) as GetAccountingPaymentTypesIdResponse;
    
    }
    return null;
  }

  /// Actualizar tipos de pago
  ///
  /// Actualiza nombre, descripción, requisito de cuenta, cuenta predeterminada o estado activo del medio de pago.
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador único del recurso.
  ///
  /// * [PaymentTypeUpdateRequest] paymentTypeUpdateRequest (required):
  Future<Response> mobilePutAccountingPaymentTypesByIdWithHttpInfo(String id, PaymentTypeUpdateRequest paymentTypeUpdateRequest,) async {
    // ignore: prefer_const_declarations
    final path = r'/accounting/payment-types/{id}'
      .replaceAll('{id}', id);

    // ignore: prefer_final_locals
    Object? postBody = paymentTypeUpdateRequest;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    const contentTypes = <String>['application/json'];


    return apiClient.invokeAPI(
      path,
      'PUT',
      queryParams,
      postBody,
      headerParams,
      formParams,
      contentTypes.isEmpty ? null : contentTypes.first,
    );
  }

  /// Actualizar tipos de pago
  ///
  /// Actualiza nombre, descripción, requisito de cuenta, cuenta predeterminada o estado activo del medio de pago.
  ///
  /// Parameters:
  ///
  /// * [String] id (required):
  ///   Identificador único del recurso.
  ///
  /// * [PaymentTypeUpdateRequest] paymentTypeUpdateRequest (required):
  Future<PutAccountingPaymentTypesIdResponse?> mobilePutAccountingPaymentTypesById(String id, PaymentTypeUpdateRequest paymentTypeUpdateRequest,) async {
    final response = await mobilePutAccountingPaymentTypesByIdWithHttpInfo(id, paymentTypeUpdateRequest,);
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
    // When a remote server returns no body with a status of 204, we shall not decode it.
    // At the time of writing this, `dart:convert` will throw an "Unexpected end of input"
    // FormatException when trying to decode an empty string.
    if (response.body.isNotEmpty && response.statusCode != HttpStatus.noContent) {
      return await apiClient.deserializeAsync(await _decodeBodyBytes(response), 'PutAccountingPaymentTypesIdResponse',) as PutAccountingPaymentTypesIdResponse;
    
    }
    return null;
  }
}
