//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class ChangeAdminUserTenantRoleRequest {
  /// Returns a new [ChangeAdminUserTenantRoleRequest] instance.
  ChangeAdminUserTenantRoleRequest({
    required this.userId,
    required this.tenantId,
    required this.tenantRole,
  });

  String userId;

  String tenantId;

  ChangeAdminUserTenantRoleRequestTenantRoleEnum tenantRole;

  @override
  bool operator ==(Object other) => identical(this, other) || other is ChangeAdminUserTenantRoleRequest &&
    other.userId == userId &&
    other.tenantId == tenantId &&
    other.tenantRole == tenantRole;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (userId.hashCode) +
    (tenantId.hashCode) +
    (tenantRole.hashCode);

  @override
  String toString() => 'ChangeAdminUserTenantRoleRequest[userId=$userId, tenantId=$tenantId, tenantRole=$tenantRole]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'userId'] = this.userId;
      json[r'tenantId'] = this.tenantId;
      json[r'tenantRole'] = this.tenantRole;
    return json;
  }

  /// Returns a new [ChangeAdminUserTenantRoleRequest] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static ChangeAdminUserTenantRoleRequest? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "ChangeAdminUserTenantRoleRequest[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "ChangeAdminUserTenantRoleRequest[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return ChangeAdminUserTenantRoleRequest(
        userId: mapValueOfType<String>(json, r'userId')!,
        tenantId: mapValueOfType<String>(json, r'tenantId')!,
        tenantRole: ChangeAdminUserTenantRoleRequestTenantRoleEnum.fromJson(json[r'tenantRole'])!,
      );
    }
    return null;
  }

  static List<ChangeAdminUserTenantRoleRequest> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <ChangeAdminUserTenantRoleRequest>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = ChangeAdminUserTenantRoleRequest.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, ChangeAdminUserTenantRoleRequest> mapFromJson(dynamic json) {
    final map = <String, ChangeAdminUserTenantRoleRequest>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = ChangeAdminUserTenantRoleRequest.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of ChangeAdminUserTenantRoleRequest-objects as value to a dart map
  static Map<String, List<ChangeAdminUserTenantRoleRequest>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<ChangeAdminUserTenantRoleRequest>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = ChangeAdminUserTenantRoleRequest.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'userId',
    'tenantId',
    'tenantRole',
  };
}


class ChangeAdminUserTenantRoleRequestTenantRoleEnum {
  /// Instantiate a new enum with the provided [value].
  const ChangeAdminUserTenantRoleRequestTenantRoleEnum._(this.value);

  /// The underlying value of this enum member.
  final String value;

  @override
  String toString() => value;

  String toJson() => value;

  static const manager = ChangeAdminUserTenantRoleRequestTenantRoleEnum._(r'manager');
  static const economico = ChangeAdminUserTenantRoleRequestTenantRoleEnum._(r'economico');
  static const dependiente = ChangeAdminUserTenantRoleRequestTenantRoleEnum._(r'dependiente');

  /// List of all possible values in this [enum][ChangeAdminUserTenantRoleRequestTenantRoleEnum].
  static const values = <ChangeAdminUserTenantRoleRequestTenantRoleEnum>[
    manager,
    economico,
    dependiente,
  ];

  static ChangeAdminUserTenantRoleRequestTenantRoleEnum? fromJson(dynamic value) => ChangeAdminUserTenantRoleRequestTenantRoleEnumTypeTransformer().decode(value);

  static List<ChangeAdminUserTenantRoleRequestTenantRoleEnum> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <ChangeAdminUserTenantRoleRequestTenantRoleEnum>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = ChangeAdminUserTenantRoleRequestTenantRoleEnum.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }
}

/// Transformation class that can [encode] an instance of [ChangeAdminUserTenantRoleRequestTenantRoleEnum] to String,
/// and [decode] dynamic data back to [ChangeAdminUserTenantRoleRequestTenantRoleEnum].
class ChangeAdminUserTenantRoleRequestTenantRoleEnumTypeTransformer {
  factory ChangeAdminUserTenantRoleRequestTenantRoleEnumTypeTransformer() => _instance ??= const ChangeAdminUserTenantRoleRequestTenantRoleEnumTypeTransformer._();

  const ChangeAdminUserTenantRoleRequestTenantRoleEnumTypeTransformer._();

  String encode(ChangeAdminUserTenantRoleRequestTenantRoleEnum data) => data.value;

  /// Decodes a [dynamic value][data] to a ChangeAdminUserTenantRoleRequestTenantRoleEnum.
  ///
  /// If [allowNull] is true and the [dynamic value][data] cannot be decoded successfully,
  /// then null is returned. However, if [allowNull] is false and the [dynamic value][data]
  /// cannot be decoded successfully, then an [UnimplementedError] is thrown.
  ///
  /// The [allowNull] is very handy when an API changes and a new enum value is added or removed,
  /// and users are still using an old app with the old code.
  ChangeAdminUserTenantRoleRequestTenantRoleEnum? decode(dynamic data, {bool allowNull = true}) {
    if (data != null) {
      switch (data) {
        case r'manager': return ChangeAdminUserTenantRoleRequestTenantRoleEnum.manager;
        case r'economico': return ChangeAdminUserTenantRoleRequestTenantRoleEnum.economico;
        case r'dependiente': return ChangeAdminUserTenantRoleRequestTenantRoleEnum.dependiente;
        default:
          if (!allowNull) {
            throw ArgumentError('Unknown enum value to decode: $data');
          }
      }
    }
    return null;
  }

  /// Singleton [ChangeAdminUserTenantRoleRequestTenantRoleEnumTypeTransformer] instance.
  static ChangeAdminUserTenantRoleRequestTenantRoleEnumTypeTransformer? _instance;
}


