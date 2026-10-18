//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class AdminTenantUserItem {
  /// Returns a new [AdminTenantUserItem] instance.
  AdminTenantUserItem({
    required this.userId,
    required this.name,
    required this.email,
    this.role,
    this.isActive,
    this.avatar,
    this.tenantRole,
    this.membershipId,
    this.membershipActive,
  });

  String userId;

  String name;

  String email;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? role;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  bool? isActive;

  String? avatar;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? tenantRole;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? membershipId;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  bool? membershipActive;

  @override
  bool operator ==(Object other) => identical(this, other) || other is AdminTenantUserItem &&
    other.userId == userId &&
    other.name == name &&
    other.email == email &&
    other.role == role &&
    other.isActive == isActive &&
    other.avatar == avatar &&
    other.tenantRole == tenantRole &&
    other.membershipId == membershipId &&
    other.membershipActive == membershipActive;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (userId.hashCode) +
    (name.hashCode) +
    (email.hashCode) +
    (role == null ? 0 : role!.hashCode) +
    (isActive == null ? 0 : isActive!.hashCode) +
    (avatar == null ? 0 : avatar!.hashCode) +
    (tenantRole == null ? 0 : tenantRole!.hashCode) +
    (membershipId == null ? 0 : membershipId!.hashCode) +
    (membershipActive == null ? 0 : membershipActive!.hashCode);

  @override
  String toString() => 'AdminTenantUserItem[userId=$userId, name=$name, email=$email, role=$role, isActive=$isActive, avatar=$avatar, tenantRole=$tenantRole, membershipId=$membershipId, membershipActive=$membershipActive]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'userId'] = this.userId;
      json[r'name'] = this.name;
      json[r'email'] = this.email;
    if (this.role != null) {
      json[r'role'] = this.role;
    } else {
      json[r'role'] = null;
    }
    if (this.isActive != null) {
      json[r'isActive'] = this.isActive;
    } else {
      json[r'isActive'] = null;
    }
    if (this.avatar != null) {
      json[r'avatar'] = this.avatar;
    } else {
      json[r'avatar'] = null;
    }
    if (this.tenantRole != null) {
      json[r'tenantRole'] = this.tenantRole;
    } else {
      json[r'tenantRole'] = null;
    }
    if (this.membershipId != null) {
      json[r'membershipId'] = this.membershipId;
    } else {
      json[r'membershipId'] = null;
    }
    if (this.membershipActive != null) {
      json[r'membershipActive'] = this.membershipActive;
    } else {
      json[r'membershipActive'] = null;
    }
    return json;
  }

  /// Returns a new [AdminTenantUserItem] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static AdminTenantUserItem? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "AdminTenantUserItem[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "AdminTenantUserItem[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return AdminTenantUserItem(
        userId: mapValueOfType<String>(json, r'userId')!,
        name: mapValueOfType<String>(json, r'name')!,
        email: mapValueOfType<String>(json, r'email')!,
        role: mapValueOfType<String>(json, r'role'),
        isActive: mapValueOfType<bool>(json, r'isActive'),
        avatar: mapValueOfType<String>(json, r'avatar'),
        tenantRole: mapValueOfType<String>(json, r'tenantRole'),
        membershipId: mapValueOfType<String>(json, r'membershipId'),
        membershipActive: mapValueOfType<bool>(json, r'membershipActive'),
      );
    }
    return null;
  }

  static List<AdminTenantUserItem> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <AdminTenantUserItem>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = AdminTenantUserItem.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, AdminTenantUserItem> mapFromJson(dynamic json) {
    final map = <String, AdminTenantUserItem>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = AdminTenantUserItem.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of AdminTenantUserItem-objects as value to a dart map
  static Map<String, List<AdminTenantUserItem>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<AdminTenantUserItem>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = AdminTenantUserItem.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'userId',
    'name',
    'email',
  };
}

