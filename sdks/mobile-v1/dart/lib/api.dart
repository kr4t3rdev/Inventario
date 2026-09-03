//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

library openapi.api;

import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:collection/collection.dart';
import 'package:http/http.dart';
import 'package:intl/intl.dart';
import 'package:meta/meta.dart';

part 'api_client.dart';
part 'api_helper.dart';
part 'api_exception.dart';
part 'auth/authentication.dart';
part 'auth/api_key_auth.dart';
part 'auth/oauth.dart';
part 'auth/http_basic_auth.dart';
part 'auth/http_bearer_auth.dart';

part 'api/accounting_advances_api.dart';
part 'api/accounting_banking_api.dart';
part 'api/accounting_capital_api.dart';
part 'api/accounting_cash_financing_api.dart';
part 'api/accounting_configuration_api.dart';
part 'api/accounting_receivables_and_payables_api.dart';
part 'api/accounting_reconciliation_api.dart';
part 'api/accounting_reports_api.dart';
part 'api/auth_api.dart';
part 'api/dashboard_api.dart';
part 'api/products_api.dart';
part 'api/sales_api.dart';

part 'model/account_payable.dart';
part 'model/account_receivable.dart';
part 'model/accounting_advances_id_ejecutar_post_request.dart';
part 'model/accounting_advances_id_put_request.dart';
part 'model/accounting_advances_id_revertir_post_request.dart';
part 'model/accounting_advances_post_request.dart';
part 'model/advance.dart';
part 'model/advance_workflow_result.dart';
part 'model/api_error.dart';
part 'model/audit_log.dart';
part 'model/auth_session.dart';
part 'model/authenticated_user.dart';
part 'model/bank_account.dart';
part 'model/bank_account_history_summary.dart';
part 'model/bank_account_transaction.dart';
part 'model/bank_adjustment.dart';
part 'model/bank_adjustment_request.dart';
part 'model/bank_transfer.dart';
part 'model/bank_transfer_create_request.dart';
part 'model/bank_transfer_validation_request.dart';
part 'model/capital_injection.dart';
part 'model/capital_injection_create_request.dart';
part 'model/capital_payment_request.dart';
part 'model/cash_debt.dart';
part 'model/cash_debt_create_request.dart';
part 'model/cash_loan.dart';
part 'model/cash_loan_create_request.dart';
part 'model/cash_operation_update_request.dart';
part 'model/cash_payment_request.dart';
part 'model/currency.dart';
part 'model/delete_accounting_advances_id_response.dart';
part 'model/delete_accounting_payment_types_id_response.dart';
part 'model/exchange_rate.dart';
part 'model/expense_distribution_request.dart';
part 'model/expense_reconciliation_request.dart';
part 'model/get_accounting_accounts_payable_response.dart';
part 'model/get_accounting_accounts_receivable_metrics_response.dart';
part 'model/get_accounting_accounts_receivable_response.dart';
part 'model/get_accounting_advances_available_response.dart';
part 'model/get_accounting_advances_id_response.dart';
part 'model/get_accounting_advances_reports_customers_response.dart';
part 'model/get_accounting_advances_reports_providers_response.dart';
part 'model/get_accounting_advances_reports_summary_response.dart';
part 'model/get_accounting_advances_response.dart';
part 'model/get_accounting_bank_accounts_id_history_response.dart';
part 'model/get_accounting_bank_accounts_id_response.dart';
part 'model/get_accounting_bank_accounts_response.dart';
part 'model/get_accounting_bank_adjustments_response.dart';
part 'model/get_accounting_bank_transfers_id_response.dart';
part 'model/get_accounting_bank_transfers_response.dart';
part 'model/get_accounting_capital_injections_response.dart';
part 'model/get_accounting_cash_debts_id_response.dart';
part 'model/get_accounting_cash_debts_response.dart';
part 'model/get_accounting_cash_debts_stats_response.dart';
part 'model/get_accounting_cash_loans_id_history_response.dart';
part 'model/get_accounting_cash_loans_id_response.dart';
part 'model/get_accounting_cash_loans_response.dart';
part 'model/get_accounting_cash_loans_stats_response.dart';
part 'model/get_accounting_exchange_monedas_response.dart';
part 'model/get_accounting_exchange_tasas_response.dart';
part 'model/get_accounting_logs_response.dart';
part 'model/get_accounting_payment_types_available_accounts_response.dart';
part 'model/get_accounting_payment_types_id_response.dart';
part 'model/get_accounting_payment_types_response.dart';
part 'model/get_accounting_reconciliation_expenses_history_response.dart';
part 'model/get_accounting_reconciliation_expenses_response.dart';
part 'model/get_accounting_reconciliation_sales_history_response.dart';
part 'model/get_accounting_reconciliation_sales_response.dart';
part 'model/get_accounting_reconciliation_services_history_response.dart';
part 'model/get_accounting_reconciliation_services_response.dart';
part 'model/get_accounting_reconciliation_stats_response.dart';
part 'model/get_accounting_reports_client_account_analysis_response.dart';
part 'model/get_accounting_reports_exchange_impact_response.dart';
part 'model/get_accounting_reports_exchange_response.dart';
part 'model/get_accounting_reports_movements_response.dart';
part 'model/get_accounting_reports_overdue_invoices_response.dart';
part 'model/get_accounting_reports_summary_response.dart';
part 'model/get_accounting_reports_transfers_response.dart';
part 'model/get_dashboard_stats_response.dart';
part 'model/get_products_id_response.dart';
part 'model/get_products_response.dart';
part 'model/get_products_stock_response.dart';
part 'model/get_sales_id_response.dart';
part 'model/get_sales_response.dart';
part 'model/json_value.dart';
part 'model/login_request.dart';
part 'model/pagination.dart';
part 'model/patch_sales_id_update_response.dart';
part 'model/payable_account_summary.dart';
part 'model/payable_payment_summary.dart';
part 'model/payment_type.dart';
part 'model/payment_type_update_request.dart';
part 'model/post_accounting_advances_id_ejecutar_response.dart';
part 'model/post_accounting_advances_id_revertir_response.dart';
part 'model/post_accounting_advances_response.dart';
part 'model/post_accounting_bank_adjustments_response.dart';
part 'model/post_accounting_bank_transfers_response.dart';
part 'model/post_accounting_bank_transfers_validate_response.dart';
part 'model/post_accounting_capital_injections_id_payments_response.dart';
part 'model/post_accounting_capital_injections_response.dart';
part 'model/post_accounting_cash_debts_id_payments_response.dart';
part 'model/post_accounting_cash_debts_response.dart';
part 'model/post_accounting_cash_loans_id_payments_response.dart';
part 'model/post_accounting_cash_loans_response.dart';
part 'model/post_accounting_reconciliation_expenses_response.dart';
part 'model/post_accounting_reconciliation_sales_response.dart';
part 'model/post_accounting_reconciliation_services_response.dart';
part 'model/post_sales_create_response.dart';
part 'model/post_sales_id_cancel_response.dart';
part 'model/product.dart';
part 'model/put_accounting_advances_id_response.dart';
part 'model/put_accounting_cash_debts_id_response.dart';
part 'model/put_accounting_cash_loans_id_response.dart';
part 'model/put_accounting_payment_types_id_response.dart';
part 'model/reconciliation.dart';
part 'model/reconciliation_activity.dart';
part 'model/reconciliation_module_stats.dart';
part 'model/reconciliation_modules.dart';
part 'model/reconciliation_overview_stats.dart';
part 'model/refresh_request.dart';
part 'model/register_request.dart';
part 'model/register_response.dart';
part 'model/report_filters.dart';
part 'model/report_result.dart';
part 'model/report_statistics.dart';
part 'model/report_totals.dart';
part 'model/sale.dart';
part 'model/sale_cancel_request.dart';
part 'model/sale_create_request.dart';
part 'model/sale_item.dart';
part 'model/sale_item_request.dart';
part 'model/sale_reconciliation_request.dart';
part 'model/sale_update_request.dart';
part 'model/service_distribution_request.dart';
part 'model/service_reconciliation_request.dart';
part 'model/success_response.dart';
part 'model/switch_tenant_request.dart';
part 'model/switch_tenant_response.dart';
part 'model/tenant_list_response.dart';
part 'model/tenant_summary.dart';
part 'model/token.dart';
part 'model/token_pair.dart';


/// An [ApiClient] instance that uses the default values obtained from
/// the OpenAPI specification file.
var defaultApiClient = ApiClient();

const _delimiters = {'csv': ',', 'ssv': ' ', 'tsv': '\t', 'pipes': '|'};
const _dateEpochMarker = 'epoch';
const _deepEquality = DeepCollectionEquality();
final _dateFormatter = DateFormat('yyyy-MM-dd');
final _regList = RegExp(r'^List<(.*)>$');
final _regSet = RegExp(r'^Set<(.*)>$');
final _regMap = RegExp(r'^Map<String,(.*)>$');

bool _isEpochMarker(String? pattern) => pattern == _dateEpochMarker || pattern == '/$_dateEpochMarker/';
