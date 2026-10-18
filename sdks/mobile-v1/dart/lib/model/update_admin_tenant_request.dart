//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class UpdateAdminTenantRequest {
  /// Returns a new [UpdateAdminTenantRequest] instance.
  UpdateAdminTenantRequest({
    required this.tenantId,
    this.nombre,
    this.slug,
    this.regimenFiscal,
    this.taxId,
    this.razonSocial,
    this.codigoPostalFiscal,
    this.fiscalActivado,
    this.contabilidadTimezone,
  });

  String tenantId;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? nombre;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? slug;

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

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? contabilidadTimezone;

  @override
  bool operator ==(Object other) => identical(this, other) || other is UpdateAdminTenantRequest &&
    other.tenantId == tenantId &&
    other.nombre == nombre &&
    other.slug == slug &&
    other.regimenFiscal == regimenFiscal &&
    other.taxId == taxId &&
    other.razonSocial == razonSocial &&
    other.codigoPostalFiscal == codigoPostalFiscal &&
    other.fiscalActivado == fiscalActivado &&
    other.contabilidadTimezone == contabilidadTimezone;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (tenantId.hashCode) +
    (nombre == null ? 0 : nombre!.hashCode) +
    (slug == null ? 0 : slug!.hashCode) +
    (regimenFiscal == null ? 0 : regimenFiscal!.hashCode) +
    (taxId == null ? 0 : taxId!.hashCode) +
    (razonSocial == null ? 0 : razonSocial!.hashCode) +
    (codigoPostalFiscal == null ? 0 : codigoPostalFiscal!.hashCode) +
    (fiscalActivado == null ? 0 : fiscalActivado!.hashCode) +
    (contabilidadTimezone == null ? 0 : contabilidadTimezone!.hashCode);

  @override
  String toString() => 'UpdateAdminTenantRequest[tenantId=$tenantId, nombre=$nombre, slug=$slug, regimenFiscal=$regimenFiscal, taxId=$taxId, razonSocial=$razonSocial, codigoPostalFiscal=$codigoPostalFiscal, fiscalActivado=$fiscalActivado, contabilidadTimezone=$contabilidadTimezone]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'tenantId'] = this.tenantId;
    if (this.nombre != null) {
      json[r'nombre'] = this.nombre;
    } else {
      json[r'nombre'] = null;
    }
    if (this.slug != null) {
      json[r'slug'] = this.slug;
    } else {
      json[r'slug'] = null;
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
    if (this.contabilidadTimezone != null) {
      json[r'contabilidadTimezone'] = this.contabilidadTimezone;
    } else {
      json[r'contabilidadTimezone'] = null;
    }
    return json;
  }

  /// Returns a new [UpdateAdminTenantRequest] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static UpdateAdminTenantRequest? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "UpdateAdminTenantRequest[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "UpdateAdminTenantRequest[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return UpdateAdminTenantRequest(
        tenantId: mapValueOfType<String>(json, r'tenantId')!,
        nombre: mapValueOfType<String>(json, r'nombre'),
        slug: mapValueOfType<String>(json, r'slug'),
        regimenFiscal: mapValueOfType<String>(json, r'regimenFiscal'),
        taxId: mapValueOfType<String>(json, r'taxId'),
        razonSocial: mapValueOfType<String>(json, r'razonSocial'),
        codigoPostalFiscal: mapValueOfType<String>(json, r'codigoPostalFiscal'),
        fiscalActivado: mapValueOfType<bool>(json, r'fiscalActivado'),
        contabilidadTimezone: mapValueOfType<String>(json, r'contabilidadTimezone'),
      );
    }
    return null;
  }

  static List<UpdateAdminTenantRequest> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <UpdateAdminTenantRequest>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = UpdateAdminTenantRequest.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, UpdateAdminTenantRequest> mapFromJson(dynamic json) {
    final map = <String, UpdateAdminTenantRequest>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = UpdateAdminTenantRequest.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of UpdateAdminTenantRequest-objects as value to a dart map
  static Map<String, List<UpdateAdminTenantRequest>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<UpdateAdminTenantRequest>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = UpdateAdminTenantRequest.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'tenantId',
  };
}

