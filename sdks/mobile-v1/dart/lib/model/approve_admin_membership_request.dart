//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class ApproveAdminMembershipRequest {
  /// Returns a new [ApproveAdminMembershipRequest] instance.
  ApproveAdminMembershipRequest({
    required this.membershipId,
    required this.tenantRole,
  });

  String membershipId;

  ApproveAdminMembershipRequestTenantRoleEnum tenantRole;

  @override
  bool operator ==(Object other) => identical(this, other) || other is ApproveAdminMembershipRequest &&
    other.membershipId == membershipId &&
    other.tenantRole == tenantRole;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (membershipId.hashCode) +
    (tenantRole.hashCode);

  @override
  String toString() => 'ApproveAdminMembershipRequest[membershipId=$membershipId, tenantRole=$tenantRole]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'membershipId'] = this.membershipId;
      json[r'tenantRole'] = this.tenantRole;
    return json;
  }

  /// Returns a new [ApproveAdminMembershipRequest] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static ApproveAdminMembershipRequest? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "ApproveAdminMembershipRequest[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "ApproveAdminMembershipRequest[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return ApproveAdminMembershipRequest(
        membershipId: mapValueOfType<String>(json, r'membershipId')!,
        tenantRole: ApproveAdminMembershipRequestTenantRoleEnum.fromJson(json[r'tenantRole'])!,
      );
    }
    return null;
  }

  static List<ApproveAdminMembershipRequest> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <ApproveAdminMembershipRequest>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = ApproveAdminMembershipRequest.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, ApproveAdminMembershipRequest> mapFromJson(dynamic json) {
    final map = <String, ApproveAdminMembershipRequest>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = ApproveAdminMembershipRequest.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of ApproveAdminMembershipRequest-objects as value to a dart map
  static Map<String, List<ApproveAdminMembershipRequest>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<ApproveAdminMembershipRequest>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = ApproveAdminMembershipRequest.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'membershipId',
    'tenantRole',
  };
}


class ApproveAdminMembershipRequestTenantRoleEnum {
  /// Instantiate a new enum with the provided [value].
  const ApproveAdminMembershipRequestTenantRoleEnum._(this.value);

  /// The underlying value of this enum member.
  final String value;

  @override
  String toString() => value;

  String toJson() => value;

  static const manager = ApproveAdminMembershipRequestTenantRoleEnum._(r'manager');
  static const economico = ApproveAdminMembershipRequestTenantRoleEnum._(r'economico');
  static const dependiente = ApproveAdminMembershipRequestTenantRoleEnum._(r'dependiente');
  static const admin = ApproveAdminMembershipRequestTenantRoleEnum._(r'admin');

  /// List of all possible values in this [enum][ApproveAdminMembershipRequestTenantRoleEnum].
  static const values = <ApproveAdminMembershipRequestTenantRoleEnum>[
    manager,
    economico,
    dependiente,
    admin,
  ];

  static ApproveAdminMembershipRequestTenantRoleEnum? fromJson(dynamic value) => ApproveAdminMembershipRequestTenantRoleEnumTypeTransformer().decode(value);

  static List<ApproveAdminMembershipRequestTenantRoleEnum> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <ApproveAdminMembershipRequestTenantRoleEnum>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = ApproveAdminMembershipRequestTenantRoleEnum.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }
}

/// Transformation class that can [encode] an instance of [ApproveAdminMembershipRequestTenantRoleEnum] to String,
/// and [decode] dynamic data back to [ApproveAdminMembershipRequestTenantRoleEnum].
class ApproveAdminMembershipRequestTenantRoleEnumTypeTransformer {
  factory ApproveAdminMembershipRequestTenantRoleEnumTypeTransformer() => _instance ??= const ApproveAdminMembershipRequestTenantRoleEnumTypeTransformer._();

  const ApproveAdminMembershipRequestTenantRoleEnumTypeTransformer._();

  String encode(ApproveAdminMembershipRequestTenantRoleEnum data) => data.value;

  /// Decodes a [dynamic value][data] to a ApproveAdminMembershipRequestTenantRoleEnum.
  ///
  /// If [allowNull] is true and the [dynamic value][data] cannot be decoded successfully,
  /// then null is returned. However, if [allowNull] is false and the [dynamic value][data]
  /// cannot be decoded successfully, then an [UnimplementedError] is thrown.
  ///
  /// The [allowNull] is very handy when an API changes and a new enum value is added or removed,
  /// and users are still using an old app with the old code.
  ApproveAdminMembershipRequestTenantRoleEnum? decode(dynamic data, {bool allowNull = true}) {
    if (data != null) {
      switch (data) {
        case r'manager': return ApproveAdminMembershipRequestTenantRoleEnum.manager;
        case r'economico': return ApproveAdminMembershipRequestTenantRoleEnum.economico;
        case r'dependiente': return ApproveAdminMembershipRequestTenantRoleEnum.dependiente;
        case r'admin': return ApproveAdminMembershipRequestTenantRoleEnum.admin;
        default:
          if (!allowNull) {
            throw ArgumentError('Unknown enum value to decode: $data');
          }
      }
    }
    return null;
  }

  /// Singleton [ApproveAdminMembershipRequestTenantRoleEnumTypeTransformer] instance.
  static ApproveAdminMembershipRequestTenantRoleEnumTypeTransformer? _instance;
}


