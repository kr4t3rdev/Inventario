//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class AssignAdminTenantLicenseRequest {
  /// Returns a new [AssignAdminTenantLicenseRequest] instance.
  AssignAdminTenantLicenseRequest({
    required this.tenantId,
    required this.planId,
    this.durationDays,
    this.inicio,
    this.expiracion,
    this.activa,
  });

  String tenantId;

  String planId;

  /// Minimum value: 1
  /// Maximum value: 3650
  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  int? durationDays;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  DateTime? inicio;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  DateTime? expiracion;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  bool? activa;

  @override
  bool operator ==(Object other) => identical(this, other) || other is AssignAdminTenantLicenseRequest &&
    other.tenantId == tenantId &&
    other.planId == planId &&
    other.durationDays == durationDays &&
    other.inicio == inicio &&
    other.expiracion == expiracion &&
    other.activa == activa;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (tenantId.hashCode) +
    (planId.hashCode) +
    (durationDays == null ? 0 : durationDays!.hashCode) +
    (inicio == null ? 0 : inicio!.hashCode) +
    (expiracion == null ? 0 : expiracion!.hashCode) +
    (activa == null ? 0 : activa!.hashCode);

  @override
  String toString() => 'AssignAdminTenantLicenseRequest[tenantId=$tenantId, planId=$planId, durationDays=$durationDays, inicio=$inicio, expiracion=$expiracion, activa=$activa]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'tenantId'] = this.tenantId;
      json[r'planId'] = this.planId;
    if (this.durationDays != null) {
      json[r'durationDays'] = this.durationDays;
    } else {
      json[r'durationDays'] = null;
    }
    if (this.inicio != null) {
      json[r'inicio'] = this.inicio!.toUtc().toIso8601String();
    } else {
      json[r'inicio'] = null;
    }
    if (this.expiracion != null) {
      json[r'expiracion'] = this.expiracion!.toUtc().toIso8601String();
    } else {
      json[r'expiracion'] = null;
    }
    if (this.activa != null) {
      json[r'activa'] = this.activa;
    } else {
      json[r'activa'] = null;
    }
    return json;
  }

  /// Returns a new [AssignAdminTenantLicenseRequest] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static AssignAdminTenantLicenseRequest? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "AssignAdminTenantLicenseRequest[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "AssignAdminTenantLicenseRequest[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return AssignAdminTenantLicenseRequest(
        tenantId: mapValueOfType<String>(json, r'tenantId')!,
        planId: mapValueOfType<String>(json, r'planId')!,
        durationDays: mapValueOfType<int>(json, r'durationDays'),
        inicio: mapDateTime(json, r'inicio', r''),
        expiracion: mapDateTime(json, r'expiracion', r''),
        activa: mapValueOfType<bool>(json, r'activa'),
      );
    }
    return null;
  }

  static List<AssignAdminTenantLicenseRequest> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <AssignAdminTenantLicenseRequest>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = AssignAdminTenantLicenseRequest.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, AssignAdminTenantLicenseRequest> mapFromJson(dynamic json) {
    final map = <String, AssignAdminTenantLicenseRequest>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = AssignAdminTenantLicenseRequest.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of AssignAdminTenantLicenseRequest-objects as value to a dart map
  static Map<String, List<AssignAdminTenantLicenseRequest>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<AssignAdminTenantLicenseRequest>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = AssignAdminTenantLicenseRequest.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'tenantId',
    'planId',
  };
}

