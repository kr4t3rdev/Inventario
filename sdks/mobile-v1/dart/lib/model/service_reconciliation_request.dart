//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class ServiceReconciliationRequest {
  /// Returns a new [ServiceReconciliationRequest] instance.
  ServiceReconciliationRequest({
    required this.ventaServicioId,
    this.distribuciones = const [],
    this.fechaReconciliacion,
  });

  String ventaServicioId;

  List<ServiceDistributionRequest> distribuciones;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  DateTime? fechaReconciliacion;

  @override
  bool operator ==(Object other) => identical(this, other) || other is ServiceReconciliationRequest &&
    other.ventaServicioId == ventaServicioId &&
    _deepEquality.equals(other.distribuciones, distribuciones) &&
    other.fechaReconciliacion == fechaReconciliacion;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (ventaServicioId.hashCode) +
    (distribuciones.hashCode) +
    (fechaReconciliacion == null ? 0 : fechaReconciliacion!.hashCode);

  @override
  String toString() => 'ServiceReconciliationRequest[ventaServicioId=$ventaServicioId, distribuciones=$distribuciones, fechaReconciliacion=$fechaReconciliacion]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'ventaServicioId'] = this.ventaServicioId;
      json[r'distribuciones'] = this.distribuciones;
    if (this.fechaReconciliacion != null) {
      json[r'fechaReconciliacion'] = this.fechaReconciliacion!.toUtc().toIso8601String();
    } else {
      json[r'fechaReconciliacion'] = null;
    }
    return json;
  }

  /// Returns a new [ServiceReconciliationRequest] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static ServiceReconciliationRequest? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "ServiceReconciliationRequest[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "ServiceReconciliationRequest[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return ServiceReconciliationRequest(
        ventaServicioId: mapValueOfType<String>(json, r'ventaServicioId')!,
        distribuciones: ServiceDistributionRequest.listFromJson(json[r'distribuciones']),
        fechaReconciliacion: mapDateTime(json, r'fechaReconciliacion', r''),
      );
    }
    return null;
  }

  static List<ServiceReconciliationRequest> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <ServiceReconciliationRequest>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = ServiceReconciliationRequest.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, ServiceReconciliationRequest> mapFromJson(dynamic json) {
    final map = <String, ServiceReconciliationRequest>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = ServiceReconciliationRequest.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of ServiceReconciliationRequest-objects as value to a dart map
  static Map<String, List<ServiceReconciliationRequest>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<ServiceReconciliationRequest>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = ServiceReconciliationRequest.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'ventaServicioId',
    'distribuciones',
  };
}

