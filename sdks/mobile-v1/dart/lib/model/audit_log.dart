//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class AuditLog {
  /// Returns a new [AuditLog] instance.
  AuditLog({
    this.id,
    this.accion,
    this.entidad,
    this.entidadId,
    this.usuarioId,
    this.createdAt,
  });

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? id;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? accion;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? entidad;

  String? entidadId;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? usuarioId;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  DateTime? createdAt;

  @override
  bool operator ==(Object other) => identical(this, other) || other is AuditLog &&
    other.id == id &&
    other.accion == accion &&
    other.entidad == entidad &&
    other.entidadId == entidadId &&
    other.usuarioId == usuarioId &&
    other.createdAt == createdAt;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (id == null ? 0 : id!.hashCode) +
    (accion == null ? 0 : accion!.hashCode) +
    (entidad == null ? 0 : entidad!.hashCode) +
    (entidadId == null ? 0 : entidadId!.hashCode) +
    (usuarioId == null ? 0 : usuarioId!.hashCode) +
    (createdAt == null ? 0 : createdAt!.hashCode);

  @override
  String toString() => 'AuditLog[id=$id, accion=$accion, entidad=$entidad, entidadId=$entidadId, usuarioId=$usuarioId, createdAt=$createdAt]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
    if (this.id != null) {
      json[r'id'] = this.id;
    } else {
      json[r'id'] = null;
    }
    if (this.accion != null) {
      json[r'accion'] = this.accion;
    } else {
      json[r'accion'] = null;
    }
    if (this.entidad != null) {
      json[r'entidad'] = this.entidad;
    } else {
      json[r'entidad'] = null;
    }
    if (this.entidadId != null) {
      json[r'entidadId'] = this.entidadId;
    } else {
      json[r'entidadId'] = null;
    }
    if (this.usuarioId != null) {
      json[r'usuarioId'] = this.usuarioId;
    } else {
      json[r'usuarioId'] = null;
    }
    if (this.createdAt != null) {
      json[r'createdAt'] = this.createdAt!.toUtc().toIso8601String();
    } else {
      json[r'createdAt'] = null;
    }
    return json;
  }

  /// Returns a new [AuditLog] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static AuditLog? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "AuditLog[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "AuditLog[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return AuditLog(
        id: mapValueOfType<String>(json, r'id'),
        accion: mapValueOfType<String>(json, r'accion'),
        entidad: mapValueOfType<String>(json, r'entidad'),
        entidadId: mapValueOfType<String>(json, r'entidadId'),
        usuarioId: mapValueOfType<String>(json, r'usuarioId'),
        createdAt: mapDateTime(json, r'createdAt', r''),
      );
    }
    return null;
  }

  static List<AuditLog> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <AuditLog>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = AuditLog.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, AuditLog> mapFromJson(dynamic json) {
    final map = <String, AuditLog>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = AuditLog.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of AuditLog-objects as value to a dart map
  static Map<String, List<AuditLog>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<AuditLog>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = AuditLog.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
  };
}

