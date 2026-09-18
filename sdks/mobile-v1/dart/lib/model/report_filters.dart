//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class ReportFilters {
  /// Returns a new [ReportFilters] instance.
  ReportFilters({
    this.fechaInicio,
    this.fechaFin,
    this.cuentaId,
    this.moneda,
    this.tipo,
    this.busqueda,
  });

  DateTime? fechaInicio;

  DateTime? fechaFin;

  String? cuentaId;

  String? moneda;

  String? tipo;

  String? busqueda;

  @override
  bool operator ==(Object other) => identical(this, other) || other is ReportFilters &&
    other.fechaInicio == fechaInicio &&
    other.fechaFin == fechaFin &&
    other.cuentaId == cuentaId &&
    other.moneda == moneda &&
    other.tipo == tipo &&
    other.busqueda == busqueda;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (fechaInicio == null ? 0 : fechaInicio!.hashCode) +
    (fechaFin == null ? 0 : fechaFin!.hashCode) +
    (cuentaId == null ? 0 : cuentaId!.hashCode) +
    (moneda == null ? 0 : moneda!.hashCode) +
    (tipo == null ? 0 : tipo!.hashCode) +
    (busqueda == null ? 0 : busqueda!.hashCode);

  @override
  String toString() => 'ReportFilters[fechaInicio=$fechaInicio, fechaFin=$fechaFin, cuentaId=$cuentaId, moneda=$moneda, tipo=$tipo, busqueda=$busqueda]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
    if (this.fechaInicio != null) {
      json[r'fechaInicio'] = this.fechaInicio!.toUtc().toIso8601String();
    } else {
      json[r'fechaInicio'] = null;
    }
    if (this.fechaFin != null) {
      json[r'fechaFin'] = this.fechaFin!.toUtc().toIso8601String();
    } else {
      json[r'fechaFin'] = null;
    }
    if (this.cuentaId != null) {
      json[r'cuentaId'] = this.cuentaId;
    } else {
      json[r'cuentaId'] = null;
    }
    if (this.moneda != null) {
      json[r'moneda'] = this.moneda;
    } else {
      json[r'moneda'] = null;
    }
    if (this.tipo != null) {
      json[r'tipo'] = this.tipo;
    } else {
      json[r'tipo'] = null;
    }
    if (this.busqueda != null) {
      json[r'busqueda'] = this.busqueda;
    } else {
      json[r'busqueda'] = null;
    }
    return json;
  }

  /// Returns a new [ReportFilters] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static ReportFilters? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "ReportFilters[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "ReportFilters[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return ReportFilters(
        fechaInicio: mapDateTime(json, r'fechaInicio', r''),
        fechaFin: mapDateTime(json, r'fechaFin', r''),
        cuentaId: mapValueOfType<String>(json, r'cuentaId'),
        moneda: mapValueOfType<String>(json, r'moneda'),
        tipo: mapValueOfType<String>(json, r'tipo'),
        busqueda: mapValueOfType<String>(json, r'busqueda'),
      );
    }
    return null;
  }

  static List<ReportFilters> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <ReportFilters>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = ReportFilters.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, ReportFilters> mapFromJson(dynamic json) {
    final map = <String, ReportFilters>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = ReportFilters.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of ReportFilters-objects as value to a dart map
  static Map<String, List<ReportFilters>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<ReportFilters>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = ReportFilters.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
  };
}

