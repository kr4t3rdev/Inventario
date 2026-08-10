//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class GetAccountingBankAdjustmentsResponse {
  /// Returns a new [GetAccountingBankAdjustmentsResponse] instance.
  GetAccountingBankAdjustmentsResponse({
    this.items = const [],
    required this.cuentaBancaria,
    required this.pagination,
  });

  List<BankAdjustment> items;

  BankAccount cuentaBancaria;

  Pagination pagination;

  @override
  bool operator ==(Object other) => identical(this, other) || other is GetAccountingBankAdjustmentsResponse &&
    _deepEquality.equals(other.items, items) &&
    other.cuentaBancaria == cuentaBancaria &&
    other.pagination == pagination;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (items.hashCode) +
    (cuentaBancaria.hashCode) +
    (pagination.hashCode);

  @override
  String toString() => 'GetAccountingBankAdjustmentsResponse[items=$items, cuentaBancaria=$cuentaBancaria, pagination=$pagination]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'items'] = this.items;
      json[r'cuentaBancaria'] = this.cuentaBancaria;
      json[r'pagination'] = this.pagination;
    return json;
  }

  /// Returns a new [GetAccountingBankAdjustmentsResponse] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static GetAccountingBankAdjustmentsResponse? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "GetAccountingBankAdjustmentsResponse[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "GetAccountingBankAdjustmentsResponse[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return GetAccountingBankAdjustmentsResponse(
        items: BankAdjustment.listFromJson(json[r'items']),
        cuentaBancaria: BankAccount.fromJson(json[r'cuentaBancaria'])!,
        pagination: Pagination.fromJson(json[r'pagination'])!,
      );
    }
    return null;
  }

  static List<GetAccountingBankAdjustmentsResponse> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <GetAccountingBankAdjustmentsResponse>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = GetAccountingBankAdjustmentsResponse.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, GetAccountingBankAdjustmentsResponse> mapFromJson(dynamic json) {
    final map = <String, GetAccountingBankAdjustmentsResponse>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = GetAccountingBankAdjustmentsResponse.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of GetAccountingBankAdjustmentsResponse-objects as value to a dart map
  static Map<String, List<GetAccountingBankAdjustmentsResponse>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<GetAccountingBankAdjustmentsResponse>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = GetAccountingBankAdjustmentsResponse.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'items',
    'cuentaBancaria',
    'pagination',
  };
}

