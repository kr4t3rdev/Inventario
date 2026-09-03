//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class PostAdminUsersLockResponseUser {
  /// Returns a new [PostAdminUsersLockResponseUser] instance.
  PostAdminUsersLockResponseUser({
    required this.userId,
    this.lockedUntil,
    this.loginAttempts,
  });

  String userId;

  DateTime? lockedUntil;

  /// Minimum value: 0
  int? loginAttempts;

  @override
  bool operator ==(Object other) => identical(this, other) || other is PostAdminUsersLockResponseUser &&
    other.userId == userId &&
    other.lockedUntil == lockedUntil &&
    other.loginAttempts == loginAttempts;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (userId.hashCode) +
    (lockedUntil == null ? 0 : lockedUntil!.hashCode) +
    (loginAttempts == null ? 0 : loginAttempts!.hashCode);

  @override
  String toString() => 'PostAdminUsersLockResponseUser[userId=$userId, lockedUntil=$lockedUntil, loginAttempts=$loginAttempts]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'userId'] = this.userId;
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

  /// Returns a new [PostAdminUsersLockResponseUser] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static PostAdminUsersLockResponseUser? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "PostAdminUsersLockResponseUser[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "PostAdminUsersLockResponseUser[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return PostAdminUsersLockResponseUser(
        userId: mapValueOfType<String>(json, r'userId')!,
        lockedUntil: mapDateTime(json, r'lockedUntil', r''),
        loginAttempts: mapValueOfType<int>(json, r'loginAttempts'),
      );
    }
    return null;
  }

  static List<PostAdminUsersLockResponseUser> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <PostAdminUsersLockResponseUser>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = PostAdminUsersLockResponseUser.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, PostAdminUsersLockResponseUser> mapFromJson(dynamic json) {
    final map = <String, PostAdminUsersLockResponseUser>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = PostAdminUsersLockResponseUser.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of PostAdminUsersLockResponseUser-objects as value to a dart map
  static Map<String, List<PostAdminUsersLockResponseUser>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<PostAdminUsersLockResponseUser>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = PostAdminUsersLockResponseUser.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'userId',
  };
}

