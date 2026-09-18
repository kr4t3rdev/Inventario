//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class AdminHealthResponseUsersComparison {
  /// Returns a new [AdminHealthResponseUsersComparison] instance.
  AdminHealthResponseUsersComparison({
    required this.current7DaysUsers,
    required this.previous7DaysUsers,
  });

  /// Minimum value: 0
  int current7DaysUsers;

  /// Minimum value: 0
  int previous7DaysUsers;

  @override
  bool operator ==(Object other) => identical(this, other) || other is AdminHealthResponseUsersComparison &&
    other.current7DaysUsers == current7DaysUsers &&
    other.previous7DaysUsers == previous7DaysUsers;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (current7DaysUsers.hashCode) +
    (previous7DaysUsers.hashCode);

  @override
  String toString() => 'AdminHealthResponseUsersComparison[current7DaysUsers=$current7DaysUsers, previous7DaysUsers=$previous7DaysUsers]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'current7DaysUsers'] = this.current7DaysUsers;
      json[r'previous7DaysUsers'] = this.previous7DaysUsers;
    return json;
  }

  /// Returns a new [AdminHealthResponseUsersComparison] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static AdminHealthResponseUsersComparison? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "AdminHealthResponseUsersComparison[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "AdminHealthResponseUsersComparison[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return AdminHealthResponseUsersComparison(
        current7DaysUsers: mapValueOfType<int>(json, r'current7DaysUsers')!,
        previous7DaysUsers: mapValueOfType<int>(json, r'previous7DaysUsers')!,
      );
    }
    return null;
  }

  static List<AdminHealthResponseUsersComparison> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <AdminHealthResponseUsersComparison>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = AdminHealthResponseUsersComparison.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, AdminHealthResponseUsersComparison> mapFromJson(dynamic json) {
    final map = <String, AdminHealthResponseUsersComparison>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = AdminHealthResponseUsersComparison.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of AdminHealthResponseUsersComparison-objects as value to a dart map
  static Map<String, List<AdminHealthResponseUsersComparison>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<AdminHealthResponseUsersComparison>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = AdminHealthResponseUsersComparison.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'current7DaysUsers',
    'previous7DaysUsers',
  };
}

