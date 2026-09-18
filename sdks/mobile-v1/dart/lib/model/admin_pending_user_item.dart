//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class AdminPendingUserItem {
  /// Returns a new [AdminPendingUserItem] instance.
  AdminPendingUserItem({
    required this.userId,
    required this.name,
    required this.email,
    this.onboardingType,
    this.onboardingStatus,
    this.createdAt,
  });

  String userId;

  String name;

  String email;

  String? onboardingType;

  String? onboardingStatus;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  DateTime? createdAt;

  @override
  bool operator ==(Object other) => identical(this, other) || other is AdminPendingUserItem &&
    other.userId == userId &&
    other.name == name &&
    other.email == email &&
    other.onboardingType == onboardingType &&
    other.onboardingStatus == onboardingStatus &&
    other.createdAt == createdAt;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (userId.hashCode) +
    (name.hashCode) +
    (email.hashCode) +
    (onboardingType == null ? 0 : onboardingType!.hashCode) +
    (onboardingStatus == null ? 0 : onboardingStatus!.hashCode) +
    (createdAt == null ? 0 : createdAt!.hashCode);

  @override
  String toString() => 'AdminPendingUserItem[userId=$userId, name=$name, email=$email, onboardingType=$onboardingType, onboardingStatus=$onboardingStatus, createdAt=$createdAt]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'userId'] = this.userId;
      json[r'name'] = this.name;
      json[r'email'] = this.email;
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
    return json;
  }

  /// Returns a new [AdminPendingUserItem] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static AdminPendingUserItem? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "AdminPendingUserItem[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "AdminPendingUserItem[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return AdminPendingUserItem(
        userId: mapValueOfType<String>(json, r'userId')!,
        name: mapValueOfType<String>(json, r'name')!,
        email: mapValueOfType<String>(json, r'email')!,
        onboardingType: mapValueOfType<String>(json, r'onboardingType'),
        onboardingStatus: mapValueOfType<String>(json, r'onboardingStatus'),
        createdAt: mapDateTime(json, r'createdAt', r''),
      );
    }
    return null;
  }

  static List<AdminPendingUserItem> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <AdminPendingUserItem>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = AdminPendingUserItem.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, AdminPendingUserItem> mapFromJson(dynamic json) {
    final map = <String, AdminPendingUserItem>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = AdminPendingUserItem.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of AdminPendingUserItem-objects as value to a dart map
  static Map<String, List<AdminPendingUserItem>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<AdminPendingUserItem>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = AdminPendingUserItem.listFromJson(entry.value, growable: growable,);
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

