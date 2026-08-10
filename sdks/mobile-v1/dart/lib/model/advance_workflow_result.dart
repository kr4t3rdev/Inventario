//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class AdvanceWorkflowResult {
  /// Returns a new [AdvanceWorkflowResult] instance.
  AdvanceWorkflowResult({
    this.anticipoId,
    this.movimientoId,
    this.documentoDestinoId,
    this.monto,
    this.saldoDisponible,
    this.estado,
  });

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? anticipoId;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? movimientoId;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? documentoDestinoId;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? monto;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? saldoDisponible;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? estado;

  @override
  bool operator ==(Object other) => identical(this, other) || other is AdvanceWorkflowResult &&
    other.anticipoId == anticipoId &&
    other.movimientoId == movimientoId &&
    other.documentoDestinoId == documentoDestinoId &&
    other.monto == monto &&
    other.saldoDisponible == saldoDisponible &&
    other.estado == estado;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (anticipoId == null ? 0 : anticipoId!.hashCode) +
    (movimientoId == null ? 0 : movimientoId!.hashCode) +
    (documentoDestinoId == null ? 0 : documentoDestinoId!.hashCode) +
    (monto == null ? 0 : monto!.hashCode) +
    (saldoDisponible == null ? 0 : saldoDisponible!.hashCode) +
    (estado == null ? 0 : estado!.hashCode);

  @override
  String toString() => 'AdvanceWorkflowResult[anticipoId=$anticipoId, movimientoId=$movimientoId, documentoDestinoId=$documentoDestinoId, monto=$monto, saldoDisponible=$saldoDisponible, estado=$estado]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
    if (this.anticipoId != null) {
      json[r'anticipoId'] = this.anticipoId;
    } else {
      json[r'anticipoId'] = null;
    }
    if (this.movimientoId != null) {
      json[r'movimientoId'] = this.movimientoId;
    } else {
      json[r'movimientoId'] = null;
    }
    if (this.documentoDestinoId != null) {
      json[r'documentoDestinoId'] = this.documentoDestinoId;
    } else {
      json[r'documentoDestinoId'] = null;
    }
    if (this.monto != null) {
      json[r'monto'] = this.monto;
    } else {
      json[r'monto'] = null;
    }
    if (this.saldoDisponible != null) {
      json[r'saldoDisponible'] = this.saldoDisponible;
    } else {
      json[r'saldoDisponible'] = null;
    }
    if (this.estado != null) {
      json[r'estado'] = this.estado;
    } else {
      json[r'estado'] = null;
    }
    return json;
  }

  /// Returns a new [AdvanceWorkflowResult] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static AdvanceWorkflowResult? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "AdvanceWorkflowResult[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "AdvanceWorkflowResult[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return AdvanceWorkflowResult(
        anticipoId: mapValueOfType<String>(json, r'anticipoId'),
        movimientoId: mapValueOfType<String>(json, r'movimientoId'),
        documentoDestinoId: mapValueOfType<String>(json, r'documentoDestinoId'),
        monto: num.parse('${json[r'monto']}'),
        saldoDisponible: num.parse('${json[r'saldoDisponible']}'),
        estado: mapValueOfType<String>(json, r'estado'),
      );
    }
    return null;
  }

  static List<AdvanceWorkflowResult> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <AdvanceWorkflowResult>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = AdvanceWorkflowResult.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, AdvanceWorkflowResult> mapFromJson(dynamic json) {
    final map = <String, AdvanceWorkflowResult>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = AdvanceWorkflowResult.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of AdvanceWorkflowResult-objects as value to a dart map
  static Map<String, List<AdvanceWorkflowResult>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<AdvanceWorkflowResult>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = AdvanceWorkflowResult.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
  };
}

