//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class UpdateAdminUserRequest {
  /// Returns a new [UpdateAdminUserRequest] instance.
  UpdateAdminUserRequest({
    required this.userId,
    this.name,
    this.email,
    this.role,
  });

  String userId;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? name;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? email;

  UpdateAdminUserRequestRoleEnum? role;

  @override
  bool operator ==(Object other) => identical(this, other) || other is UpdateAdminUserRequest &&
    other.userId == userId &&
    other.name == name &&
    other.email == email &&
    other.role == role;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (userId.hashCode) +
    (name == null ? 0 : name!.hashCode) +
    (email == null ? 0 : email!.hashCode) +
    (role == null ? 0 : role!.hashCode);

  @override
  String toString() => 'UpdateAdminUserRequest[userId=$userId, name=$name, email=$email, role=$role]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'userId'] = this.userId;
    if (this.name != null) {
      json[r'name'] = this.name;
    } else {
      json[r'name'] = null;
    }
    if (this.email != null) {
      json[r'email'] = this.email;
    } else {
      json[r'email'] = null;
    }
    if (this.role != null) {
      json[r'role'] = this.role;
    } else {
      json[r'role'] = null;
    }
    return json;
  }

  /// Returns a new [UpdateAdminUserRequest] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static UpdateAdminUserRequest? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "UpdateAdminUserRequest[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "UpdateAdminUserRequest[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return UpdateAdminUserRequest(
        userId: mapValueOfType<String>(json, r'userId')!,
        name: mapValueOfType<String>(json, r'name'),
        email: mapValueOfType<String>(json, r'email'),
        role: UpdateAdminUserRequestRoleEnum.fromJson(json[r'role']),
      );
    }
    return null;
  }

  static List<UpdateAdminUserRequest> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <UpdateAdminUserRequest>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = UpdateAdminUserRequest.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, UpdateAdminUserRequest> mapFromJson(dynamic json) {
    final map = <String, UpdateAdminUserRequest>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = UpdateAdminUserRequest.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of UpdateAdminUserRequest-objects as value to a dart map
  static Map<String, List<UpdateAdminUserRequest>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<UpdateAdminUserRequest>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = UpdateAdminUserRequest.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'userId',
  };
}


class UpdateAdminUserRequestRoleEnum {
  /// Instantiate a new enum with the provided [value].
  const UpdateAdminUserRequestRoleEnum._(this.value);

  /// The underlying value of this enum member.
  final String value;

  @override
  String toString() => value;

  String toJson() => value;

  static const admin = UpdateAdminUserRequestRoleEnum._(r'admin');
  static const regularUser = UpdateAdminUserRequestRoleEnum._(r'regularUser');
  static const salesAgent = UpdateAdminUserRequestRoleEnum._(r'salesAgent');

  /// List of all possible values in this [enum][UpdateAdminUserRequestRoleEnum].
  static const values = <UpdateAdminUserRequestRoleEnum>[
    admin,
    regularUser,
    salesAgent,
  ];

  static UpdateAdminUserRequestRoleEnum? fromJson(dynamic value) => UpdateAdminUserRequestRoleEnumTypeTransformer().decode(value);

  static List<UpdateAdminUserRequestRoleEnum> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <UpdateAdminUserRequestRoleEnum>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = UpdateAdminUserRequestRoleEnum.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }
}

/// Transformation class that can [encode] an instance of [UpdateAdminUserRequestRoleEnum] to String,
/// and [decode] dynamic data back to [UpdateAdminUserRequestRoleEnum].
class UpdateAdminUserRequestRoleEnumTypeTransformer {
  factory UpdateAdminUserRequestRoleEnumTypeTransformer() => _instance ??= const UpdateAdminUserRequestRoleEnumTypeTransformer._();

  const UpdateAdminUserRequestRoleEnumTypeTransformer._();

  String encode(UpdateAdminUserRequestRoleEnum data) => data.value;

  /// Decodes a [dynamic value][data] to a UpdateAdminUserRequestRoleEnum.
  ///
  /// If [allowNull] is true and the [dynamic value][data] cannot be decoded successfully,
  /// then null is returned. However, if [allowNull] is false and the [dynamic value][data]
  /// cannot be decoded successfully, then an [UnimplementedError] is thrown.
  ///
  /// The [allowNull] is very handy when an API changes and a new enum value is added or removed,
  /// and users are still using an old app with the old code.
  UpdateAdminUserRequestRoleEnum? decode(dynamic data, {bool allowNull = true}) {
    if (data != null) {
      switch (data) {
        case r'admin': return UpdateAdminUserRequestRoleEnum.admin;
        case r'regularUser': return UpdateAdminUserRequestRoleEnum.regularUser;
        case r'salesAgent': return UpdateAdminUserRequestRoleEnum.salesAgent;
        default:
          if (!allowNull) {
            throw ArgumentError('Unknown enum value to decode: $data');
          }
      }
    }
    return null;
  }

  /// Singleton [UpdateAdminUserRequestRoleEnumTypeTransformer] instance.
  static UpdateAdminUserRequestRoleEnumTypeTransformer? _instance;
}
