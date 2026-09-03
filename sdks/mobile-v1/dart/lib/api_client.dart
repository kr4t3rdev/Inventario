//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class ApiClient {
  ApiClient({this.basePath = '/api/mobile/v1', this.authentication,});

  final String basePath;
  final Authentication? authentication;

  var _client = Client();
  final _defaultHeaderMap = <String, String>{};

  /// Returns the current HTTP [Client] instance to use in this class.
  ///
  /// The return value is guaranteed to never be null.
  Client get client => _client;

  /// Requests to use a new HTTP [Client] in this class.
  set client(Client newClient) {
    _client = newClient;
  }

  Map<String, String> get defaultHeaderMap => _defaultHeaderMap;

  void addDefaultHeader(String key, String value) {
     _defaultHeaderMap[key] = value;
  }

  // We don't use a Map<String, String> for queryParams.
  // If collectionFormat is 'multi', a key might appear multiple times.
  Future<Response> invokeAPI(
    String path,
    String method,
    List<QueryParam> queryParams,
    Object? body,
    Map<String, String> headerParams,
    Map<String, String> formParams,
    String? contentType,
  ) async {
    await authentication?.applyToParams(queryParams, headerParams);

    headerParams.addAll(_defaultHeaderMap);
    if (contentType != null) {
      headerParams['Content-Type'] = contentType;
    }

    final urlEncodedQueryParams = queryParams.map((param) => '$param');
    final queryString = urlEncodedQueryParams.isNotEmpty ? '?${urlEncodedQueryParams.join('&')}' : '';
    final uri = Uri.parse('$basePath$path$queryString');

    try {
      // Special case for uploading a single file which isn't a 'multipart/form-data'.
      if (
        body is MultipartFile && (contentType == null ||
        !contentType.toLowerCase().startsWith('multipart/form-data'))
      ) {
        final request = StreamedRequest(method, uri);
        request.headers.addAll(headerParams);
        request.contentLength = body.length;
        body.finalize().listen(
          request.sink.add,
          onDone: request.sink.close,
          // ignore: avoid_types_on_closure_parameters
          onError: (Object error, StackTrace trace) => request.sink.close(),
          cancelOnError: true,
        );
        final response = await _client.send(request);
        return Response.fromStream(response);
      }

      if (body is MultipartRequest) {
        final request = MultipartRequest(method, uri);
        request.fields.addAll(body.fields);
        request.files.addAll(body.files);
        request.headers.addAll(body.headers);
        request.headers.addAll(headerParams);
        final response = await _client.send(request);
        return Response.fromStream(response);
      }

      final msgBody = contentType == 'application/x-www-form-urlencoded'
        ? formParams
        : await serializeAsync(body);
      final nullableHeaderParams = headerParams.isEmpty ? null : headerParams;

      switch(method) {
        case 'POST': return await _client.post(uri, headers: nullableHeaderParams, body: msgBody,);
        case 'PUT': return await _client.put(uri, headers: nullableHeaderParams, body: msgBody,);
        case 'DELETE': return await _client.delete(uri, headers: nullableHeaderParams, body: msgBody,);
        case 'PATCH': return await _client.patch(uri, headers: nullableHeaderParams, body: msgBody,);
        case 'HEAD': return await _client.head(uri, headers: nullableHeaderParams,);
        case 'GET': return await _client.get(uri, headers: nullableHeaderParams,);
      }
    } on SocketException catch (error, trace) {
      throw ApiException.withInner(
        HttpStatus.badRequest,
        'Socket operation failed: $method $path',
        error,
        trace,
      );
    } on TlsException catch (error, trace) {
      throw ApiException.withInner(
        HttpStatus.badRequest,
        'TLS/SSL communication failed: $method $path',
        error,
        trace,
      );
    } on IOException catch (error, trace) {
      throw ApiException.withInner(
        HttpStatus.badRequest,
        'I/O operation failed: $method $path',
        error,
        trace,
      );
    } on ClientException catch (error, trace) {
      throw ApiException.withInner(
        HttpStatus.badRequest,
        'HTTP connection failed: $method $path',
        error,
        trace,
      );
    } on Exception catch (error, trace) {
      throw ApiException.withInner(
        HttpStatus.badRequest,
        'Exception occurred: $method $path',
        error,
        trace,
      );
    }

    throw ApiException(
      HttpStatus.badRequest,
      'Invalid HTTP operation: $method $path',
    );
  }

  Future<dynamic> deserializeAsync(String value, String targetType, {bool growable = false,}) async =>
    // ignore: deprecated_member_use_from_same_package
    deserialize(value, targetType, growable: growable);

  @Deprecated('Scheduled for removal in OpenAPI Generator 6.x. Use deserializeAsync() instead.')
  dynamic deserialize(String value, String targetType, {bool growable = false,}) {
    // Remove all spaces. Necessary for regular expressions as well.
    targetType = targetType.replaceAll(' ', ''); // ignore: parameter_assignments

    // If the expected target type is String, nothing to do...
    return targetType == 'String'
      ? value
      : fromJson(json.decode(value), targetType, growable: growable);
  }

  // ignore: deprecated_member_use_from_same_package
  Future<String> serializeAsync(Object? value) async => serialize(value);

  @Deprecated('Scheduled for removal in OpenAPI Generator 6.x. Use serializeAsync() instead.')
  String serialize(Object? value) => value == null ? '' : json.encode(value);

  /// Returns a native instance of an OpenAPI class matching the [specified type][targetType].
  static dynamic fromJson(dynamic value, String targetType, {bool growable = false,}) {
    try {
      switch (targetType) {
        case 'String':
          return value is String ? value : value.toString();
        case 'int':
          return value is int ? value : int.parse('$value');
        case 'double':
          return value is double ? value : double.parse('$value');
        case 'bool':
          if (value is bool) {
            return value;
          }
          final valueString = '$value'.toLowerCase();
          return valueString == 'true' || valueString == '1';
        case 'DateTime':
          return value is DateTime ? value : DateTime.tryParse(value);
        case 'AccountPayable':
          return AccountPayable.fromJson(value);
        case 'AccountReceivable':
          return AccountReceivable.fromJson(value);
        case 'AccountingAdvancesIdEjecutarPostRequest':
          return AccountingAdvancesIdEjecutarPostRequest.fromJson(value);
        case 'AccountingAdvancesIdPutRequest':
          return AccountingAdvancesIdPutRequest.fromJson(value);
        case 'AccountingAdvancesIdRevertirPostRequest':
          return AccountingAdvancesIdRevertirPostRequest.fromJson(value);
        case 'AccountingAdvancesPostRequest':
          return AccountingAdvancesPostRequest.fromJson(value);
        case 'AdminHealthResponse':
          return AdminHealthResponse.fromJson(value);
        case 'AdminHealthResponseLicenses':
          return AdminHealthResponseLicenses.fromJson(value);
        case 'AdminHealthResponseSessions':
          return AdminHealthResponseSessions.fromJson(value);
        case 'AdminHealthResponseTenants':
          return AdminHealthResponseTenants.fromJson(value);
        case 'AdminHealthResponseUsers':
          return AdminHealthResponseUsers.fromJson(value);
        case 'AdminHealthResponseUsersByRoleInner':
          return AdminHealthResponseUsersByRoleInner.fromJson(value);
        case 'AdminHealthResponseUsersComparison':
          return AdminHealthResponseUsersComparison.fromJson(value);
        case 'AdminHealthResponseUsersTrendInner':
          return AdminHealthResponseUsersTrendInner.fromJson(value);
        case 'AdminLicenseItem':
          return AdminLicenseItem.fromJson(value);
        case 'AdminLicenseItemCreatedByUser':
          return AdminLicenseItemCreatedByUser.fromJson(value);
        case 'AdminLicenseItemTenant':
          return AdminLicenseItemTenant.fromJson(value);
        case 'AdminLicenseManagerItem':
          return AdminLicenseManagerItem.fromJson(value);
        case 'AdminPendingUserItem':
          return AdminPendingUserItem.fromJson(value);
        case 'AdminTenantItem':
          return AdminTenantItem.fromJson(value);
        case 'AdminTenantItemCount':
          return AdminTenantItemCount.fromJson(value);
        case 'AdminTenantLicenseItem':
          return AdminTenantLicenseItem.fromJson(value);
        case 'AdminTenantLicenseItemPlan':
          return AdminTenantLicenseItemPlan.fromJson(value);
        case 'AdminTenantLite':
          return AdminTenantLite.fromJson(value);
        case 'AdminUserItem':
          return AdminUserItem.fromJson(value);
        case 'AdminUserItemSalesAgentBalance':
          return AdminUserItemSalesAgentBalance.fromJson(value);
        case 'AdminUserItemSalesAgentProfile':
          return AdminUserItemSalesAgentProfile.fromJson(value);
        case 'AdminUserLite':
          return AdminUserLite.fromJson(value);
        case 'Advance':
          return Advance.fromJson(value);
        case 'AdvanceWorkflowResult':
          return AdvanceWorkflowResult.fromJson(value);
        case 'Almacen':
          return Almacen.fromJson(value);
        case 'AlmacenCreateRequest':
          return AlmacenCreateRequest.fromJson(value);
        case 'AlmacenDeleteResponse':
          return AlmacenDeleteResponse.fromJson(value);
        case 'AlmacenListResponse':
          return AlmacenListResponse.fromJson(value);
        case 'AlmacenUpdateRequest':
          return AlmacenUpdateRequest.fromJson(value);
        case 'ApiError':
          return ApiError.fromJson(value);
        case 'AuditLog':
          return AuditLog.fromJson(value);
        case 'AuthSession':
          return AuthSession.fromJson(value);
        case 'AuthenticatedUser':
          return AuthenticatedUser.fromJson(value);
        case 'BankAccount':
          return BankAccount.fromJson(value);
        case 'BankAccountHistorySummary':
          return BankAccountHistorySummary.fromJson(value);
        case 'BankAccountTransaction':
          return BankAccountTransaction.fromJson(value);
        case 'BankAdjustment':
          return BankAdjustment.fromJson(value);
        case 'BankAdjustmentRequest':
          return BankAdjustmentRequest.fromJson(value);
        case 'BankTransfer':
          return BankTransfer.fromJson(value);
        case 'BankTransferCreateRequest':
          return BankTransferCreateRequest.fromJson(value);
        case 'BankTransferValidationRequest':
          return BankTransferValidationRequest.fromJson(value);
        case 'CapitalInjection':
          return CapitalInjection.fromJson(value);
        case 'CapitalInjectionCreateRequest':
          return CapitalInjectionCreateRequest.fromJson(value);
        case 'CapitalPaymentRequest':
          return CapitalPaymentRequest.fromJson(value);
        case 'CashDebt':
          return CashDebt.fromJson(value);
        case 'CashDebtCreateRequest':
          return CashDebtCreateRequest.fromJson(value);
        case 'CashLoan':
          return CashLoan.fromJson(value);
        case 'CashLoanCreateRequest':
          return CashLoanCreateRequest.fromJson(value);
        case 'CashOperationUpdateRequest':
          return CashOperationUpdateRequest.fromJson(value);
        case 'CashPaymentRequest':
          return CashPaymentRequest.fromJson(value);
        case 'Cliente':
          return Cliente.fromJson(value);
        case 'ClienteCreateRequest':
          return ClienteCreateRequest.fromJson(value);
        case 'ClienteDeleteResponse':
          return ClienteDeleteResponse.fromJson(value);
        case 'ClienteListResponse':
          return ClienteListResponse.fromJson(value);
        case 'ClienteUpdateRequest':
          return ClienteUpdateRequest.fromJson(value);
        case 'Currency':
          return Currency.fromJson(value);
        case 'DeleteAccountingAdvancesIdResponse':
          return DeleteAccountingAdvancesIdResponse.fromJson(value);
        case 'DeleteAccountingPaymentTypesIdResponse':
          return DeleteAccountingPaymentTypesIdResponse.fromJson(value);
        case 'ExchangeRate':
          return ExchangeRate.fromJson(value);
        case 'ExpenseDistributionRequest':
          return ExpenseDistributionRequest.fromJson(value);
        case 'ExpenseReconciliationRequest':
          return ExpenseReconciliationRequest.fromJson(value);
        case 'GetAccountingAccountsPayableResponse':
          return GetAccountingAccountsPayableResponse.fromJson(value);
        case 'GetAccountingAccountsReceivableMetricsResponse':
          return GetAccountingAccountsReceivableMetricsResponse.fromJson(value);
        case 'GetAccountingAccountsReceivableResponse':
          return GetAccountingAccountsReceivableResponse.fromJson(value);
        case 'GetAccountingAdvancesAvailableResponse':
          return GetAccountingAdvancesAvailableResponse.fromJson(value);
        case 'GetAccountingAdvancesIdResponse':
          return GetAccountingAdvancesIdResponse.fromJson(value);
        case 'GetAccountingAdvancesReportsCustomersResponse':
          return GetAccountingAdvancesReportsCustomersResponse.fromJson(value);
        case 'GetAccountingAdvancesReportsProvidersResponse':
          return GetAccountingAdvancesReportsProvidersResponse.fromJson(value);
        case 'GetAccountingAdvancesReportsSummaryResponse':
          return GetAccountingAdvancesReportsSummaryResponse.fromJson(value);
        case 'GetAccountingAdvancesResponse':
          return GetAccountingAdvancesResponse.fromJson(value);
        case 'GetAccountingBankAccountsIdHistoryResponse':
          return GetAccountingBankAccountsIdHistoryResponse.fromJson(value);
        case 'GetAccountingBankAccountsIdResponse':
          return GetAccountingBankAccountsIdResponse.fromJson(value);
        case 'GetAccountingBankAccountsResponse':
          return GetAccountingBankAccountsResponse.fromJson(value);
        case 'GetAccountingBankAdjustmentsResponse':
          return GetAccountingBankAdjustmentsResponse.fromJson(value);
        case 'GetAccountingBankTransfersIdResponse':
          return GetAccountingBankTransfersIdResponse.fromJson(value);
        case 'GetAccountingBankTransfersResponse':
          return GetAccountingBankTransfersResponse.fromJson(value);
        case 'GetAccountingCapitalInjectionsResponse':
          return GetAccountingCapitalInjectionsResponse.fromJson(value);
        case 'GetAccountingCashDebtsIdResponse':
          return GetAccountingCashDebtsIdResponse.fromJson(value);
        case 'GetAccountingCashDebtsResponse':
          return GetAccountingCashDebtsResponse.fromJson(value);
        case 'GetAccountingCashDebtsStatsResponse':
          return GetAccountingCashDebtsStatsResponse.fromJson(value);
        case 'GetAccountingCashLoansIdHistoryResponse':
          return GetAccountingCashLoansIdHistoryResponse.fromJson(value);
        case 'GetAccountingCashLoansIdResponse':
          return GetAccountingCashLoansIdResponse.fromJson(value);
        case 'GetAccountingCashLoansResponse':
          return GetAccountingCashLoansResponse.fromJson(value);
        case 'GetAccountingCashLoansStatsResponse':
          return GetAccountingCashLoansStatsResponse.fromJson(value);
        case 'GetAccountingExchangeMonedasResponse':
          return GetAccountingExchangeMonedasResponse.fromJson(value);
        case 'GetAccountingExchangeTasasResponse':
          return GetAccountingExchangeTasasResponse.fromJson(value);
        case 'GetAccountingLogsResponse':
          return GetAccountingLogsResponse.fromJson(value);
        case 'GetAccountingPaymentTypesAvailableAccountsResponse':
          return GetAccountingPaymentTypesAvailableAccountsResponse.fromJson(value);
        case 'GetAccountingPaymentTypesIdResponse':
          return GetAccountingPaymentTypesIdResponse.fromJson(value);
        case 'GetAccountingPaymentTypesResponse':
          return GetAccountingPaymentTypesResponse.fromJson(value);
        case 'GetAccountingReconciliationExpensesHistoryResponse':
          return GetAccountingReconciliationExpensesHistoryResponse.fromJson(value);
        case 'GetAccountingReconciliationExpensesResponse':
          return GetAccountingReconciliationExpensesResponse.fromJson(value);
        case 'GetAccountingReconciliationSalesHistoryResponse':
          return GetAccountingReconciliationSalesHistoryResponse.fromJson(value);
        case 'GetAccountingReconciliationSalesResponse':
          return GetAccountingReconciliationSalesResponse.fromJson(value);
        case 'GetAccountingReconciliationServicesHistoryResponse':
          return GetAccountingReconciliationServicesHistoryResponse.fromJson(value);
        case 'GetAccountingReconciliationServicesResponse':
          return GetAccountingReconciliationServicesResponse.fromJson(value);
        case 'GetAccountingReconciliationStatsResponse':
          return GetAccountingReconciliationStatsResponse.fromJson(value);
        case 'GetAccountingReportsClientAccountAnalysisResponse':
          return GetAccountingReportsClientAccountAnalysisResponse.fromJson(value);
        case 'GetAccountingReportsExchangeImpactResponse':
          return GetAccountingReportsExchangeImpactResponse.fromJson(value);
        case 'GetAccountingReportsExchangeResponse':
          return GetAccountingReportsExchangeResponse.fromJson(value);
        case 'GetAccountingReportsMovementsResponse':
          return GetAccountingReportsMovementsResponse.fromJson(value);
        case 'GetAccountingReportsOverdueInvoicesResponse':
          return GetAccountingReportsOverdueInvoicesResponse.fromJson(value);
        case 'GetAccountingReportsSummaryResponse':
          return GetAccountingReportsSummaryResponse.fromJson(value);
        case 'GetAccountingReportsTransfersResponse':
          return GetAccountingReportsTransfersResponse.fromJson(value);
        case 'GetAdminLicenseStatsResponse':
          return GetAdminLicenseStatsResponse.fromJson(value);
        case 'GetAdminLicensesResponse':
          return GetAdminLicensesResponse.fromJson(value);
        case 'GetAdminUsersResponse':
          return GetAdminUsersResponse.fromJson(value);
        case 'GetDashboardStatsResponse':
          return GetDashboardStatsResponse.fromJson(value);
        case 'GetProductsIdResponse':
          return GetProductsIdResponse.fromJson(value);
        case 'GetProductsResponse':
          return GetProductsResponse.fromJson(value);
        case 'GetProductsStockResponse':
          return GetProductsStockResponse.fromJson(value);
        case 'GetSalesIdResponse':
          return GetSalesIdResponse.fromJson(value);
        case 'GetSalesResponse':
          return GetSalesResponse.fromJson(value);
        case 'JsonValue':
          return JsonValue.fromJson(value);
        case 'LoginRequest':
          return LoginRequest.fromJson(value);
        case 'Pagination':
          return Pagination.fromJson(value);
        case 'PatchSalesIdUpdateResponse':
          return PatchSalesIdUpdateResponse.fromJson(value);
        case 'PayableAccountSummary':
          return PayableAccountSummary.fromJson(value);
        case 'PayablePaymentSummary':
          return PayablePaymentSummary.fromJson(value);
        case 'PaymentType':
          return PaymentType.fromJson(value);
        case 'PaymentTypeUpdateRequest':
          return PaymentTypeUpdateRequest.fromJson(value);
        case 'PendingMembershipItem':
          return PendingMembershipItem.fromJson(value);
        case 'PostAccountingAdvancesIdEjecutarResponse':
          return PostAccountingAdvancesIdEjecutarResponse.fromJson(value);
        case 'PostAccountingAdvancesIdRevertirResponse':
          return PostAccountingAdvancesIdRevertirResponse.fromJson(value);
        case 'PostAccountingAdvancesResponse':
          return PostAccountingAdvancesResponse.fromJson(value);
        case 'PostAccountingBankAdjustmentsResponse':
          return PostAccountingBankAdjustmentsResponse.fromJson(value);
        case 'PostAccountingBankTransfersResponse':
          return PostAccountingBankTransfersResponse.fromJson(value);
        case 'PostAccountingBankTransfersValidateResponse':
          return PostAccountingBankTransfersValidateResponse.fromJson(value);
        case 'PostAccountingCapitalInjectionsIdPaymentsResponse':
          return PostAccountingCapitalInjectionsIdPaymentsResponse.fromJson(value);
        case 'PostAccountingCapitalInjectionsResponse':
          return PostAccountingCapitalInjectionsResponse.fromJson(value);
        case 'PostAccountingCashDebtsIdPaymentsResponse':
          return PostAccountingCashDebtsIdPaymentsResponse.fromJson(value);
        case 'PostAccountingCashDebtsResponse':
          return PostAccountingCashDebtsResponse.fromJson(value);
        case 'PostAccountingCashLoansIdPaymentsResponse':
          return PostAccountingCashLoansIdPaymentsResponse.fromJson(value);
        case 'PostAccountingCashLoansResponse':
          return PostAccountingCashLoansResponse.fromJson(value);
        case 'PostAccountingReconciliationExpensesResponse':
          return PostAccountingReconciliationExpensesResponse.fromJson(value);
        case 'PostAccountingReconciliationSalesResponse':
          return PostAccountingReconciliationSalesResponse.fromJson(value);
        case 'PostAccountingReconciliationServicesResponse':
          return PostAccountingReconciliationServicesResponse.fromJson(value);
        case 'PostSalesCreateResponse':
          return PostSalesCreateResponse.fromJson(value);
        case 'PostSalesIdCancelResponse':
          return PostSalesIdCancelResponse.fromJson(value);
        case 'Product':
          return Product.fromJson(value);
        case 'Proveedor':
          return Proveedor.fromJson(value);
        case 'ProveedorCreateRequest':
          return ProveedorCreateRequest.fromJson(value);
        case 'ProveedorDeleteResponse':
          return ProveedorDeleteResponse.fromJson(value);
        case 'ProveedorListResponse':
          return ProveedorListResponse.fromJson(value);
        case 'ProveedorUpdateRequest':
          return ProveedorUpdateRequest.fromJson(value);
        case 'PutAccountingAdvancesIdResponse':
          return PutAccountingAdvancesIdResponse.fromJson(value);
        case 'PutAccountingCashDebtsIdResponse':
          return PutAccountingCashDebtsIdResponse.fromJson(value);
        case 'PutAccountingCashLoansIdResponse':
          return PutAccountingCashLoansIdResponse.fromJson(value);
        case 'PutAccountingPaymentTypesIdResponse':
          return PutAccountingPaymentTypesIdResponse.fromJson(value);
        case 'Reconciliation':
          return Reconciliation.fromJson(value);
        case 'ReconciliationActivity':
          return ReconciliationActivity.fromJson(value);
        case 'ReconciliationModuleStats':
          return ReconciliationModuleStats.fromJson(value);
        case 'ReconciliationModules':
          return ReconciliationModules.fromJson(value);
        case 'ReconciliationOverviewStats':
          return ReconciliationOverviewStats.fromJson(value);
        case 'RefreshRequest':
          return RefreshRequest.fromJson(value);
        case 'RegisterRequest':
          return RegisterRequest.fromJson(value);
        case 'RegisterResponse':
          return RegisterResponse.fromJson(value);
        case 'ReportFilters':
          return ReportFilters.fromJson(value);
        case 'ReportResult':
          return ReportResult.fromJson(value);
        case 'ReportStatistics':
          return ReportStatistics.fromJson(value);
        case 'ReportTotals':
          return ReportTotals.fromJson(value);
        case 'Sale':
          return Sale.fromJson(value);
        case 'SaleCancelRequest':
          return SaleCancelRequest.fromJson(value);
        case 'SaleCreateRequest':
          return SaleCreateRequest.fromJson(value);
        case 'SaleItem':
          return SaleItem.fromJson(value);
        case 'SaleItemRequest':
          return SaleItemRequest.fromJson(value);
        case 'SaleReconciliationRequest':
          return SaleReconciliationRequest.fromJson(value);
        case 'SaleUpdateRequest':
          return SaleUpdateRequest.fromJson(value);
        case 'ServiceDistributionRequest':
          return ServiceDistributionRequest.fromJson(value);
        case 'ServiceReconciliationRequest':
          return ServiceReconciliationRequest.fromJson(value);
        case 'SuccessResponse':
          return SuccessResponse.fromJson(value);
        case 'SwitchTenantRequest':
          return SwitchTenantRequest.fromJson(value);
        case 'SwitchTenantResponse':
          return SwitchTenantResponse.fromJson(value);
        case 'TenantListResponse':
          return TenantListResponse.fromJson(value);
        case 'TenantSummary':
          return TenantSummary.fromJson(value);
        case 'Token':
          return Token.fromJson(value);
        case 'TokenPair':
          return TokenPair.fromJson(value);
        default:
          dynamic match;
          if (value is List && (match = _regList.firstMatch(targetType)?.group(1)) != null) {
            return value
              .map<dynamic>((dynamic v) => fromJson(v, match, growable: growable,))
              .toList(growable: growable);
          }
          if (value is Set && (match = _regSet.firstMatch(targetType)?.group(1)) != null) {
            return value
              .map<dynamic>((dynamic v) => fromJson(v, match, growable: growable,))
              .toSet();
          }
          if (value is Map && (match = _regMap.firstMatch(targetType)?.group(1)) != null) {
            return Map<String, dynamic>.fromIterables(
              value.keys.cast<String>(),
              value.values.map<dynamic>((dynamic v) => fromJson(v, match, growable: growable,)),
            );
          }
      }
    } on Exception catch (error, trace) {
      throw ApiException.withInner(HttpStatus.internalServerError, 'Exception during deserialization.', error, trace,);
    }
    throw ApiException(HttpStatus.internalServerError, 'Could not find a suitable class for deserialization',);
  }
}

