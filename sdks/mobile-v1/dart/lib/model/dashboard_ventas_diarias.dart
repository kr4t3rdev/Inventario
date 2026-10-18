//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class DashboardVentasDiarias {
  /// Returns a new [DashboardVentasDiarias] instance.
  DashboardVentasDiarias({
    this.ventasHoy,
    this.ingresosHoy,
    this.ventasAyer,
    this.ingresosAyer,
    this.promedioVentasDiarias,
    this.promedioIngresosDiarios,
    this.diasConVentas,
    this.totalDias,
    this.totalIngresosPeriodo,
    this.totalCantidadPeriodo,
  });

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? ventasHoy;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? ingresosHoy;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? ventasAyer;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? ingresosAyer;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? promedioVentasDiarias;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? promedioIngresosDiarios;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? diasConVentas;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? totalDias;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? totalIngresosPeriodo;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? totalCantidadPeriodo;

  @override
  bool operator ==(Object other) => identical(this, other) || other is DashboardVentasDiarias &&
    other.ventasHoy == ventasHoy &&
    other.ingresosHoy == ingresosHoy &&
    other.ventasAyer == ventasAyer &&
    other.ingresosAyer == ingresosAyer &&
    other.promedioVentasDiarias == promedioVentasDiarias &&
    other.promedioIngresosDiarios == promedioIngresosDiarios &&
    other.diasConVentas == diasConVentas &&
    other.totalDias == totalDias &&
    other.totalIngresosPeriodo == totalIngresosPeriodo &&
    other.totalCantidadPeriodo == totalCantidadPeriodo;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (ventasHoy == null ? 0 : ventasHoy!.hashCode) +
    (ingresosHoy == null ? 0 : ingresosHoy!.hashCode) +
    (ventasAyer == null ? 0 : ventasAyer!.hashCode) +
    (ingresosAyer == null ? 0 : ingresosAyer!.hashCode) +
    (promedioVentasDiarias == null ? 0 : promedioVentasDiarias!.hashCode) +
    (promedioIngresosDiarios == null ? 0 : promedioIngresosDiarios!.hashCode) +
    (diasConVentas == null ? 0 : diasConVentas!.hashCode) +
    (totalDias == null ? 0 : totalDias!.hashCode) +
    (totalIngresosPeriodo == null ? 0 : totalIngresosPeriodo!.hashCode) +
    (totalCantidadPeriodo == null ? 0 : totalCantidadPeriodo!.hashCode);

  @override
  String toString() => 'DashboardVentasDiarias[ventasHoy=$ventasHoy, ingresosHoy=$ingresosHoy, ventasAyer=$ventasAyer, ingresosAyer=$ingresosAyer, promedioVentasDiarias=$promedioVentasDiarias, promedioIngresosDiarios=$promedioIngresosDiarios, diasConVentas=$diasConVentas, totalDias=$totalDias, totalIngresosPeriodo=$totalIngresosPeriodo, totalCantidadPeriodo=$totalCantidadPeriodo]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
    if (this.ventasHoy != null) {
      json[r'ventasHoy'] = this.ventasHoy;
    } else {
      json[r'ventasHoy'] = null;
    }
    if (this.ingresosHoy != null) {
      json[r'ingresosHoy'] = this.ingresosHoy;
    } else {
      json[r'ingresosHoy'] = null;
    }
    if (this.ventasAyer != null) {
      json[r'ventasAyer'] = this.ventasAyer;
    } else {
      json[r'ventasAyer'] = null;
    }
    if (this.ingresosAyer != null) {
      json[r'ingresosAyer'] = this.ingresosAyer;
    } else {
      json[r'ingresosAyer'] = null;
    }
    if (this.promedioVentasDiarias != null) {
      json[r'promedioVentasDiarias'] = this.promedioVentasDiarias;
    } else {
      json[r'promedioVentasDiarias'] = null;
    }
    if (this.promedioIngresosDiarios != null) {
      json[r'promedioIngresosDiarios'] = this.promedioIngresosDiarios;
    } else {
      json[r'promedioIngresosDiarios'] = null;
    }
    if (this.diasConVentas != null) {
      json[r'diasConVentas'] = this.diasConVentas;
    } else {
      json[r'diasConVentas'] = null;
    }
    if (this.totalDias != null) {
      json[r'totalDias'] = this.totalDias;
    } else {
      json[r'totalDias'] = null;
    }
    if (this.totalIngresosPeriodo != null) {
      json[r'totalIngresosPeriodo'] = this.totalIngresosPeriodo;
    } else {
      json[r'totalIngresosPeriodo'] = null;
    }
    if (this.totalCantidadPeriodo != null) {
      json[r'totalCantidadPeriodo'] = this.totalCantidadPeriodo;
    } else {
      json[r'totalCantidadPeriodo'] = null;
    }
    return json;
  }

  /// Returns a new [DashboardVentasDiarias] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static DashboardVentasDiarias? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "DashboardVentasDiarias[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "DashboardVentasDiarias[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return DashboardVentasDiarias(
        ventasHoy: num.parse('${json[r'ventasHoy']}'),
        ingresosHoy: num.parse('${json[r'ingresosHoy']}'),
        ventasAyer: num.parse('${json[r'ventasAyer']}'),
        ingresosAyer: num.parse('${json[r'ingresosAyer']}'),
        promedioVentasDiarias: num.parse('${json[r'promedioVentasDiarias']}'),
        promedioIngresosDiarios: num.parse('${json[r'promedioIngresosDiarios']}'),
        diasConVentas: num.parse('${json[r'diasConVentas']}'),
        totalDias: num.parse('${json[r'totalDias']}'),
        totalIngresosPeriodo: num.parse('${json[r'totalIngresosPeriodo']}'),
        totalCantidadPeriodo: num.parse('${json[r'totalCantidadPeriodo']}'),
      );
    }
    return null;
  }

  static List<DashboardVentasDiarias> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <DashboardVentasDiarias>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = DashboardVentasDiarias.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, DashboardVentasDiarias> mapFromJson(dynamic json) {
    final map = <String, DashboardVentasDiarias>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = DashboardVentasDiarias.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of DashboardVentasDiarias-objects as value to a dart map
  static Map<String, List<DashboardVentasDiarias>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<DashboardVentasDiarias>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = DashboardVentasDiarias.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
  };
}

