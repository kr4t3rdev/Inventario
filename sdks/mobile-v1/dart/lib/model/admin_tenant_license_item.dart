//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class AdminTenantLicenseItem {
  /// Returns a new [AdminTenantLicenseItem] instance.
  AdminTenantLicenseItem({
    required this.tenantLicenseId,
    this.tenantId,
    this.planId,
    this.activa,
    this.inicio,
    this.expiracion,
    this.isDemo,
    this.isAdminTest,
    this.createdAt,
    this.plan,
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

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  AdminTenantLicenseItemPlan? plan;

  @override
  bool operator ==(Object other) => identical(this, other) || other is AdminTenantLicenseItem &&
    other.tenantLicenseId == tenantLicenseId &&
    other.tenantId == tenantId &&
    other.planId == planId &&
    other.activa == activa &&
    other.inicio == inicio &&
    other.expiracion == expiracion &&
    other.isDemo == isDemo &&
    other.isAdminTest == isAdminTest &&
    other.createdAt == createdAt &&
    other.plan == plan;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (tenantLicenseId.hashCode) +
    (tenantId == null ? 0 : tenantId!.hashCode) +
    (planId == null ? 0 : planId!.hashCode) +
    (activa == null ? 0 : activa!.hashCode) +
    (inicio == null ? 0 : inicio!.hashCode) +
    (expiracion == null ? 0 : expiracion!.hashCode) +
    (isDemo == null ? 0 : isDemo!.hashCode) +
    (isAdminTest == null ? 0 : isAdminTest!.hashCode) +
    (createdAt == null ? 0 : createdAt!.hashCode) +
    (plan == null ? 0 : plan!.hashCode);

  @override
  String toString() => 'AdminTenantLicenseItem[tenantLicenseId=$tenantLicenseId, tenantId=$tenantId, planId=$planId, activa=$activa, inicio=$inicio, expiracion=$expiracion, isDemo=$isDemo, isAdminTest=$isAdminTest, createdAt=$createdAt, plan=$plan]';

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
    if (this.plan != null) {
      json[r'plan'] = this.plan;
    } else {
      json[r'plan'] = null;
    }
    return json;
  }

  /// Returns a new [AdminTenantLicenseItem] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static AdminTenantLicenseItem? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "AdminTenantLicenseItem[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "AdminTenantLicenseItem[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return AdminTenantLicenseItem(
        tenantLicenseId: mapValueOfType<String>(json, r'tenantLicenseId')!,
        tenantId: mapValueOfType<String>(json, r'tenantId'),
        planId: mapValueOfType<String>(json, r'planId'),
        activa: mapValueOfType<bool>(json, r'activa'),
        inicio: mapDateTime(json, r'inicio', r''),
        expiracion: mapDateTime(json, r'expiracion', r''),
        isDemo: mapValueOfType<bool>(json, r'isDemo'),
        isAdminTest: mapValueOfType<bool>(json, r'isAdminTest'),
        createdAt: mapDateTime(json, r'createdAt', r''),
        plan: AdminTenantLicenseItemPlan.fromJson(json[r'plan']),
      );
    }
    return null;
  }

  static List<AdminTenantLicenseItem> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <AdminTenantLicenseItem>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = AdminTenantLicenseItem.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, AdminTenantLicenseItem> mapFromJson(dynamic json) {
    final map = <String, AdminTenantLicenseItem>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = AdminTenantLicenseItem.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of AdminTenantLicenseItem-objects as value to a dart map
  static Map<String, List<AdminTenantLicenseItem>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<AdminTenantLicenseItem>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = AdminTenantLicenseItem.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'tenantLicenseId',
  };
}

