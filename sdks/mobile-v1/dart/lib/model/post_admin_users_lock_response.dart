//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class PostAdminUsersLockResponse {
  /// Returns a new [PostAdminUsersLockResponse] instance.
  PostAdminUsersLockResponse({
    required this.user,
    required this.message,
  });

  PostAdminUsersLockResponseUser user;

  String message;

  @override
  bool operator ==(Object other) => identical(this, other) || other is PostAdminUsersLockResponse &&
    other.user == user &&
    other.message == message;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (user.hashCode) +
    (message.hashCode);

  @override
  String toString() => 'PostAdminUsersLockResponse[user=$user, message=$message]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'user'] = this.user;
      json[r'message'] = this.message;
    return json;
  }

  /// Returns a new [PostAdminUsersLockResponse] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static PostAdminUsersLockResponse? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "PostAdminUsersLockResponse[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "PostAdminUsersLockResponse[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return PostAdminUsersLockResponse(
        user: PostAdminUsersLockResponseUser.fromJson(json[r'user'])!,
        message: mapValueOfType<String>(json, r'message')!,
      );
    }
    return null;
  }

  static List<PostAdminUsersLockResponse> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <PostAdminUsersLockResponse>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = PostAdminUsersLockResponse.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, PostAdminUsersLockResponse> mapFromJson(dynamic json) {
    final map = <String, PostAdminUsersLockResponse>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = PostAdminUsersLockResponse.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of PostAdminUsersLockResponse-objects as value to a dart map
  static Map<String, List<PostAdminUsersLockResponse>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<PostAdminUsersLockResponse>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = PostAdminUsersLockResponse.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'user',
    'message',
  };
}

