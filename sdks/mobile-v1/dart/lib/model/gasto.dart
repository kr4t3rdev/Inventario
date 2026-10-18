//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class Gasto {
  /// Returns a new [Gasto] instance.
  Gasto({
    required this.gastoId,
    required this.conceptoId,
    this.conceptoNombre,
    required this.monto,
    this.descripcion,
    this.comprobante,
    required this.estado,
    this.periodo,
    required this.fecha,
    this.createdAt,
    this.updatedAt,
  });

  /// 
  String gastoId;

  /// 
  String conceptoId;

  /// 
  String? conceptoNombre;

  /// 
  num monto;

  /// 
  String? descripcion;

  /// 
  String? comprobante;

  /// 
  String estado;

  /// 
  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? periodo;

  /// 
  DateTime fecha;

  /// 
  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  DateTime? createdAt;

  /// 
  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  DateTime? updatedAt;

  @override
  bool operator ==(Object other) => identical(this, other) || other is Gasto &&
    other.gastoId == gastoId &&
    other.conceptoId == conceptoId &&
    other.conceptoNombre == conceptoNombre &&
    other.monto == monto &&
    other.descripcion == descripcion &&
    other.comprobante == comprobante &&
    other.estado == estado &&
    other.periodo == periodo &&
    other.fecha == fecha &&
    other.createdAt == createdAt &&
    other.updatedAt == updatedAt;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (gastoId.hashCode) +
    (conceptoId.hashCode) +
    (conceptoNombre == null ? 0 : conceptoNombre!.hashCode) +
    (monto.hashCode) +
    (descripcion == null ? 0 : descripcion!.hashCode) +
    (comprobante == null ? 0 : comprobante!.hashCode) +
    (estado.hashCode) +
    (periodo == null ? 0 : periodo!.hashCode) +
    (fecha.hashCode) +
    (createdAt == null ? 0 : createdAt!.hashCode) +
    (updatedAt == null ? 0 : updatedAt!.hashCode);

  @override
  String toString() => 'Gasto[gastoId=$gastoId, conceptoId=$conceptoId, conceptoNombre=$conceptoNombre, monto=$monto, descripcion=$descripcion, comprobante=$comprobante, estado=$estado, periodo=$periodo, fecha=$fecha, createdAt=$createdAt, updatedAt=$updatedAt]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'gastoId'] = this.gastoId;
      json[r'conceptoId'] = this.conceptoId;
    if (this.conceptoNombre != null) {
      json[r'conceptoNombre'] = this.conceptoNombre;
    } else {
      json[r'conceptoNombre'] = null;
    }
      json[r'monto'] = this.monto;
    if (this.descripcion != null) {
      json[r'descripcion'] = this.descripcion;
    } else {
      json[r'descripcion'] = null;
    }
    if (this.comprobante != null) {
      json[r'comprobante'] = this.comprobante;
    } else {
      json[r'comprobante'] = null;
    }
      json[r'estado'] = this.estado;
    if (this.periodo != null) {
      json[r'periodo'] = this.periodo;
    } else {
      json[r'periodo'] = null;
    }
      json[r'fecha'] = this.fecha.toUtc().toIso8601String();
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
    return json;
  }

  /// Returns a new [Gasto] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static Gasto? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "Gasto[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "Gasto[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return Gasto(
        gastoId: mapValueOfType<String>(json, r'gastoId')!,
        conceptoId: mapValueOfType<String>(json, r'conceptoId')!,
        conceptoNombre: mapValueOfType<String>(json, r'conceptoNombre'),
        monto: num.parse('${json[r'monto']}'),
        descripcion: mapValueOfType<String>(json, r'descripcion'),
        comprobante: mapValueOfType<String>(json, r'comprobante'),
        estado: mapValueOfType<String>(json, r'estado')!,
        periodo: mapValueOfType<String>(json, r'periodo'),
        fecha: mapDateTime(json, r'fecha', r'')!,
        createdAt: mapDateTime(json, r'createdAt', r''),
        updatedAt: mapDateTime(json, r'updatedAt', r''),
      );
    }
    return null;
  }

  static List<Gasto> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <Gasto>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = Gasto.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, Gasto> mapFromJson(dynamic json) {
    final map = <String, Gasto>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = Gasto.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of Gasto-objects as value to a dart map
  static Map<String, List<Gasto>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<Gasto>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = Gasto.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'gastoId',
    'conceptoId',
    'monto',
    'estado',
    'fecha',
  };
}

