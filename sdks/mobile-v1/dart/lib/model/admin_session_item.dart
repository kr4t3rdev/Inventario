//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class AdminSessionItem {
  /// Returns a new [AdminSessionItem] instance.
  AdminSessionItem({
    required this.id,
    required this.userId,
    this.ipAddress,
    this.userAgent,
    this.isActive,
    this.expiresAt,
    this.createdAt,
    this.lastActive,
    this.user,
  });

  String id;

  String userId;

  String? ipAddress;

  String? userAgent;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  bool? isActive;

  DateTime? expiresAt;

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
  DateTime? lastActive;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  AdminSessionItemUser? user;

  @override
  bool operator ==(Object other) => identical(this, other) || other is AdminSessionItem &&
    other.id == id &&
    other.userId == userId &&
    other.ipAddress == ipAddress &&
    other.userAgent == userAgent &&
    other.isActive == isActive &&
    other.expiresAt == expiresAt &&
    other.createdAt == createdAt &&
    other.lastActive == lastActive &&
    other.user == user;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (id.hashCode) +
    (userId.hashCode) +
    (ipAddress == null ? 0 : ipAddress!.hashCode) +
    (userAgent == null ? 0 : userAgent!.hashCode) +
    (isActive == null ? 0 : isActive!.hashCode) +
    (expiresAt == null ? 0 : expiresAt!.hashCode) +
    (createdAt == null ? 0 : createdAt!.hashCode) +
    (lastActive == null ? 0 : lastActive!.hashCode) +
    (user == null ? 0 : user!.hashCode);

  @override
  String toString() => 'AdminSessionItem[id=$id, userId=$userId, ipAddress=$ipAddress, userAgent=$userAgent, isActive=$isActive, expiresAt=$expiresAt, createdAt=$createdAt, lastActive=$lastActive, user=$user]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'id'] = this.id;
      json[r'userId'] = this.userId;
    if (this.ipAddress != null) {
      json[r'ipAddress'] = this.ipAddress;
    } else {
      json[r'ipAddress'] = null;
    }
    if (this.userAgent != null) {
      json[r'userAgent'] = this.userAgent;
    } else {
      json[r'userAgent'] = null;
    }
    if (this.isActive != null) {
      json[r'isActive'] = this.isActive;
    } else {
      json[r'isActive'] = null;
    }
    if (this.expiresAt != null) {
      json[r'expiresAt'] = this.expiresAt!.toUtc().toIso8601String();
    } else {
      json[r'expiresAt'] = null;
    }
    if (this.createdAt != null) {
      json[r'createdAt'] = this.createdAt!.toUtc().toIso8601String();
    } else {
      json[r'createdAt'] = null;
    }
    if (this.lastActive != null) {
      json[r'lastActive'] = this.lastActive!.toUtc().toIso8601String();
    } else {
      json[r'lastActive'] = null;
    }
    if (this.user != null) {
      json[r'user'] = this.user;
    } else {
      json[r'user'] = null;
    }
    return json;
  }

  /// Returns a new [AdminSessionItem] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static AdminSessionItem? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "AdminSessionItem[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "AdminSessionItem[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return AdminSessionItem(
        id: mapValueOfType<String>(json, r'id')!,
        userId: mapValueOfType<String>(json, r'userId')!,
        ipAddress: mapValueOfType<String>(json, r'ipAddress'),
        userAgent: mapValueOfType<String>(json, r'userAgent'),
        isActive: mapValueOfType<bool>(json, r'isActive'),
        expiresAt: mapDateTime(json, r'expiresAt', r''),
        createdAt: mapDateTime(json, r'createdAt', r''),
        lastActive: mapDateTime(json, r'lastActive', r''),
        user: AdminSessionItemUser.fromJson(json[r'user']),
      );
    }
    return null;
  }

  static List<AdminSessionItem> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <AdminSessionItem>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = AdminSessionItem.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, AdminSessionItem> mapFromJson(dynamic json) {
    final map = <String, AdminSessionItem>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = AdminSessionItem.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of AdminSessionItem-objects as value to a dart map
  static Map<String, List<AdminSessionItem>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<AdminSessionItem>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = AdminSessionItem.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'id',
    'userId',
  };
}

