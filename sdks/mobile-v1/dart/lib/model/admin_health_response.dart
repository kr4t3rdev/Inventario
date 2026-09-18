//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class AdminHealthResponse {
  /// Returns a new [AdminHealthResponse] instance.
  AdminHealthResponse({
    required this.users,
    required this.tenants,
    required this.sessions,
    required this.licenses,
    this.usersTrend = const [],
    required this.usersComparison,
  });

  AdminHealthResponseUsers users;

  AdminHealthResponseTenants tenants;

  AdminHealthResponseSessions sessions;

  AdminHealthResponseLicenses licenses;

  List<AdminHealthResponseUsersTrendInner> usersTrend;

  AdminHealthResponseUsersComparison usersComparison;

  @override
  bool operator ==(Object other) => identical(this, other) || other is AdminHealthResponse &&
    other.users == users &&
    other.tenants == tenants &&
    other.sessions == sessions &&
    other.licenses == licenses &&
    _deepEquality.equals(other.usersTrend, usersTrend) &&
    other.usersComparison == usersComparison;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (users.hashCode) +
    (tenants.hashCode) +
    (sessions.hashCode) +
    (licenses.hashCode) +
    (usersTrend.hashCode) +
    (usersComparison.hashCode);

  @override
  String toString() => 'AdminHealthResponse[users=$users, tenants=$tenants, sessions=$sessions, licenses=$licenses, usersTrend=$usersTrend, usersComparison=$usersComparison]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'users'] = this.users;
      json[r'tenants'] = this.tenants;
      json[r'sessions'] = this.sessions;
      json[r'licenses'] = this.licenses;
      json[r'usersTrend'] = this.usersTrend;
      json[r'usersComparison'] = this.usersComparison;
    return json;
  }

  /// Returns a new [AdminHealthResponse] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static AdminHealthResponse? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "AdminHealthResponse[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "AdminHealthResponse[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return AdminHealthResponse(
        users: AdminHealthResponseUsers.fromJson(json[r'users'])!,
        tenants: AdminHealthResponseTenants.fromJson(json[r'tenants'])!,
        sessions: AdminHealthResponseSessions.fromJson(json[r'sessions'])!,
        licenses: AdminHealthResponseLicenses.fromJson(json[r'licenses'])!,
        usersTrend: AdminHealthResponseUsersTrendInner.listFromJson(json[r'usersTrend']),
        usersComparison: AdminHealthResponseUsersComparison.fromJson(json[r'usersComparison'])!,
      );
    }
    return null;
  }

  static List<AdminHealthResponse> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <AdminHealthResponse>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = AdminHealthResponse.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, AdminHealthResponse> mapFromJson(dynamic json) {
    final map = <String, AdminHealthResponse>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = AdminHealthResponse.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of AdminHealthResponse-objects as value to a dart map
  static Map<String, List<AdminHealthResponse>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<AdminHealthResponse>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = AdminHealthResponse.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'users',
    'tenants',
    'sessions',
    'licenses',
    'usersTrend',
    'usersComparison',
  };
}

