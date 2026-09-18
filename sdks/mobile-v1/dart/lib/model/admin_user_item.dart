//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class AdminUserItem {
  /// Returns a new [AdminUserItem] instance.
  AdminUserItem({
    required this.userId,
    required this.name,
    required this.email,
    required this.role,
    required this.isActive,
    this.onboardingType,
    this.onboardingStatus,
    this.createdAt,
    this.expiresAt,
    this.lockedUntil,
    this.avatar,
    this.tenantRole,
    this.tenantId,
    this.tenantName,
    this.membershipId,
    this.membershipCount,
    this.salesAgentProfile,
    this.salesAgentBalance,
    this.activeReferralCount,
  });

  String userId;

  String name;

  String email;

  String role;

  bool isActive;

  String? onboardingType;

  String? onboardingStatus;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  DateTime? createdAt;

  DateTime? expiresAt;

  DateTime? lockedUntil;

  String? avatar;

  String? tenantRole;

  String? tenantId;

  String? tenantName;

  String? membershipId;

  /// Minimum value: 0
  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  int? membershipCount;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  AdminUserItemSalesAgentProfile? salesAgentProfile;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  AdminUserItemSalesAgentBalance? salesAgentBalance;

  /// Minimum value: 0
  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  int? activeReferralCount;

  @override
  bool operator ==(Object other) => identical(this, other) || other is AdminUserItem &&
    other.userId == userId &&
    other.name == name &&
    other.email == email &&
    other.role == role &&
    other.isActive == isActive &&
    other.onboardingType == onboardingType &&
    other.onboardingStatus == onboardingStatus &&
    other.createdAt == createdAt &&
    other.expiresAt == expiresAt &&
    other.lockedUntil == lockedUntil &&
    other.avatar == avatar &&
    other.tenantRole == tenantRole &&
    other.tenantId == tenantId &&
    other.tenantName == tenantName &&
    other.membershipId == membershipId &&
    other.membershipCount == membershipCount &&
    other.salesAgentProfile == salesAgentProfile &&
    other.salesAgentBalance == salesAgentBalance &&
    other.activeReferralCount == activeReferralCount;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (userId.hashCode) +
    (name.hashCode) +
    (email.hashCode) +
    (role.hashCode) +
    (isActive.hashCode) +
    (onboardingType == null ? 0 : onboardingType!.hashCode) +
    (onboardingStatus == null ? 0 : onboardingStatus!.hashCode) +
    (createdAt == null ? 0 : createdAt!.hashCode) +
    (expiresAt == null ? 0 : expiresAt!.hashCode) +
    (lockedUntil == null ? 0 : lockedUntil!.hashCode) +
    (avatar == null ? 0 : avatar!.hashCode) +
    (tenantRole == null ? 0 : tenantRole!.hashCode) +
    (tenantId == null ? 0 : tenantId!.hashCode) +
    (tenantName == null ? 0 : tenantName!.hashCode) +
    (membershipId == null ? 0 : membershipId!.hashCode) +
    (membershipCount == null ? 0 : membershipCount!.hashCode) +
    (salesAgentProfile == null ? 0 : salesAgentProfile!.hashCode) +
    (salesAgentBalance == null ? 0 : salesAgentBalance!.hashCode) +
    (activeReferralCount == null ? 0 : activeReferralCount!.hashCode);

  @override
  String toString() => 'AdminUserItem[userId=$userId, name=$name, email=$email, role=$role, isActive=$isActive, onboardingType=$onboardingType, onboardingStatus=$onboardingStatus, createdAt=$createdAt, expiresAt=$expiresAt, lockedUntil=$lockedUntil, avatar=$avatar, tenantRole=$tenantRole, tenantId=$tenantId, tenantName=$tenantName, membershipId=$membershipId, membershipCount=$membershipCount, salesAgentProfile=$salesAgentProfile, salesAgentBalance=$salesAgentBalance, activeReferralCount=$activeReferralCount]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'userId'] = this.userId;
      json[r'name'] = this.name;
      json[r'email'] = this.email;
      json[r'role'] = this.role;
      json[r'isActive'] = this.isActive;
    if (this.onboardingType != null) {
      json[r'onboardingType'] = this.onboardingType;
    } else {
      json[r'onboardingType'] = null;
    }
    if (this.onboardingStatus != null) {
      json[r'onboardingStatus'] = this.onboardingStatus;
    } else {
      json[r'onboardingStatus'] = null;
    }
    if (this.createdAt != null) {
      json[r'createdAt'] = this.createdAt!.toUtc().toIso8601String();
    } else {
      json[r'createdAt'] = null;
    }
    if (this.expiresAt != null) {
      json[r'expiresAt'] = this.expiresAt!.toUtc().toIso8601String();
    } else {
      json[r'expiresAt'] = null;
    }
    if (this.lockedUntil != null) {
      json[r'lockedUntil'] = this.lockedUntil!.toUtc().toIso8601String();
    } else {
      json[r'lockedUntil'] = null;
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
    if (this.tenantId != null) {
      json[r'tenantId'] = this.tenantId;
    } else {
      json[r'tenantId'] = null;
    }
    if (this.tenantName != null) {
      json[r'tenantName'] = this.tenantName;
    } else {
      json[r'tenantName'] = null;
    }
    if (this.membershipId != null) {
      json[r'membershipId'] = this.membershipId;
    } else {
      json[r'membershipId'] = null;
    }
    if (this.membershipCount != null) {
      json[r'membershipCount'] = this.membershipCount;
    } else {
      json[r'membershipCount'] = null;
    }
    if (this.salesAgentProfile != null) {
      json[r'salesAgentProfile'] = this.salesAgentProfile;
    } else {
      json[r'salesAgentProfile'] = null;
    }
    if (this.salesAgentBalance != null) {
      json[r'salesAgentBalance'] = this.salesAgentBalance;
    } else {
      json[r'salesAgentBalance'] = null;
    }
    if (this.activeReferralCount != null) {
      json[r'activeReferralCount'] = this.activeReferralCount;
    } else {
      json[r'activeReferralCount'] = null;
    }
    return json;
  }

  /// Returns a new [AdminUserItem] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static AdminUserItem? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "AdminUserItem[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "AdminUserItem[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return AdminUserItem(
        userId: mapValueOfType<String>(json, r'userId')!,
        name: mapValueOfType<String>(json, r'name')!,
        email: mapValueOfType<String>(json, r'email')!,
        role: mapValueOfType<String>(json, r'role')!,
        isActive: mapValueOfType<bool>(json, r'isActive')!,
        onboardingType: mapValueOfType<String>(json, r'onboardingType'),
        onboardingStatus: mapValueOfType<String>(json, r'onboardingStatus'),
        createdAt: mapDateTime(json, r'createdAt', r''),
        expiresAt: mapDateTime(json, r'expiresAt', r''),
        lockedUntil: mapDateTime(json, r'lockedUntil', r''),
        avatar: mapValueOfType<String>(json, r'avatar'),
        tenantRole: mapValueOfType<String>(json, r'tenantRole'),
        tenantId: mapValueOfType<String>(json, r'tenantId'),
        tenantName: mapValueOfType<String>(json, r'tenantName'),
        membershipId: mapValueOfType<String>(json, r'membershipId'),
        membershipCount: mapValueOfType<int>(json, r'membershipCount'),
        salesAgentProfile: AdminUserItemSalesAgentProfile.fromJson(json[r'salesAgentProfile']),
        salesAgentBalance: AdminUserItemSalesAgentBalance.fromJson(json[r'salesAgentBalance']),
        activeReferralCount: mapValueOfType<int>(json, r'activeReferralCount'),
      );
    }
    return null;
  }

  static List<AdminUserItem> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <AdminUserItem>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = AdminUserItem.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, AdminUserItem> mapFromJson(dynamic json) {
    final map = <String, AdminUserItem>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = AdminUserItem.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of AdminUserItem-objects as value to a dart map
  static Map<String, List<AdminUserItem>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<AdminUserItem>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = AdminUserItem.listFromJson(entry.value, growable: growable,);
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

