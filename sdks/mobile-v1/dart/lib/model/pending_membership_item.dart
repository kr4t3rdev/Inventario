//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class PendingMembershipItem {
  /// Returns a new [PendingMembershipItem] instance.
  PendingMembershipItem({
    required this.membershipId,
    required this.tenantId,
    required this.userId,
    this.isActive,
    this.tenantRole,
    this.createdAt,
    this.user,
    this.tenant,
  });

  String membershipId;

  String tenantId;

  String userId;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  bool? isActive;

  String? tenantRole;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  DateTime? createdAt;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  AdminPendingUserItem? user;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  AdminTenantLite? tenant;

  @override
  bool operator ==(Object other) => identical(this, other) || other is PendingMembershipItem &&
    other.membershipId == membershipId &&
    other.tenantId == tenantId &&
    other.userId == userId &&
    other.isActive == isActive &&
    other.tenantRole == tenantRole &&
    other.createdAt == createdAt &&
    other.user == user &&
    other.tenant == tenant;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (membershipId.hashCode) +
    (tenantId.hashCode) +
    (userId.hashCode) +
    (isActive == null ? 0 : isActive!.hashCode) +
    (tenantRole == null ? 0 : tenantRole!.hashCode) +
    (createdAt == null ? 0 : createdAt!.hashCode) +
    (user == null ? 0 : user!.hashCode) +
    (tenant == null ? 0 : tenant!.hashCode);

  @override
  String toString() => 'PendingMembershipItem[membershipId=$membershipId, tenantId=$tenantId, userId=$userId, isActive=$isActive, tenantRole=$tenantRole, createdAt=$createdAt, user=$user, tenant=$tenant]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'membershipId'] = this.membershipId;
      json[r'tenantId'] = this.tenantId;
      json[r'userId'] = this.userId;
    if (this.isActive != null) {
      json[r'isActive'] = this.isActive;
    } else {
      json[r'isActive'] = null;
    }
    if (this.tenantRole != null) {
      json[r'tenantRole'] = this.tenantRole;
    } else {
      json[r'tenantRole'] = null;
    }
    if (this.createdAt != null) {
      json[r'createdAt'] = this.createdAt!.toUtc().toIso8601String();
    } else {
      json[r'createdAt'] = null;
    }
    if (this.user != null) {
      json[r'user'] = this.user;
    } else {
      json[r'user'] = null;
    }
    if (this.tenant != null) {
      json[r'tenant'] = this.tenant;
    } else {
      json[r'tenant'] = null;
    }
    return json;
  }

  /// Returns a new [PendingMembershipItem] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static PendingMembershipItem? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "PendingMembershipItem[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "PendingMembershipItem[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return PendingMembershipItem(
        membershipId: mapValueOfType<String>(json, r'membershipId')!,
        tenantId: mapValueOfType<String>(json, r'tenantId')!,
        userId: mapValueOfType<String>(json, r'userId')!,
        isActive: mapValueOfType<bool>(json, r'isActive'),
        tenantRole: mapValueOfType<String>(json, r'tenantRole'),
        createdAt: mapDateTime(json, r'createdAt', r''),
        user: AdminPendingUserItem.fromJson(json[r'user']),
        tenant: AdminTenantLite.fromJson(json[r'tenant']),
      );
    }
    return null;
  }

  static List<PendingMembershipItem> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <PendingMembershipItem>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = PendingMembershipItem.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, PendingMembershipItem> mapFromJson(dynamic json) {
    final map = <String, PendingMembershipItem>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = PendingMembershipItem.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of PendingMembershipItem-objects as value to a dart map
  static Map<String, List<PendingMembershipItem>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<PendingMembershipItem>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = PendingMembershipItem.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'membershipId',
    'tenantId',
    'userId',
  };
}

