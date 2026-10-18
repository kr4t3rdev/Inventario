//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class Contrato {
  /// Returns a new [Contrato] instance.
  Contrato({
    required this.contratoId,
    required this.clienteId,
    this.clienteNombre,
    required this.numeroContrato,
    this.observaciones,
    required this.monto,
    required this.estado,
    required this.fechaInicio,
    this.fechaFin,
    this.createdAt,
    this.updatedAt,
  });

  /// 
  String contratoId;

  /// 
  String clienteId;

  /// 
  String? clienteNombre;

  /// 
  String numeroContrato;

  /// 
  String? observaciones;

  /// 
  num monto;

  /// 
  String estado;

  /// 
  DateTime fechaInicio;

  /// 
  String? fechaFin;

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
  bool operator ==(Object other) => identical(this, other) || other is Contrato &&
    other.contratoId == contratoId &&
    other.clienteId == clienteId &&
    other.clienteNombre == clienteNombre &&
    other.numeroContrato == numeroContrato &&
    other.observaciones == observaciones &&
    other.monto == monto &&
    other.estado == estado &&
    other.fechaInicio == fechaInicio &&
    other.fechaFin == fechaFin &&
    other.createdAt == createdAt &&
    other.updatedAt == updatedAt;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (contratoId.hashCode) +
    (clienteId.hashCode) +
    (clienteNombre == null ? 0 : clienteNombre!.hashCode) +
    (numeroContrato.hashCode) +
    (observaciones == null ? 0 : observaciones!.hashCode) +
    (monto.hashCode) +
    (estado.hashCode) +
    (fechaInicio.hashCode) +
    (fechaFin == null ? 0 : fechaFin!.hashCode) +
    (createdAt == null ? 0 : createdAt!.hashCode) +
    (updatedAt == null ? 0 : updatedAt!.hashCode);

  @override
  String toString() => 'Contrato[contratoId=$contratoId, clienteId=$clienteId, clienteNombre=$clienteNombre, numeroContrato=$numeroContrato, observaciones=$observaciones, monto=$monto, estado=$estado, fechaInicio=$fechaInicio, fechaFin=$fechaFin, createdAt=$createdAt, updatedAt=$updatedAt]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'contratoId'] = this.contratoId;
      json[r'clienteId'] = this.clienteId;
    if (this.clienteNombre != null) {
      json[r'clienteNombre'] = this.clienteNombre;
    } else {
      json[r'clienteNombre'] = null;
    }
      json[r'numeroContrato'] = this.numeroContrato;
    if (this.observaciones != null) {
      json[r'observaciones'] = this.observaciones;
    } else {
      json[r'observaciones'] = null;
    }
      json[r'monto'] = this.monto;
      json[r'estado'] = this.estado;
      json[r'fechaInicio'] = this.fechaInicio.toUtc().toIso8601String();
    if (this.fechaFin != null) {
      json[r'fechaFin'] = this.fechaFin;
    } else {
      json[r'fechaFin'] = null;
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
    return json;
  }

  /// Returns a new [Contrato] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static Contrato? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "Contrato[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "Contrato[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return Contrato(
        contratoId: mapValueOfType<String>(json, r'contratoId')!,
        clienteId: mapValueOfType<String>(json, r'clienteId')!,
        clienteNombre: mapValueOfType<String>(json, r'clienteNombre'),
        numeroContrato: mapValueOfType<String>(json, r'numeroContrato')!,
        observaciones: mapValueOfType<String>(json, r'observaciones'),
        monto: num.parse('${json[r'monto']}'),
        estado: mapValueOfType<String>(json, r'estado')!,
        fechaInicio: mapDateTime(json, r'fechaInicio', r'')!,
        fechaFin: mapValueOfType<String>(json, r'fechaFin'),
        createdAt: mapDateTime(json, r'createdAt', r''),
        updatedAt: mapDateTime(json, r'updatedAt', r''),
      );
    }
    return null;
  }

  static List<Contrato> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <Contrato>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = Contrato.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, Contrato> mapFromJson(dynamic json) {
    final map = <String, Contrato>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = Contrato.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of Contrato-objects as value to a dart map
  static Map<String, List<Contrato>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<Contrato>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = Contrato.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'contratoId',
    'clienteId',
    'numeroContrato',
    'monto',
    'estado',
    'fechaInicio',
  };
}

