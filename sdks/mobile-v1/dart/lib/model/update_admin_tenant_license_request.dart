//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class UpdateAdminTenantLicenseRequest {
  /// Returns a new [UpdateAdminTenantLicenseRequest] instance.
  UpdateAdminTenantLicenseRequest({
    required this.tenantLicenseId,
    this.planId,
    this.expiracion,
    this.activa,
    this.isAdminTest,
    this.maxUsuarios,
    this.maxAlmacenes,
    this.maxProductos,
    this.maxClientes,
  });

  String tenantLicenseId;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? planId;

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

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  bool? isAdminTest;

  /// Minimum value: 1
  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  int? maxUsuarios;

  /// Minimum value: 1
  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  int? maxAlmacenes;

  /// Minimum value: 1
  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  int? maxProductos;

  /// Minimum value: 1
  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  int? maxClientes;

  @override
  bool operator ==(Object other) => identical(this, other) || other is UpdateAdminTenantLicenseRequest &&
    other.tenantLicenseId == tenantLicenseId &&
    other.planId == planId &&
    other.expiracion == expiracion &&
    other.activa == activa &&
    other.isAdminTest == isAdminTest &&
    other.maxUsuarios == maxUsuarios &&
    other.maxAlmacenes == maxAlmacenes &&
    other.maxProductos == maxProductos &&
    other.maxClientes == maxClientes;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (tenantLicenseId.hashCode) +
    (planId == null ? 0 : planId!.hashCode) +
    (expiracion == null ? 0 : expiracion!.hashCode) +
    (activa == null ? 0 : activa!.hashCode) +
    (isAdminTest == null ? 0 : isAdminTest!.hashCode) +
    (maxUsuarios == null ? 0 : maxUsuarios!.hashCode) +
    (maxAlmacenes == null ? 0 : maxAlmacenes!.hashCode) +
    (maxProductos == null ? 0 : maxProductos!.hashCode) +
    (maxClientes == null ? 0 : maxClientes!.hashCode);

  @override
  String toString() => 'UpdateAdminTenantLicenseRequest[tenantLicenseId=$tenantLicenseId, planId=$planId, expiracion=$expiracion, activa=$activa, isAdminTest=$isAdminTest, maxUsuarios=$maxUsuarios, maxAlmacenes=$maxAlmacenes, maxProductos=$maxProductos, maxClientes=$maxClientes]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'tenantLicenseId'] = this.tenantLicenseId;
    if (this.planId != null) {
      json[r'planId'] = this.planId;
    } else {
      json[r'planId'] = null;
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
    if (this.isAdminTest != null) {
      json[r'isAdminTest'] = this.isAdminTest;
    } else {
      json[r'isAdminTest'] = null;
    }
    if (this.maxUsuarios != null) {
      json[r'maxUsuarios'] = this.maxUsuarios;
    } else {
      json[r'maxUsuarios'] = null;
    }
    if (this.maxAlmacenes != null) {
      json[r'maxAlmacenes'] = this.maxAlmacenes;
    } else {
      json[r'maxAlmacenes'] = null;
    }
    if (this.maxProductos != null) {
      json[r'maxProductos'] = this.maxProductos;
    } else {
      json[r'maxProductos'] = null;
    }
    if (this.maxClientes != null) {
      json[r'maxClientes'] = this.maxClientes;
    } else {
      json[r'maxClientes'] = null;
    }
    return json;
  }

  /// Returns a new [UpdateAdminTenantLicenseRequest] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static UpdateAdminTenantLicenseRequest? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "UpdateAdminTenantLicenseRequest[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "UpdateAdminTenantLicenseRequest[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return UpdateAdminTenantLicenseRequest(
        tenantLicenseId: mapValueOfType<String>(json, r'tenantLicenseId')!,
        planId: mapValueOfType<String>(json, r'planId'),
        expiracion: mapDateTime(json, r'expiracion', r''),
        activa: mapValueOfType<bool>(json, r'activa'),
        isAdminTest: mapValueOfType<bool>(json, r'isAdminTest'),
        maxUsuarios: mapValueOfType<int>(json, r'maxUsuarios'),
        maxAlmacenes: mapValueOfType<int>(json, r'maxAlmacenes'),
        maxProductos: mapValueOfType<int>(json, r'maxProductos'),
        maxClientes: mapValueOfType<int>(json, r'maxClientes'),
      );
    }
    return null;
  }

  static List<UpdateAdminTenantLicenseRequest> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <UpdateAdminTenantLicenseRequest>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = UpdateAdminTenantLicenseRequest.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, UpdateAdminTenantLicenseRequest> mapFromJson(dynamic json) {
    final map = <String, UpdateAdminTenantLicenseRequest>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = UpdateAdminTenantLicenseRequest.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of UpdateAdminTenantLicenseRequest-objects as value to a dart map
  static Map<String, List<UpdateAdminTenantLicenseRequest>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<UpdateAdminTenantLicenseRequest>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = UpdateAdminTenantLicenseRequest.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'tenantLicenseId',
  };
}

