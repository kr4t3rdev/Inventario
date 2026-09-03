//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class AdminUserItemSalesAgentBalance {
  /// Returns a new [AdminUserItemSalesAgentBalance] instance.
  AdminUserItemSalesAgentBalance({
    required this.availableUsd,
    required this.paidUsd,
  });

  num availableUsd;

  num paidUsd;

  @override
  bool operator ==(Object other) => identical(this, other) || other is AdminUserItemSalesAgentBalance &&
    other.availableUsd == availableUsd &&
    other.paidUsd == paidUsd;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (availableUsd.hashCode) +
    (paidUsd.hashCode);

  @override
  String toString() => 'AdminUserItemSalesAgentBalance[availableUsd=$availableUsd, paidUsd=$paidUsd]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'availableUsd'] = this.availableUsd;
      json[r'paidUsd'] = this.paidUsd;
    return json;
  }

  /// Returns a new [AdminUserItemSalesAgentBalance] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static AdminUserItemSalesAgentBalance? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "AdminUserItemSalesAgentBalance[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "AdminUserItemSalesAgentBalance[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return AdminUserItemSalesAgentBalance(
        availableUsd: num.parse('${json[r'availableUsd']}'),
        paidUsd: num.parse('${json[r'paidUsd']}'),
      );
    }
    return null;
  }

  static List<AdminUserItemSalesAgentBalance> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <AdminUserItemSalesAgentBalance>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = AdminUserItemSalesAgentBalance.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, AdminUserItemSalesAgentBalance> mapFromJson(dynamic json) {
    final map = <String, AdminUserItemSalesAgentBalance>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = AdminUserItemSalesAgentBalance.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of AdminUserItemSalesAgentBalance-objects as value to a dart map
  static Map<String, List<AdminUserItemSalesAgentBalance>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<AdminUserItemSalesAgentBalance>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = AdminUserItemSalesAgentBalance.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'availableUsd',
    'paidUsd',
  };
}

