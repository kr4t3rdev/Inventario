//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class GetAccountingPaymentTypesAvailableAccountsResponse {
  /// Returns a new [GetAccountingPaymentTypesAvailableAccountsResponse] instance.
  GetAccountingPaymentTypesAvailableAccountsResponse({
    this.items = const [],
    required this.estadisticas,
  });

  List<PaymentType> items;

  ReportStatistics estadisticas;

  @override
  bool operator ==(Object other) => identical(this, other) || other is GetAccountingPaymentTypesAvailableAccountsResponse &&
    _deepEquality.equals(other.items, items) &&
    other.estadisticas == estadisticas;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (items.hashCode) +
    (estadisticas.hashCode);

  @override
  String toString() => 'GetAccountingPaymentTypesAvailableAccountsResponse[items=$items, estadisticas=$estadisticas]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'items'] = this.items;
      json[r'estadisticas'] = this.estadisticas;
    return json;
  }

  /// Returns a new [GetAccountingPaymentTypesAvailableAccountsResponse] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static GetAccountingPaymentTypesAvailableAccountsResponse? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "GetAccountingPaymentTypesAvailableAccountsResponse[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "GetAccountingPaymentTypesAvailableAccountsResponse[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return GetAccountingPaymentTypesAvailableAccountsResponse(
        items: PaymentType.listFromJson(json[r'items']),
        estadisticas: ReportStatistics.fromJson(json[r'estadisticas'])!,
      );
    }
    return null;
  }

  static List<GetAccountingPaymentTypesAvailableAccountsResponse> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <GetAccountingPaymentTypesAvailableAccountsResponse>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = GetAccountingPaymentTypesAvailableAccountsResponse.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, GetAccountingPaymentTypesAvailableAccountsResponse> mapFromJson(dynamic json) {
    final map = <String, GetAccountingPaymentTypesAvailableAccountsResponse>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = GetAccountingPaymentTypesAvailableAccountsResponse.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of GetAccountingPaymentTypesAvailableAccountsResponse-objects as value to a dart map
  static Map<String, List<GetAccountingPaymentTypesAvailableAccountsResponse>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<GetAccountingPaymentTypesAvailableAccountsResponse>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = GetAccountingPaymentTypesAvailableAccountsResponse.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'items',
    'estadisticas',
  };
}

