//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class PostAdminUsersVerifyEmailResponseUser {
  /// Returns a new [PostAdminUsersVerifyEmailResponseUser] instance.
  PostAdminUsersVerifyEmailResponseUser({
    required this.userId,
    required this.email,
    this.emailVerifiedAt,
  });

  String userId;

  String email;

  DateTime? emailVerifiedAt;

  @override
  bool operator ==(Object other) => identical(this, other) || other is PostAdminUsersVerifyEmailResponseUser &&
    other.userId == userId &&
    other.email == email &&
    other.emailVerifiedAt == emailVerifiedAt;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (userId.hashCode) +
    (email.hashCode) +
    (emailVerifiedAt == null ? 0 : emailVerifiedAt!.hashCode);

  @override
  String toString() => 'PostAdminUsersVerifyEmailResponseUser[userId=$userId, email=$email, emailVerifiedAt=$emailVerifiedAt]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'userId'] = this.userId;
      json[r'email'] = this.email;
    if (this.emailVerifiedAt != null) {
      json[r'emailVerifiedAt'] = this.emailVerifiedAt!.toUtc().toIso8601String();
    } else {
      json[r'emailVerifiedAt'] = null;
    }
    return json;
  }

  /// Returns a new [PostAdminUsersVerifyEmailResponseUser] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static PostAdminUsersVerifyEmailResponseUser? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "PostAdminUsersVerifyEmailResponseUser[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "PostAdminUsersVerifyEmailResponseUser[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return PostAdminUsersVerifyEmailResponseUser(
        userId: mapValueOfType<String>(json, r'userId')!,
        email: mapValueOfType<String>(json, r'email')!,
        emailVerifiedAt: mapDateTime(json, r'emailVerifiedAt', r''),
      );
    }
    return null;
  }

  static List<PostAdminUsersVerifyEmailResponseUser> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <PostAdminUsersVerifyEmailResponseUser>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = PostAdminUsersVerifyEmailResponseUser.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, PostAdminUsersVerifyEmailResponseUser> mapFromJson(dynamic json) {
    final map = <String, PostAdminUsersVerifyEmailResponseUser>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = PostAdminUsersVerifyEmailResponseUser.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of PostAdminUsersVerifyEmailResponseUser-objects as value to a dart map
  static Map<String, List<PostAdminUsersVerifyEmailResponseUser>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<PostAdminUsersVerifyEmailResponseUser>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = PostAdminUsersVerifyEmailResponseUser.listFromJson(entry.value, growable: growable,);
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
