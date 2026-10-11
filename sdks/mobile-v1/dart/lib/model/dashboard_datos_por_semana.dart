//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class DashboardDatosPorSemana {
  /// Returns a new [DashboardDatosPorSemana] instance.
  DashboardDatosPorSemana({
    this.semana,
    this.ingresosVentas,
    this.ingresosServicios,
    this.gastosMermas,
    this.gastosDeExplotacion,
    this.gastosDeExplotacionCantidad,
    this.gastosCompras,
    this.gastosComprasCantidad,
    this.gastosSalarios,
    this.gastosSalariosCantidad,
    this.ventasCantidad,
    this.ventasServiciosCantidad,
    this.mermasCantidad,
  });

  /// Semana ISO (YYYY-Www).
  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? semana;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? ingresosVentas;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? ingresosServicios;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? gastosMermas;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? gastosDeExplotacion;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? gastosDeExplotacionCantidad;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? gastosCompras;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? gastosComprasCantidad;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? gastosSalarios;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? gastosSalariosCantidad;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? ventasCantidad;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? ventasServiciosCantidad;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? mermasCantidad;

  @override
  bool operator ==(Object other) => identical(this, other) || other is DashboardDatosPorSemana &&
    other.semana == semana &&
    other.ingresosVentas == ingresosVentas &&
    other.ingresosServicios == ingresosServicios &&
    other.gastosMermas == gastosMermas &&
    other.gastosDeExplotacion == gastosDeExplotacion &&
    other.gastosDeExplotacionCantidad == gastosDeExplotacionCantidad &&
    other.gastosCompras == gastosCompras &&
    other.gastosComprasCantidad == gastosComprasCantidad &&
    other.gastosSalarios == gastosSalarios &&
    other.gastosSalariosCantidad == gastosSalariosCantidad &&
    other.ventasCantidad == ventasCantidad &&
    other.ventasServiciosCantidad == ventasServiciosCantidad &&
    other.mermasCantidad == mermasCantidad;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (semana == null ? 0 : semana!.hashCode) +
    (ingresosVentas == null ? 0 : ingresosVentas!.hashCode) +
    (ingresosServicios == null ? 0 : ingresosServicios!.hashCode) +
    (gastosMermas == null ? 0 : gastosMermas!.hashCode) +
    (gastosDeExplotacion == null ? 0 : gastosDeExplotacion!.hashCode) +
    (gastosDeExplotacionCantidad == null ? 0 : gastosDeExplotacionCantidad!.hashCode) +
    (gastosCompras == null ? 0 : gastosCompras!.hashCode) +
    (gastosComprasCantidad == null ? 0 : gastosComprasCantidad!.hashCode) +
    (gastosSalarios == null ? 0 : gastosSalarios!.hashCode) +
    (gastosSalariosCantidad == null ? 0 : gastosSalariosCantidad!.hashCode) +
    (ventasCantidad == null ? 0 : ventasCantidad!.hashCode) +
    (ventasServiciosCantidad == null ? 0 : ventasServiciosCantidad!.hashCode) +
    (mermasCantidad == null ? 0 : mermasCantidad!.hashCode);

  @override
  String toString() => 'DashboardDatosPorSemana[semana=$semana, ingresosVentas=$ingresosVentas, ingresosServicios=$ingresosServicios, gastosMermas=$gastosMermas, gastosDeExplotacion=$gastosDeExplotacion, gastosDeExplotacionCantidad=$gastosDeExplotacionCantidad, gastosCompras=$gastosCompras, gastosComprasCantidad=$gastosComprasCantidad, gastosSalarios=$gastosSalarios, gastosSalariosCantidad=$gastosSalariosCantidad, ventasCantidad=$ventasCantidad, ventasServiciosCantidad=$ventasServiciosCantidad, mermasCantidad=$mermasCantidad]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
    if (this.semana != null) {
      json[r'semana'] = this.semana;
    } else {
      json[r'semana'] = null;
    }
    if (this.ingresosVentas != null) {
      json[r'ingresosVentas'] = this.ingresosVentas;
    } else {
      json[r'ingresosVentas'] = null;
    }
    if (this.ingresosServicios != null) {
      json[r'ingresosServicios'] = this.ingresosServicios;
    } else {
      json[r'ingresosServicios'] = null;
    }
    if (this.gastosMermas != null) {
      json[r'gastosMermas'] = this.gastosMermas;
    } else {
      json[r'gastosMermas'] = null;
    }
    if (this.gastosDeExplotacion != null) {
      json[r'gastosDeExplotacion'] = this.gastosDeExplotacion;
    } else {
      json[r'gastosDeExplotacion'] = null;
    }
    if (this.gastosDeExplotacionCantidad != null) {
      json[r'gastosDeExplotacionCantidad'] = this.gastosDeExplotacionCantidad;
    } else {
      json[r'gastosDeExplotacionCantidad'] = null;
    }
    if (this.gastosCompras != null) {
      json[r'gastosCompras'] = this.gastosCompras;
    } else {
      json[r'gastosCompras'] = null;
    }
    if (this.gastosComprasCantidad != null) {
      json[r'gastosComprasCantidad'] = this.gastosComprasCantidad;
    } else {
      json[r'gastosComprasCantidad'] = null;
    }
    if (this.gastosSalarios != null) {
      json[r'gastosSalarios'] = this.gastosSalarios;
    } else {
      json[r'gastosSalarios'] = null;
    }
    if (this.gastosSalariosCantidad != null) {
      json[r'gastosSalariosCantidad'] = this.gastosSalariosCantidad;
    } else {
      json[r'gastosSalariosCantidad'] = null;
    }
    if (this.ventasCantidad != null) {
      json[r'ventasCantidad'] = this.ventasCantidad;
    } else {
      json[r'ventasCantidad'] = null;
    }
    if (this.ventasServiciosCantidad != null) {
      json[r'ventasServiciosCantidad'] = this.ventasServiciosCantidad;
    } else {
      json[r'ventasServiciosCantidad'] = null;
    }
    if (this.mermasCantidad != null) {
      json[r'mermasCantidad'] = this.mermasCantidad;
    } else {
      json[r'mermasCantidad'] = null;
    }
    return json;
  }

  /// Returns a new [DashboardDatosPorSemana] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static DashboardDatosPorSemana? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "DashboardDatosPorSemana[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "DashboardDatosPorSemana[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return DashboardDatosPorSemana(
        semana: mapValueOfType<String>(json, r'semana'),
        ingresosVentas: num.parse('${json[r'ingresosVentas']}'),
        ingresosServicios: num.parse('${json[r'ingresosServicios']}'),
        gastosMermas: num.parse('${json[r'gastosMermas']}'),
        gastosDeExplotacion: num.parse('${json[r'gastosDeExplotacion']}'),
        gastosDeExplotacionCantidad: num.parse('${json[r'gastosDeExplotacionCantidad']}'),
        gastosCompras: num.parse('${json[r'gastosCompras']}'),
        gastosComprasCantidad: num.parse('${json[r'gastosComprasCantidad']}'),
        gastosSalarios: num.parse('${json[r'gastosSalarios']}'),
        gastosSalariosCantidad: num.parse('${json[r'gastosSalariosCantidad']}'),
        ventasCantidad: num.parse('${json[r'ventasCantidad']}'),
        ventasServiciosCantidad: num.parse('${json[r'ventasServiciosCantidad']}'),
        mermasCantidad: num.parse('${json[r'mermasCantidad']}'),
      );
    }
    return null;
  }

  static List<DashboardDatosPorSemana> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <DashboardDatosPorSemana>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = DashboardDatosPorSemana.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, DashboardDatosPorSemana> mapFromJson(dynamic json) {
    final map = <String, DashboardDatosPorSemana>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = DashboardDatosPorSemana.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of DashboardDatosPorSemana-objects as value to a dart map
  static Map<String, List<DashboardDatosPorSemana>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<DashboardDatosPorSemana>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = DashboardDatosPorSemana.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
  };
}

