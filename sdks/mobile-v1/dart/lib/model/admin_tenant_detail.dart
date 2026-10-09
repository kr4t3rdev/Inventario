//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class AdminTenantDetail {
  /// Returns a new [AdminTenantDetail] instance.
  AdminTenantDetail({
    required this.tenantId,
    required this.nombre,
    this.slug,
    this.createdAt,
    this.updatedAt,
    this.contabilidadTimezone,
    this.regimenFiscal,
    this.taxId,
    this.razonSocial,
    this.codigoPostalFiscal,
    this.fiscalActivado,
    this.totalUsers,
    this.totalProducts,
    this.totalWarehouses,
    this.totalClients,
  });

  String tenantId;

  String nombre;

  String? slug;

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
  DateTime? updatedAt;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? contabilidadTimezone;

  String? regimenFiscal;

  String? taxId;

  String? razonSocial;

  String? codigoPostalFiscal;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  bool? fiscalActivado;

  /// Minimum value: 0
  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  int? totalUsers;

  /// Minimum value: 0
  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  int? totalProducts;

  /// Minimum value: 0
  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  int? totalWarehouses;

  /// Minimum value: 0
  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  int? totalClients;

  @override
  bool operator ==(Object other) => identical(this, other) || other is AdminTenantDetail &&
    other.tenantId == tenantId &&
    other.nombre == nombre &&
    other.slug == slug &&
    other.createdAt == createdAt &&
    other.updatedAt == updatedAt &&
    other.contabilidadTimezone == contabilidadTimezone &&
    other.regimenFiscal == regimenFiscal &&
    other.taxId == taxId &&
    other.razonSocial == razonSocial &&
    other.codigoPostalFiscal == codigoPostalFiscal &&
    other.fiscalActivado == fiscalActivado &&
    other.totalUsers == totalUsers &&
    other.totalProducts == totalProducts &&
    other.totalWarehouses == totalWarehouses &&
    other.totalClients == totalClients;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (tenantId.hashCode) +
    (nombre.hashCode) +
    (slug == null ? 0 : slug!.hashCode) +
    (createdAt == null ? 0 : createdAt!.hashCode) +
    (updatedAt == null ? 0 : updatedAt!.hashCode) +
    (contabilidadTimezone == null ? 0 : contabilidadTimezone!.hashCode) +
    (regimenFiscal == null ? 0 : regimenFiscal!.hashCode) +
    (taxId == null ? 0 : taxId!.hashCode) +
    (razonSocial == null ? 0 : razonSocial!.hashCode) +
    (codigoPostalFiscal == null ? 0 : codigoPostalFiscal!.hashCode) +
    (fiscalActivado == null ? 0 : fiscalActivado!.hashCode) +
    (totalUsers == null ? 0 : totalUsers!.hashCode) +
    (totalProducts == null ? 0 : totalProducts!.hashCode) +
    (totalWarehouses == null ? 0 : totalWarehouses!.hashCode) +
    (totalClients == null ? 0 : totalClients!.hashCode);

  @override
  String toString() => 'AdminTenantDetail[tenantId=$tenantId, nombre=$nombre, slug=$slug, createdAt=$createdAt, updatedAt=$updatedAt, contabilidadTimezone=$contabilidadTimezone, regimenFiscal=$regimenFiscal, taxId=$taxId, razonSocial=$razonSocial, codigoPostalFiscal=$codigoPostalFiscal, fiscalActivado=$fiscalActivado, totalUsers=$totalUsers, totalProducts=$totalProducts, totalWarehouses=$totalWarehouses, totalClients=$totalClients]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'tenantId'] = this.tenantId;
      json[r'nombre'] = this.nombre;
    if (this.slug != null) {
      json[r'slug'] = this.slug;
    } else {
      json[r'slug'] = null;
    }
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
    if (this.contabilidadTimezone != null) {
      json[r'contabilidadTimezone'] = this.contabilidadTimezone;
    } else {
      json[r'contabilidadTimezone'] = null;
    }
    if (this.regimenFiscal != null) {
      json[r'regimenFiscal'] = this.regimenFiscal;
    } else {
      json[r'regimenFiscal'] = null;
    }
    if (this.taxId != null) {
      json[r'taxId'] = this.taxId;
    } else {
      json[r'taxId'] = null;
    }
    if (this.razonSocial != null) {
      json[r'razonSocial'] = this.razonSocial;
    } else {
      json[r'razonSocial'] = null;
    }
    if (this.codigoPostalFiscal != null) {
      json[r'codigoPostalFiscal'] = this.codigoPostalFiscal;
    } else {
      json[r'codigoPostalFiscal'] = null;
    }
    if (this.fiscalActivado != null) {
      json[r'fiscalActivado'] = this.fiscalActivado;
    } else {
      json[r'fiscalActivado'] = null;
    }
    if (this.totalUsers != null) {
      json[r'totalUsers'] = this.totalUsers;
    } else {
      json[r'totalUsers'] = null;
    }
    if (this.totalProducts != null) {
      json[r'totalProducts'] = this.totalProducts;
    } else {
      json[r'totalProducts'] = null;
    }
    if (this.totalWarehouses != null) {
      json[r'totalWarehouses'] = this.totalWarehouses;
    } else {
      json[r'totalWarehouses'] = null;
    }
    if (this.totalClients != null) {
      json[r'totalClients'] = this.totalClients;
    } else {
      json[r'totalClients'] = null;
    }
    return json;
  }

  /// Returns a new [AdminTenantDetail] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static AdminTenantDetail? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "AdminTenantDetail[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "AdminTenantDetail[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return AdminTenantDetail(
        tenantId: mapValueOfType<String>(json, r'tenantId')!,
        nombre: mapValueOfType<String>(json, r'nombre')!,
        slug: mapValueOfType<String>(json, r'slug'),
        createdAt: mapDateTime(json, r'createdAt', r''),
        updatedAt: mapDateTime(json, r'updatedAt', r''),
        contabilidadTimezone: mapValueOfType<String>(json, r'contabilidadTimezone'),
        regimenFiscal: mapValueOfType<String>(json, r'regimenFiscal'),
        taxId: mapValueOfType<String>(json, r'taxId'),
        razonSocial: mapValueOfType<String>(json, r'razonSocial'),
        codigoPostalFiscal: mapValueOfType<String>(json, r'codigoPostalFiscal'),
        fiscalActivado: mapValueOfType<bool>(json, r'fiscalActivado'),
        totalUsers: mapValueOfType<int>(json, r'totalUsers'),
        totalProducts: mapValueOfType<int>(json, r'totalProducts'),
        totalWarehouses: mapValueOfType<int>(json, r'totalWarehouses'),
        totalClients: mapValueOfType<int>(json, r'totalClients'),
      );
    }
    return null;
  }

  static List<AdminTenantDetail> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <AdminTenantDetail>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = AdminTenantDetail.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, AdminTenantDetail> mapFromJson(dynamic json) {
    final map = <String, AdminTenantDetail>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = AdminTenantDetail.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of AdminTenantDetail-objects as value to a dart map
  static Map<String, List<AdminTenantDetail>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<AdminTenantDetail>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = AdminTenantDetail.listFromJson(entry.value, growable: growable,);
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