/// Primarily intended for use in an isolate.
class DeserializationMessage {
  const DeserializationMessage({
    required this.json,
    required this.targetType,
    this.growable = false,
  });

  /// The JSON value to deserialize.
  final String json;

  /// Target type to deserialize to.
  final String targetType;

  /// Whether to make deserialized lists or maps growable.
  final bool growable;
}

/// Primarily intended for use in an isolate.
Future<dynamic> decodeAsync(DeserializationMessage message) async {
  // Remove all spaces. Necessary for regular expressions as well.
  final targetType = message.targetType.replaceAll(' ', '');

  // If the expected target type is String, nothing to do...
  return targetType == 'String'
    ? message.json
    : json.decode(message.json);
}

/// Primarily intended for use in an isolate.
Future<dynamic> deserializeAsync(DeserializationMessage message) async {
  // Remove all spaces. Necessary for regular expressions as well.
  final targetType = message.targetType.replaceAll(' ', '');

  // If the expected target type is String, nothing to do...
  return targetType == 'String'
    ? message.json
    : ApiClient.fromJson(
        json.decode(message.json),
        targetType,
        growable: message.growable,
      );
}

/// Primarily intended for use in an isolate.
Future<String> serializeAsync(Object? value) async => value == null ? '' : json.encode(value);
