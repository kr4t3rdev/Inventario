//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class BankTransferCreateRequest {
  /// Returns a new [BankTransferCreateRequest] instance.
  BankTransferCreateRequest({
    required this.cuentaOrigenId,
    required this.cuentaDestinoId,
    required this.montoOrigen,
    this.montoDestino,
    required this.motivo,
    this.descripcion,
    this.tasaCambio,
    this.monedaPrincipal,
  });

  String cuentaOrigenId;

  String cuentaDestinoId;

  num montoOrigen;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? montoDestino;

  String motivo;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? descripcion;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? tasaCambio;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? monedaPrincipal;

  @override
  bool operator ==(Object other) => identical(this, other) || other is BankTransferCreateRequest &&
    other.cuentaOrigenId == cuentaOrigenId &&
    other.cuentaDestinoId == cuentaDestinoId &&
    other.montoOrigen == montoOrigen &&
    other.montoDestino == montoDestino &&
    other.motivo == motivo &&
    other.descripcion == descripcion &&
    other.tasaCambio == tasaCambio &&
    other.monedaPrincipal == monedaPrincipal;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (cuentaOrigenId.hashCode) +
    (cuentaDestinoId.hashCode) +
    (montoOrigen.hashCode) +
    (montoDestino == null ? 0 : montoDestino!.hashCode) +
    (motivo.hashCode) +
    (descripcion == null ? 0 : descripcion!.hashCode) +
    (tasaCambio == null ? 0 : tasaCambio!.hashCode) +
    (monedaPrincipal == null ? 0 : monedaPrincipal!.hashCode);

  @override
  String toString() => 'BankTransferCreateRequest[cuentaOrigenId=$cuentaOrigenId, cuentaDestinoId=$cuentaDestinoId, montoOrigen=$montoOrigen, montoDestino=$montoDestino, motivo=$motivo, descripcion=$descripcion, tasaCambio=$tasaCambio, monedaPrincipal=$monedaPrincipal]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'cuentaOrigenId'] = this.cuentaOrigenId;
      json[r'cuentaDestinoId'] = this.cuentaDestinoId;
      json[r'montoOrigen'] = this.montoOrigen;
    if (this.montoDestino != null) {
      json[r'montoDestino'] = this.montoDestino;
    } else {
      json[r'montoDestino'] = null;
    }
      json[r'motivo'] = this.motivo;
    if (this.descripcion != null) {
      json[r'descripcion'] = this.descripcion;
    } else {
      json[r'descripcion'] = null;
    }
    if (this.tasaCambio != null) {
      json[r'tasaCambio'] = this.tasaCambio;
    } else {
      json[r'tasaCambio'] = null;
    }
    if (this.monedaPrincipal != null) {
      json[r'monedaPrincipal'] = this.monedaPrincipal;
    } else {
      json[r'monedaPrincipal'] = null;
    }
    return json;
  }

  /// Returns a new [BankTransferCreateRequest] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static BankTransferCreateRequest? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "BankTransferCreateRequest[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "BankTransferCreateRequest[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return BankTransferCreateRequest(
        cuentaOrigenId: mapValueOfType<String>(json, r'cuentaOrigenId')!,
        cuentaDestinoId: mapValueOfType<String>(json, r'cuentaDestinoId')!,
        montoOrigen: num.parse('${json[r'montoOrigen']}'),
        montoDestino: num.parse('${json[r'montoDestino']}'),
        motivo: mapValueOfType<String>(json, r'motivo')!,
        descripcion: mapValueOfType<String>(json, r'descripcion'),
        tasaCambio: num.parse('${json[r'tasaCambio']}'),
        monedaPrincipal: mapValueOfType<String>(json, r'monedaPrincipal'),
      );
    }
    return null;
  }

  static List<BankTransferCreateRequest> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <BankTransferCreateRequest>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = BankTransferCreateRequest.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, BankTransferCreateRequest> mapFromJson(dynamic json) {
    final map = <String, BankTransferCreateRequest>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = BankTransferCreateRequest.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of BankTransferCreateRequest-objects as value to a dart map
  static Map<String, List<BankTransferCreateRequest>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<BankTransferCreateRequest>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = BankTransferCreateRequest.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'cuentaOrigenId',
    'cuentaDestinoId',
    'montoOrigen',
    'motivo',
  };
}

