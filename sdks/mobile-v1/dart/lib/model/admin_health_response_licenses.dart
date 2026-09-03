//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class AdminHealthResponseLicenses {
  /// Returns a new [AdminHealthResponseLicenses] instance.
  AdminHealthResponseLicenses({
    required this.total,
    required this.active,
    required this.expiringSoon,
  });

  /// Minimum value: 0
  int total;

  /// Minimum value: 0
  int active;

  /// Minimum value: 0
  int expiringSoon;

  @override
  bool operator ==(Object other) => identical(this, other) || other is AdminHealthResponseLicenses &&
    other.total == total &&
    other.active == active &&
    other.expiringSoon == expiringSoon;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (total.hashCode) +
    (active.hashCode) +
    (expiringSoon.hashCode);

  @override
  String toString() => 'AdminHealthResponseLicenses[total=$total, active=$active, expiringSoon=$expiringSoon]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'total'] = this.total;
      json[r'active'] = this.active;
      json[r'expiringSoon'] = this.expiringSoon;
    return json;
  }

  /// Returns a new [AdminHealthResponseLicenses] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static AdminHealthResponseLicenses? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "AdminHealthResponseLicenses[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "AdminHealthResponseLicenses[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return AdminHealthResponseLicenses(
        total: mapValueOfType<int>(json, r'total')!,
        active: mapValueOfType<int>(json, r'active')!,
        expiringSoon: mapValueOfType<int>(json, r'expiringSoon')!,
      );
    }
    return null;
  }

  static List<AdminHealthResponseLicenses> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <AdminHealthResponseLicenses>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = AdminHealthResponseLicenses.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, AdminHealthResponseLicenses> mapFromJson(dynamic json) {
    final map = <String, AdminHealthResponseLicenses>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = AdminHealthResponseLicenses.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of AdminHealthResponseLicenses-objects as value to a dart map
  static Map<String, List<AdminHealthResponseLicenses>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<AdminHealthResponseLicenses>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = AdminHealthResponseLicenses.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'total',
    'active',
    'expiringSoon',
  };
}

