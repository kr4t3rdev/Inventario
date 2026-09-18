//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class AuthenticatedUser {
  /// Returns a new [AuthenticatedUser] instance.
  AuthenticatedUser({
    required this.userId,
    this.name,
    required this.email,
    this.role,
    this.tenantId,
    this.tenantRole,
  });

  String userId;

  String? name;

  String email;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? role;

  String? tenantId;

  String? tenantRole;

  @override
  bool operator ==(Object other) => identical(this, other) || other is AuthenticatedUser &&
    other.userId == userId &&
    other.name == name &&
    other.email == email &&
    other.role == role &&
    other.tenantId == tenantId &&
    other.tenantRole == tenantRole;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (userId.hashCode) +
    (name == null ? 0 : name!.hashCode) +
    (email.hashCode) +
    (role == null ? 0 : role!.hashCode) +
    (tenantId == null ? 0 : tenantId!.hashCode) +
    (tenantRole == null ? 0 : tenantRole!.hashCode);

  @override
  String toString() => 'AuthenticatedUser[userId=$userId, name=$name, email=$email, role=$role, tenantId=$tenantId, tenantRole=$tenantRole]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'userId'] = this.userId;
    if (this.name != null) {
      json[r'name'] = this.name;
    } else {
      json[r'name'] = null;
    }
      json[r'email'] = this.email;
    if (this.role != null) {
      json[r'role'] = this.role;
    } else {
      json[r'role'] = null;
    }
    if (this.tenantId != null) {
      json[r'tenantId'] = this.tenantId;
    } else {
      json[r'tenantId'] = null;
    }
    if (this.tenantRole != null) {
      json[r'tenantRole'] = this.tenantRole;
    } else {
      json[r'tenantRole'] = null;
    }
    return json;
  }

  /// Returns a new [AuthenticatedUser] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static AuthenticatedUser? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "AuthenticatedUser[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "AuthenticatedUser[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return AuthenticatedUser(
        userId: mapValueOfType<String>(json, r'userId')!,
        name: mapValueOfType<String>(json, r'name'),
        email: mapValueOfType<String>(json, r'email')!,
        role: mapValueOfType<String>(json, r'role'),
        tenantId: mapValueOfType<String>(json, r'tenantId'),
        tenantRole: mapValueOfType<String>(json, r'tenantRole'),
      );
    }
    return null;
  }

  static List<AuthenticatedUser> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <AuthenticatedUser>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = AuthenticatedUser.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, AuthenticatedUser> mapFromJson(dynamic json) {
    final map = <String, AuthenticatedUser>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = AuthenticatedUser.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of AuthenticatedUser-objects as value to a dart map
  static Map<String, List<AuthenticatedUser>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<AuthenticatedUser>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = AuthenticatedUser.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'userId',
    'email',
  };
}

