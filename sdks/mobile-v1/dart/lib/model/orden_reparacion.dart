//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class OrdenReparacion {
  /// Returns a new [OrdenReparacion] instance.
  OrdenReparacion({
    required this.ordenId,
    required this.numeroOrden,
    this.clienteNombre,
    this.equipoTipo,
    required this.marca,
    this.modelo,
    required this.problemaReportado,
    required this.estado,
    this.prioridad,
    this.esGarantia,
    this.tecnicoNombre,
    this.fechaRecepcion,
    this.createdAt,
  });

  /// 
  String ordenId;

  /// 
  int numeroOrden;

  /// 
  String? clienteNombre;

  /// 
  String? equipoTipo;

  /// 
  String marca;

  /// 
  String? modelo;

  /// 
  String problemaReportado;

  /// 
  String estado;

  /// 
  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? prioridad;

  /// 
  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  bool? esGarantia;

  /// 
  String? tecnicoNombre;

  /// 
  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  DateTime? fechaRecepcion;

  /// 
  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  DateTime? createdAt;

  @override
  bool operator ==(Object other) => identical(this, other) || other is OrdenReparacion &&
    other.ordenId == ordenId &&
    other.numeroOrden == numeroOrden &&
    other.clienteNombre == clienteNombre &&
    other.equipoTipo == equipoTipo &&
    other.marca == marca &&
    other.modelo == modelo &&
    other.problemaReportado == problemaReportado &&
    other.estado == estado &&
    other.prioridad == prioridad &&
    other.esGarantia == esGarantia &&
    other.tecnicoNombre == tecnicoNombre &&
    other.fechaRecepcion == fechaRecepcion &&
    other.createdAt == createdAt;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (ordenId.hashCode) +
    (numeroOrden.hashCode) +
    (clienteNombre == null ? 0 : clienteNombre!.hashCode) +
    (equipoTipo == null ? 0 : equipoTipo!.hashCode) +
    (marca.hashCode) +
    (modelo == null ? 0 : modelo!.hashCode) +
    (problemaReportado.hashCode) +
    (estado.hashCode) +
    (prioridad == null ? 0 : prioridad!.hashCode) +
    (esGarantia == null ? 0 : esGarantia!.hashCode) +
    (tecnicoNombre == null ? 0 : tecnicoNombre!.hashCode) +
    (fechaRecepcion == null ? 0 : fechaRecepcion!.hashCode) +
    (createdAt == null ? 0 : createdAt!.hashCode);

  @override
  String toString() => 'OrdenReparacion[ordenId=$ordenId, numeroOrden=$numeroOrden, clienteNombre=$clienteNombre, equipoTipo=$equipoTipo, marca=$marca, modelo=$modelo, problemaReportado=$problemaReportado, estado=$estado, prioridad=$prioridad, esGarantia=$esGarantia, tecnicoNombre=$tecnicoNombre, fechaRecepcion=$fechaRecepcion, createdAt=$createdAt]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'ordenId'] = this.ordenId;
      json[r'numeroOrden'] = this.numeroOrden;
    if (this.clienteNombre != null) {
      json[r'clienteNombre'] = this.clienteNombre;
    } else {
      json[r'clienteNombre'] = null;
    }
    if (this.equipoTipo != null) {
      json[r'equipoTipo'] = this.equipoTipo;
    } else {
      json[r'equipoTipo'] = null;
    }
      json[r'marca'] = this.marca;
    if (this.modelo != null) {
      json[r'modelo'] = this.modelo;
    } else {
      json[r'modelo'] = null;
    }
      json[r'problemaReportado'] = this.problemaReportado;
      json[r'estado'] = this.estado;
    if (this.prioridad != null) {
      json[r'prioridad'] = this.prioridad;
    } else {
      json[r'prioridad'] = null;
    }
    if (this.esGarantia != null) {
      json[r'esGarantia'] = this.esGarantia;
    } else {
      json[r'esGarantia'] = null;
    }
    if (this.tecnicoNombre != null) {
      json[r'tecnicoNombre'] = this.tecnicoNombre;
    } else {
      json[r'tecnicoNombre'] = null;
    }
    if (this.fechaRecepcion != null) {
      json[r'fechaRecepcion'] = this.fechaRecepcion!.toUtc().toIso8601String();
    } else {
      json[r'fechaRecepcion'] = null;
    }
    if (this.createdAt != null) {
      json[r'createdAt'] = this.createdAt!.toUtc().toIso8601String();
    } else {
      json[r'createdAt'] = null;
    }
    return json;
  }

  /// Returns a new [OrdenReparacion] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static OrdenReparacion? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "OrdenReparacion[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "OrdenReparacion[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return OrdenReparacion(
        ordenId: mapValueOfType<String>(json, r'ordenId')!,
        numeroOrden: mapValueOfType<int>(json, r'numeroOrden')!,
        clienteNombre: mapValueOfType<String>(json, r'clienteNombre'),
        equipoTipo: mapValueOfType<String>(json, r'equipoTipo'),
        marca: mapValueOfType<String>(json, r'marca')!,
        modelo: mapValueOfType<String>(json, r'modelo'),
        problemaReportado: mapValueOfType<String>(json, r'problemaReportado')!,
        estado: mapValueOfType<String>(json, r'estado')!,
        prioridad: mapValueOfType<String>(json, r'prioridad'),
        esGarantia: mapValueOfType<bool>(json, r'esGarantia'),
        tecnicoNombre: mapValueOfType<String>(json, r'tecnicoNombre'),
        fechaRecepcion: mapDateTime(json, r'fechaRecepcion', r''),
        createdAt: mapDateTime(json, r'createdAt', r''),
      );
    }
    return null;
  }

  static List<OrdenReparacion> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <OrdenReparacion>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = OrdenReparacion.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, OrdenReparacion> mapFromJson(dynamic json) {
    final map = <String, OrdenReparacion>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = OrdenReparacion.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of OrdenReparacion-objects as value to a dart map
  static Map<String, List<OrdenReparacion>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<OrdenReparacion>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = OrdenReparacion.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'ordenId',
    'numeroOrden',
    'marca',
    'problemaReportado',
    'estado',
  };
}

