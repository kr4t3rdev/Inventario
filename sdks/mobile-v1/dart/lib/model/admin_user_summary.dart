//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class AdminUserSummary {
  /// Returns a new [AdminUserSummary] instance.
  AdminUserSummary({
    required this.userId,
    required this.name,
    required this.email,
    required this.role,
    required this.isActive,
    this.lockedUntil,
    this.loginAttempts,
  });

  String userId;

  String name;

  String email;

  String role;

  bool isActive;

  DateTime? lockedUntil;

  /// Minimum value: 0
  int? loginAttempts;

  @override
  bool operator ==(Object other) => identical(this, other) || other is AdminUserSummary &&
    other.userId == userId &&
    other.name == name &&
    other.email == email &&
    other.role == role &&
    other.isActive == isActive &&
    other.lockedUntil == lockedUntil &&
    other.loginAttempts == loginAttempts;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (userId.hashCode) +
    (name.hashCode) +
    (email.hashCode) +
    (role.hashCode) +
    (isActive.hashCode) +
    (lockedUntil == null ? 0 : lockedUntil!.hashCode) +
    (loginAttempts == null ? 0 : loginAttempts!.hashCode);

  @override
  String toString() => 'AdminUserSummary[userId=$userId, name=$name, email=$email, role=$role, isActive=$isActive, lockedUntil=$lockedUntil, loginAttempts=$loginAttempts]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'userId'] = this.userId;
      json[r'name'] = this.name;
      json[r'email'] = this.email;
      json[r'role'] = this.role;
      json[r'isActive'] = this.isActive;
    if (this.lockedUntil != null) {
      json[r'lockedUntil'] = this.lockedUntil!.toUtc().toIso8601String();
    } else {
      json[r'lockedUntil'] = null;
    }
    if (this.loginAttempts != null) {
      json[r'loginAttempts'] = this.loginAttempts;
    } else {
      json[r'loginAttempts'] = null;
    }
    return json;
  }

  /// Returns a new [AdminUserSummary] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static AdminUserSummary? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "AdminUserSummary[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "AdminUserSummary[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return AdminUserSummary(
        userId: mapValueOfType<String>(json, r'userId')!,
        name: mapValueOfType<String>(json, r'name')!,
        email: mapValueOfType<String>(json, r'email')!,
        role: mapValueOfType<String>(json, r'role')!,
        isActive: mapValueOfType<bool>(json, r'isActive')!,
        lockedUntil: mapDateTime(json, r'lockedUntil', r''),
        loginAttempts: mapValueOfType<int>(json, r'loginAttempts'),
      );
    }
    return null;
  }

  static List<AdminUserSummary> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <AdminUserSummary>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = AdminUserSummary.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, AdminUserSummary> mapFromJson(dynamic json) {
    final map = <String, AdminUserSummary>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = AdminUserSummary.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of AdminUserSummary-objects as value to a dart map
  static Map<String, List<AdminUserSummary>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<AdminUserSummary>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = AdminUserSummary.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'userId',
    'name',
    'email',
    'role',
    'isActive',
  };
}
