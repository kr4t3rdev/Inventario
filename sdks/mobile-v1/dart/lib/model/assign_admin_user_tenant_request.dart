//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class AssignAdminUserTenantRequest {
  /// Returns a new [AssignAdminUserTenantRequest] instance.
  AssignAdminUserTenantRequest({
    required this.userId,
    required this.tenantId,
    required this.tenantRole,
    this.deactivateOthers,
  });

  String userId;

  String tenantId;

  AssignAdminUserTenantRequestTenantRoleEnum tenantRole;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  bool? deactivateOthers;

  @override
  bool operator ==(Object other) => identical(this, other) || other is AssignAdminUserTenantRequest &&
    other.userId == userId &&
    other.tenantId == tenantId &&
    other.tenantRole == tenantRole &&
    other.deactivateOthers == deactivateOthers;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (userId.hashCode) +
    (tenantId.hashCode) +
    (tenantRole.hashCode) +
    (deactivateOthers == null ? 0 : deactivateOthers!.hashCode);

  @override
  String toString() => 'AssignAdminUserTenantRequest[userId=$userId, tenantId=$tenantId, tenantRole=$tenantRole, deactivateOthers=$deactivateOthers]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'userId'] = this.userId;
      json[r'tenantId'] = this.tenantId;
      json[r'tenantRole'] = this.tenantRole;
    if (this.deactivateOthers != null) {
      json[r'deactivateOthers'] = this.deactivateOthers;
    } else {
      json[r'deactivateOthers'] = null;
    }
    return json;
  }

  /// Returns a new [AssignAdminUserTenantRequest] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static AssignAdminUserTenantRequest? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "AssignAdminUserTenantRequest[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "AssignAdminUserTenantRequest[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return AssignAdminUserTenantRequest(
        userId: mapValueOfType<String>(json, r'userId')!,
        tenantId: mapValueOfType<String>(json, r'tenantId')!,
        tenantRole: AssignAdminUserTenantRequestTenantRoleEnum.fromJson(json[r'tenantRole'])!,
        deactivateOthers: mapValueOfType<bool>(json, r'deactivateOthers'),
      );
    }
    return null;
  }

  static List<AssignAdminUserTenantRequest> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <AssignAdminUserTenantRequest>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = AssignAdminUserTenantRequest.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, AssignAdminUserTenantRequest> mapFromJson(dynamic json) {
    final map = <String, AssignAdminUserTenantRequest>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = AssignAdminUserTenantRequest.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of AssignAdminUserTenantRequest-objects as value to a dart map
  static Map<String, List<AssignAdminUserTenantRequest>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<AssignAdminUserTenantRequest>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = AssignAdminUserTenantRequest.listFromJson(entry.value, growable: growable,);
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


class AssignAdminUserTenantRequestTenantRoleEnum {
  /// Instantiate a new enum with the provided [value].
  const AssignAdminUserTenantRequestTenantRoleEnum._(this.value);

  /// The underlying value of this enum member.
  final String value;

  @override
  String toString() => value;

  String toJson() => value;

  static const manager = AssignAdminUserTenantRequestTenantRoleEnum._(r'manager');
  static const economico = AssignAdminUserTenantRequestTenantRoleEnum._(r'economico');
  static const dependiente = AssignAdminUserTenantRequestTenantRoleEnum._(r'dependiente');

  /// List of all possible values in this [enum][AssignAdminUserTenantRequestTenantRoleEnum].
  static const values = <AssignAdminUserTenantRequestTenantRoleEnum>[
    manager,
    economico,
    dependiente,
  ];

  static AssignAdminUserTenantRequestTenantRoleEnum? fromJson(dynamic value) => AssignAdminUserTenantRequestTenantRoleEnumTypeTransformer().decode(value);

  static List<AssignAdminUserTenantRequestTenantRoleEnum> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <AssignAdminUserTenantRequestTenantRoleEnum>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = AssignAdminUserTenantRequestTenantRoleEnum.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }
}

/// Transformation class that can [encode] an instance of [AssignAdminUserTenantRequestTenantRoleEnum] to String,
/// and [decode] dynamic data back to [AssignAdminUserTenantRequestTenantRoleEnum].
class AssignAdminUserTenantRequestTenantRoleEnumTypeTransformer {
  factory AssignAdminUserTenantRequestTenantRoleEnumTypeTransformer() => _instance ??= const AssignAdminUserTenantRequestTenantRoleEnumTypeTransformer._();

  const AssignAdminUserTenantRequestTenantRoleEnumTypeTransformer._();

  String encode(AssignAdminUserTenantRequestTenantRoleEnum data) => data.value;

  /// Decodes a [dynamic value][data] to a AssignAdminUserTenantRequestTenantRoleEnum.
  ///
  /// If [allowNull] is true and the [dynamic value][data] cannot be decoded successfully,
  /// then null is returned. However, if [allowNull] is false and the [dynamic value][data]
  /// cannot be decoded successfully, then an [UnimplementedError] is thrown.
  ///
  /// The [allowNull] is very handy when an API changes and a new enum value is added or removed,
  /// and users are still using an old app with the old code.
  AssignAdminUserTenantRequestTenantRoleEnum? decode(dynamic data, {bool allowNull = true}) {
    if (data != null) {
      switch (data) {
        case r'manager': return AssignAdminUserTenantRequestTenantRoleEnum.manager;
        case r'economico': return AssignAdminUserTenantRequestTenantRoleEnum.economico;
        case r'dependiente': return AssignAdminUserTenantRequestTenantRoleEnum.dependiente;
        default:
          if (!allowNull) {
            throw ArgumentError('Unknown enum value to decode: $data');
          }
      }
    }
    return null;
  }

  /// Singleton [AssignAdminUserTenantRequestTenantRoleEnumTypeTransformer] instance.
  static AssignAdminUserTenantRequestTenantRoleEnumTypeTransformer? _instance;
}
