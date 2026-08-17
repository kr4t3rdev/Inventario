//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class GetAccountingBankAccountsIdHistoryResponse {
  /// Returns a new [GetAccountingBankAccountsIdHistoryResponse] instance.
  GetAccountingBankAccountsIdHistoryResponse({
    this.transacciones = const [],
    required this.resumen,
    required this.pagination,
  });

  List<BankAccountTransaction> transacciones;

  BankAccountHistorySummary resumen;

  Pagination pagination;

  @override
  bool operator ==(Object other) => identical(this, other) || other is GetAccountingBankAccountsIdHistoryResponse &&
    _deepEquality.equals(other.transacciones, transacciones) &&
    other.resumen == resumen &&
    other.pagination == pagination;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (transacciones.hashCode) +
    (resumen.hashCode) +
    (pagination.hashCode);

  @override
  String toString() => 'GetAccountingBankAccountsIdHistoryResponse[transacciones=$transacciones, resumen=$resumen, pagination=$pagination]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'transacciones'] = this.transacciones;
      json[r'resumen'] = this.resumen;
      json[r'pagination'] = this.pagination;
    return json;
  }

  /// Returns a new [GetAccountingBankAccountsIdHistoryResponse] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static GetAccountingBankAccountsIdHistoryResponse? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "GetAccountingBankAccountsIdHistoryResponse[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "GetAccountingBankAccountsIdHistoryResponse[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return GetAccountingBankAccountsIdHistoryResponse(
        transacciones: BankAccountTransaction.listFromJson(json[r'transacciones']),
        resumen: BankAccountHistorySummary.fromJson(json[r'resumen'])!,
        pagination: Pagination.fromJson(json[r'pagination'])!,
      );
    }
    return null;
  }

  static List<GetAccountingBankAccountsIdHistoryResponse> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <GetAccountingBankAccountsIdHistoryResponse>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = GetAccountingBankAccountsIdHistoryResponse.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, GetAccountingBankAccountsIdHistoryResponse> mapFromJson(dynamic json) {
    final map = <String, GetAccountingBankAccountsIdHistoryResponse>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = GetAccountingBankAccountsIdHistoryResponse.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of GetAccountingBankAccountsIdHistoryResponse-objects as value to a dart map
  static Map<String, List<GetAccountingBankAccountsIdHistoryResponse>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<GetAccountingBankAccountsIdHistoryResponse>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = GetAccountingBankAccountsIdHistoryResponse.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'transacciones',
    'resumen',
    'pagination',
  };
}

