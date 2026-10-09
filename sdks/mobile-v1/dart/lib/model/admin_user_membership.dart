//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class AdminUserMembership {
  /// Returns a new [AdminUserMembership] instance.
  AdminUserMembership({
    required this.membershipId,
    required this.tenantId,
    required this.tenantRole,
    required this.isActive,
    this.tenant,
  });

  String membershipId;

  String tenantId;

  String tenantRole;

  bool isActive;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  AdminUserMembershipTenant? tenant;

  @override
  bool operator ==(Object other) => identical(this, other) || other is AdminUserMembership &&
    other.membershipId == membershipId &&
    other.tenantId == tenantId &&
    other.tenantRole == tenantRole &&
    other.isActive == isActive &&
    other.tenant == tenant;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (membershipId.hashCode) +
    (tenantId.hashCode) +
    (tenantRole.hashCode) +
    (isActive.hashCode) +
    (tenant == null ? 0 : tenant!.hashCode);

  @override
  String toString() => 'AdminUserMembership[membershipId=$membershipId, tenantId=$tenantId, tenantRole=$tenantRole, isActive=$isActive, tenant=$tenant]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'membershipId'] = this.membershipId;
      json[r'tenantId'] = this.tenantId;
      json[r'tenantRole'] = this.tenantRole;
      json[r'isActive'] = this.isActive;
    if (this.tenant != null) {
      json[r'tenant'] = this.tenant;
    } else {
      json[r'tenant'] = null;
    }
    return json;
  }

  /// Returns a new [AdminUserMembership] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static AdminUserMembership? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "AdminUserMembership[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "AdminUserMembership[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return AdminUserMembership(
        membershipId: mapValueOfType<String>(json, r'membershipId')!,
        tenantId: mapValueOfType<String>(json, r'tenantId')!,
        tenantRole: mapValueOfType<String>(json, r'tenantRole')!,
        isActive: mapValueOfType<bool>(json, r'isActive')!,
        tenant: AdminUserMembershipTenant.fromJson(json[r'tenant']),
      );
    }
    return null;
  }

  static List<AdminUserMembership> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <AdminUserMembership>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = AdminUserMembership.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, AdminUserMembership> mapFromJson(dynamic json) {
    final map = <String, AdminUserMembership>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = AdminUserMembership.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of AdminUserMembership-objects as value to a dart map
  static Map<String, List<AdminUserMembership>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<AdminUserMembership>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = AdminUserMembership.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'membershipId',
    'tenantId',
    'tenantRole',
    'isActive',
  };
}

