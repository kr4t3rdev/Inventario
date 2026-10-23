//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class AdminUserDetail {
  /// Returns a new [AdminUserDetail] instance.
  AdminUserDetail({
    required this.userId,
    required this.name,
    required this.email,
    required this.role,
    required this.isActive,
    this.onboardingType,
    this.onboardingStatus,
    this.emailVerifiedAt,
    this.createdAt,
    this.updatedAt,
    this.activatedAt,
    this.expiresAt,
    this.avatar,
    this.lockedUntil,
    required this.loginAttempts,
    this.lastFailedLogin,
    this.memberships = const [],
    required this.activeSessions,
  });

  String userId;

  String name;

  String email;

  String role;

  bool isActive;

  String? onboardingType;

  String? onboardingStatus;

  DateTime? emailVerifiedAt;

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
  DateTime? updatedAt;

  DateTime? activatedAt;

  DateTime? expiresAt;

  String? avatar;

  DateTime? lockedUntil;

  /// Minimum value: 0
  int loginAttempts;

  DateTime? lastFailedLogin;

  List<AdminUserMembership> memberships;

  /// Minimum value: 0
  int activeSessions;

  @override
  bool operator ==(Object other) => identical(this, other) || other is AdminUserDetail &&
    other.userId == userId &&
    other.name == name &&
    other.email == email &&
    other.role == role &&
    other.isActive == isActive &&
    other.onboardingType == onboardingType &&
    other.onboardingStatus == onboardingStatus &&
    other.emailVerifiedAt == emailVerifiedAt &&
    other.createdAt == createdAt &&
    other.updatedAt == updatedAt &&
    other.activatedAt == activatedAt &&
    other.expiresAt == expiresAt &&
    other.avatar == avatar &&
    other.lockedUntil == lockedUntil &&
    other.loginAttempts == loginAttempts &&
    other.lastFailedLogin == lastFailedLogin &&
    _deepEquality.equals(other.memberships, memberships) &&
    other.activeSessions == activeSessions;

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
    (emailVerifiedAt == null ? 0 : emailVerifiedAt!.hashCode) +
    (createdAt == null ? 0 : createdAt!.hashCode) +
    (updatedAt == null ? 0 : updatedAt!.hashCode) +
    (activatedAt == null ? 0 : activatedAt!.hashCode) +
    (expiresAt == null ? 0 : expiresAt!.hashCode) +
    (avatar == null ? 0 : avatar!.hashCode) +
    (lockedUntil == null ? 0 : lockedUntil!.hashCode) +
    (loginAttempts.hashCode) +
    (lastFailedLogin == null ? 0 : lastFailedLogin!.hashCode) +
    (memberships.hashCode) +
    (activeSessions.hashCode);

  @override
  String toString() => 'AdminUserDetail[userId=$userId, name=$name, email=$email, role=$role, isActive=$isActive, onboardingType=$onboardingType, onboardingStatus=$onboardingStatus, emailVerifiedAt=$emailVerifiedAt, createdAt=$createdAt, updatedAt=$updatedAt, activatedAt=$activatedAt, expiresAt=$expiresAt, avatar=$avatar, lockedUntil=$lockedUntil, loginAttempts=$loginAttempts, lastFailedLogin=$lastFailedLogin, memberships=$memberships, activeSessions=$activeSessions]';

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
    if (this.emailVerifiedAt != null) {
      json[r'emailVerifiedAt'] = this.emailVerifiedAt!.toUtc().toIso8601String();
    } else {
      json[r'emailVerifiedAt'] = null;
    }
    if (this.createdAt != null) {
      json[r'createdAt'] = this.createdAt!.toUtc().toIso8601String();
    } else {
      json[r'createdAt'] = null;
    }
    if (this.updatedAt != null) {
      json[r'updatedAt'] = this.updatedAt!.toUtc().toIso8601String();
    } else {
      json[r'updatedAt'] = null;
    }
    if (this.activatedAt != null) {
      json[r'activatedAt'] = this.activatedAt!.toUtc().toIso8601String();
    } else {
      json[r'activatedAt'] = null;
    }
    if (this.expiresAt != null) {
      json[r'expiresAt'] = this.expiresAt!.toUtc().toIso8601String();
    } else {
      json[r'expiresAt'] = null;
    }
    if (this.avatar != null) {
      json[r'avatar'] = this.avatar;
    } else {
      json[r'avatar'] = null;
    }
    if (this.lockedUntil != null) {
      json[r'lockedUntil'] = this.lockedUntil!.toUtc().toIso8601String();
    } else {
      json[r'lockedUntil'] = null;
    }
      json[r'loginAttempts'] = this.loginAttempts;
    if (this.lastFailedLogin != null) {
      json[r'lastFailedLogin'] = this.lastFailedLogin!.toUtc().toIso8601String();
    } else {
      json[r'lastFailedLogin'] = null;
    }
      json[r'memberships'] = this.memberships;
      json[r'activeSessions'] = this.activeSessions;
    return json;
  }

  /// Returns a new [AdminUserDetail] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static AdminUserDetail? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "AdminUserDetail[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "AdminUserDetail[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return AdminUserDetail(
        userId: mapValueOfType<String>(json, r'userId')!,
        name: mapValueOfType<String>(json, r'name')!,
        email: mapValueOfType<String>(json, r'email')!,
        role: mapValueOfType<String>(json, r'role')!,
        isActive: mapValueOfType<bool>(json, r'isActive')!,
        onboardingType: mapValueOfType<String>(json, r'onboardingType'),
        onboardingStatus: mapValueOfType<String>(json, r'onboardingStatus'),
        emailVerifiedAt: mapDateTime(json, r'emailVerifiedAt', r''),
        createdAt: mapDateTime(json, r'createdAt', r''),
        updatedAt: mapDateTime(json, r'updatedAt', r''),
        activatedAt: mapDateTime(json, r'activatedAt', r''),
        expiresAt: mapDateTime(json, r'expiresAt', r''),
        avatar: mapValueOfType<String>(json, r'avatar'),
        lockedUntil: mapDateTime(json, r'lockedUntil', r''),
        loginAttempts: mapValueOfType<int>(json, r'loginAttempts')!,
        lastFailedLogin: mapDateTime(json, r'lastFailedLogin', r''),
        memberships: AdminUserMembership.listFromJson(json[r'memberships']),
        activeSessions: mapValueOfType<int>(json, r'activeSessions')!,
      );
    }
    return null;
  }

  static List<AdminUserDetail> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <AdminUserDetail>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = AdminUserDetail.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, AdminUserDetail> mapFromJson(dynamic json) {
    final map = <String, AdminUserDetail>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = AdminUserDetail.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of AdminUserDetail-objects as value to a dart map
  static Map<String, List<AdminUserDetail>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<AdminUserDetail>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = AdminUserDetail.listFromJson(entry.value, growable: growable,);
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
    'loginAttempts',
    'activeSessions',
  };
}
