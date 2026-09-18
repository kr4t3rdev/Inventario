//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class AdminTenantItem {
  /// Returns a new [AdminTenantItem] instance.
  AdminTenantItem({
    required this.tenantId,
    required this.nombre,
    this.createdAt,
    this.updatedAt,
    this.totalUsers,
    this.plan,
    this.planId,
    this.licenseActive,
    this.count,
    this.licencias = const [],
  });

  String tenantId;

  String nombre;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  DateTime? createdAt;

  DateTime? updatedAt;

  /// Minimum value: 0
  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  int? totalUsers;

  String? plan;

  String? planId;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  bool? licenseActive;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  AdminTenantItemCount? count;

  List<AdminTenantLicenseItem> licencias;

  @override
  bool operator ==(Object other) => identical(this, other) || other is AdminTenantItem &&
    other.tenantId == tenantId &&
    other.nombre == nombre &&
    other.createdAt == createdAt &&
    other.updatedAt == updatedAt &&
    other.totalUsers == totalUsers &&
    other.plan == plan &&
    other.planId == planId &&
    other.licenseActive == licenseActive &&
    other.count == count &&
    _deepEquality.equals(other.licencias, licencias);

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (tenantId.hashCode) +
    (nombre.hashCode) +
    (createdAt == null ? 0 : createdAt!.hashCode) +
    (updatedAt == null ? 0 : updatedAt!.hashCode) +
    (totalUsers == null ? 0 : totalUsers!.hashCode) +
    (plan == null ? 0 : plan!.hashCode) +
    (planId == null ? 0 : planId!.hashCode) +
    (licenseActive == null ? 0 : licenseActive!.hashCode) +
    (count == null ? 0 : count!.hashCode) +
    (licencias.hashCode);

  @override
  String toString() => 'AdminTenantItem[tenantId=$tenantId, nombre=$nombre, createdAt=$createdAt, updatedAt=$updatedAt, totalUsers=$totalUsers, plan=$plan, planId=$planId, licenseActive=$licenseActive, count=$count, licencias=$licencias]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'tenantId'] = this.tenantId;
      json[r'nombre'] = this.nombre;
    if (this.createdAt != null) {
      json[r'createdAt'] = this.createdAt!.toUtc().toIso8601String();
    } else {
      json[r'createdAt'] = null;
    }
    if (this.updatedAt != null) {
      json[r'updatedAt'] = this.updatedAt!.toUtc().toIso8601String();
    } else {
      json[r'updatedAt'] = null;
    }
    if (this.totalUsers != null) {
      json[r'totalUsers'] = this.totalUsers;
    } else {
      json[r'totalUsers'] = null;
    }
    if (this.plan != null) {
      json[r'plan'] = this.plan;
    } else {
      json[r'plan'] = null;
    }
    if (this.planId != null) {
      json[r'planId'] = this.planId;
    } else {
      json[r'planId'] = null;
    }
    if (this.licenseActive != null) {
      json[r'licenseActive'] = this.licenseActive;
    } else {
      json[r'licenseActive'] = null;
    }
    if (this.count != null) {
      json[r'count'] = this.count;
    } else {
      json[r'count'] = null;
    }
      json[r'licencias'] = this.licencias;
    return json;
  }

  /// Returns a new [AdminTenantItem] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static AdminTenantItem? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "AdminTenantItem[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "AdminTenantItem[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return AdminTenantItem(
        tenantId: mapValueOfType<String>(json, r'tenantId')!,
        nombre: mapValueOfType<String>(json, r'nombre')!,
        createdAt: mapDateTime(json, r'createdAt', r''),
        updatedAt: mapDateTime(json, r'updatedAt', r''),
        totalUsers: mapValueOfType<int>(json, r'totalUsers'),
        plan: mapValueOfType<String>(json, r'plan'),
        planId: mapValueOfType<String>(json, r'planId'),
        licenseActive: mapValueOfType<bool>(json, r'licenseActive'),
        count: AdminTenantItemCount.fromJson(json[r'count']),
        licencias: AdminTenantLicenseItem.listFromJson(json[r'licencias']),
      );
    }
    return null;
  }

  static List<AdminTenantItem> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <AdminTenantItem>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = AdminTenantItem.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, AdminTenantItem> mapFromJson(dynamic json) {
    final map = <String, AdminTenantItem>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = AdminTenantItem.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of AdminTenantItem-objects as value to a dart map
  static Map<String, List<AdminTenantItem>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<AdminTenantItem>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = AdminTenantItem.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'tenantId',
    'nombre',
  };
}

