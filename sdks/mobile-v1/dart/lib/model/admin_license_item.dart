//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class AdminLicenseItem {
  /// Returns a new [AdminLicenseItem] instance.
  AdminLicenseItem({
    required this.tenantLicenseId,
    this.tenantId,
    this.planId,
    this.activa,
    this.inicio,
    this.expiracion,
    this.maxUsuarios,
    this.maxAlmacenes,
    this.maxProductos,
    this.maxClientes,
    this.isDemo,
    this.isAdminTest,
    this.createdAt,
    this.createdBy,
    this.createdByUser,
    this.plan,
    this.tenant,
  });

  String tenantLicenseId;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? tenantId;

  String? planId;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  bool? activa;

  DateTime? inicio;

  DateTime? expiracion;

  /// Minimum value: 0
  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  int? maxUsuarios;

  /// Minimum value: 0
  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  int? maxAlmacenes;

  /// Minimum value: 0
  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  int? maxProductos;

  /// Minimum value: 0
  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  int? maxClientes;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  bool? isDemo;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  bool? isAdminTest;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  DateTime? createdAt;

  String? createdBy;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  AdminLicenseItemCreatedByUser? createdByUser;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  AdminTenantLicenseItemPlan? plan;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  AdminLicenseItemTenant? tenant;

  @override
  bool operator ==(Object other) => identical(this, other) || other is AdminLicenseItem &&
    other.tenantLicenseId == tenantLicenseId &&
    other.tenantId == tenantId &&
    other.planId == planId &&
    other.activa == activa &&
    other.inicio == inicio &&
    other.expiracion == expiracion &&
    other.maxUsuarios == maxUsuarios &&
    other.maxAlmacenes == maxAlmacenes &&
    other.maxProductos == maxProductos &&
    other.maxClientes == maxClientes &&
    other.isDemo == isDemo &&
    other.isAdminTest == isAdminTest &&
    other.createdAt == createdAt &&
    other.createdBy == createdBy &&
    other.createdByUser == createdByUser &&
    other.plan == plan &&
    other.tenant == tenant;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (tenantLicenseId.hashCode) +
    (tenantId == null ? 0 : tenantId!.hashCode) +
    (planId == null ? 0 : planId!.hashCode) +
    (activa == null ? 0 : activa!.hashCode) +
    (inicio == null ? 0 : inicio!.hashCode) +
    (expiracion == null ? 0 : expiracion!.hashCode) +
    (maxUsuarios == null ? 0 : maxUsuarios!.hashCode) +
    (maxAlmacenes == null ? 0 : maxAlmacenes!.hashCode) +
    (maxProductos == null ? 0 : maxProductos!.hashCode) +
    (maxClientes == null ? 0 : maxClientes!.hashCode) +
    (isDemo == null ? 0 : isDemo!.hashCode) +
    (isAdminTest == null ? 0 : isAdminTest!.hashCode) +
    (createdAt == null ? 0 : createdAt!.hashCode) +
    (createdBy == null ? 0 : createdBy!.hashCode) +
    (createdByUser == null ? 0 : createdByUser!.hashCode) +
    (plan == null ? 0 : plan!.hashCode) +
    (tenant == null ? 0 : tenant!.hashCode);

  @override
  String toString() => 'AdminLicenseItem[tenantLicenseId=$tenantLicenseId, tenantId=$tenantId, planId=$planId, activa=$activa, inicio=$inicio, expiracion=$expiracion, maxUsuarios=$maxUsuarios, maxAlmacenes=$maxAlmacenes, maxProductos=$maxProductos, maxClientes=$maxClientes, isDemo=$isDemo, isAdminTest=$isAdminTest, createdAt=$createdAt, createdBy=$createdBy, createdByUser=$createdByUser, plan=$plan, tenant=$tenant]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'tenantLicenseId'] = this.tenantLicenseId;
    if (this.tenantId != null) {
      json[r'tenantId'] = this.tenantId;
    } else {
      json[r'tenantId'] = null;
    }
    if (this.planId != null) {
      json[r'planId'] = this.planId;
    } else {
      json[r'planId'] = null;
    }
    if (this.activa != null) {
      json[r'activa'] = this.activa;
    } else {
      json[r'activa'] = null;
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
    if (this.isDemo != null) {
      json[r'isDemo'] = this.isDemo;
    } else {
      json[r'isDemo'] = null;
    }
    if (this.isAdminTest != null) {
      json[r'isAdminTest'] = this.isAdminTest;
    } else {
      json[r'isAdminTest'] = null;
    }
    if (this.createdAt != null) {
      json[r'createdAt'] = this.createdAt!.toUtc().toIso8601String();
    } else {
      json[r'createdAt'] = null;
    }
    if (this.createdBy != null) {
      json[r'createdBy'] = this.createdBy;
    } else {
      json[r'createdBy'] = null;
    }
    if (this.createdByUser != null) {
      json[r'createdByUser'] = this.createdByUser;
    } else {
      json[r'createdByUser'] = null;
    }
    if (this.plan != null) {
      json[r'plan'] = this.plan;
    } else {
      json[r'plan'] = null;
    }
    if (this.tenant != null) {
      json[r'tenant'] = this.tenant;
    } else {
      json[r'tenant'] = null;
    }
    return json;
  }

  /// Returns a new [AdminLicenseItem] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static AdminLicenseItem? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "AdminLicenseItem[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "AdminLicenseItem[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return AdminLicenseItem(
        tenantLicenseId: mapValueOfType<String>(json, r'tenantLicenseId')!,
        tenantId: mapValueOfType<String>(json, r'tenantId'),
        planId: mapValueOfType<String>(json, r'planId'),
        activa: mapValueOfType<bool>(json, r'activa'),
        inicio: mapDateTime(json, r'inicio', r''),
        expiracion: mapDateTime(json, r'expiracion', r''),
        maxUsuarios: mapValueOfType<int>(json, r'maxUsuarios'),
        maxAlmacenes: mapValueOfType<int>(json, r'maxAlmacenes'),
        maxProductos: mapValueOfType<int>(json, r'maxProductos'),
        maxClientes: mapValueOfType<int>(json, r'maxClientes'),
        isDemo: mapValueOfType<bool>(json, r'isDemo'),
        isAdminTest: mapValueOfType<bool>(json, r'isAdminTest'),
        createdAt: mapDateTime(json, r'createdAt', r''),
        createdBy: mapValueOfType<String>(json, r'createdBy'),
        createdByUser: AdminLicenseItemCreatedByUser.fromJson(json[r'createdByUser']),
        plan: AdminTenantLicenseItemPlan.fromJson(json[r'plan']),
        tenant: AdminLicenseItemTenant.fromJson(json[r'tenant']),
      );
    }
    return null;
  }

  static List<AdminLicenseItem> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <AdminLicenseItem>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = AdminLicenseItem.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, AdminLicenseItem> mapFromJson(dynamic json) {
    final map = <String, AdminLicenseItem>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = AdminLicenseItem.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of AdminLicenseItem-objects as value to a dart map
  static Map<String, List<AdminLicenseItem>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<AdminLicenseItem>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = AdminLicenseItem.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'tenantLicenseId',
  };
}

