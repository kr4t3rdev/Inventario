//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class PostAccountingBankTransfersValidateResponse {
  /// Returns a new [PostAccountingBankTransfersValidateResponse] instance.
  PostAccountingBankTransfersValidateResponse({
    this.transferenciaId,
    this.cuentaOrigenId,
    this.cuentaDestinoId,
    this.montoOrigen,
    this.montoDestino,
    this.tasaCambio,
    this.motivo,
    this.descripcion,
  });

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? transferenciaId;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? cuentaOrigenId;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? cuentaDestinoId;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? montoOrigen;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? montoDestino;

  num? tasaCambio;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? motivo;

  String? descripcion;

  @override
  bool operator ==(Object other) => identical(this, other) || other is PostAccountingBankTransfersValidateResponse &&
    other.transferenciaId == transferenciaId &&
    other.cuentaOrigenId == cuentaOrigenId &&
    other.cuentaDestinoId == cuentaDestinoId &&
    other.montoOrigen == montoOrigen &&
    other.montoDestino == montoDestino &&
    other.tasaCambio == tasaCambio &&
    other.motivo == motivo &&
    other.descripcion == descripcion;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (transferenciaId == null ? 0 : transferenciaId!.hashCode) +
    (cuentaOrigenId == null ? 0 : cuentaOrigenId!.hashCode) +
    (cuentaDestinoId == null ? 0 : cuentaDestinoId!.hashCode) +
    (montoOrigen == null ? 0 : montoOrigen!.hashCode) +
    (montoDestino == null ? 0 : montoDestino!.hashCode) +
    (tasaCambio == null ? 0 : tasaCambio!.hashCode) +
    (motivo == null ? 0 : motivo!.hashCode) +
    (descripcion == null ? 0 : descripcion!.hashCode);

  @override
  String toString() => 'PostAccountingBankTransfersValidateResponse[transferenciaId=$transferenciaId, cuentaOrigenId=$cuentaOrigenId, cuentaDestinoId=$cuentaDestinoId, montoOrigen=$montoOrigen, montoDestino=$montoDestino, tasaCambio=$tasaCambio, motivo=$motivo, descripcion=$descripcion]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
    if (this.transferenciaId != null) {
      json[r'transferenciaId'] = this.transferenciaId;
    } else {
      json[r'transferenciaId'] = null;
    }
    if (this.cuentaOrigenId != null) {
      json[r'cuentaOrigenId'] = this.cuentaOrigenId;
    } else {
      json[r'cuentaOrigenId'] = null;
    }
    if (this.cuentaDestinoId != null) {
      json[r'cuentaDestinoId'] = this.cuentaDestinoId;
    } else {
      json[r'cuentaDestinoId'] = null;
    }
    if (this.montoOrigen != null) {
      json[r'montoOrigen'] = this.montoOrigen;
    } else {
      json[r'montoOrigen'] = null;
    }
    if (this.montoDestino != null) {
      json[r'montoDestino'] = this.montoDestino;
    } else {
      json[r'montoDestino'] = null;
    }
    if (this.tasaCambio != null) {
      json[r'tasaCambio'] = this.tasaCambio;
    } else {
      json[r'tasaCambio'] = null;
    }
    if (this.motivo != null) {
      json[r'motivo'] = this.motivo;
    } else {
      json[r'motivo'] = null;
    }
    if (this.descripcion != null) {
      json[r'descripcion'] = this.descripcion;
    } else {
      json[r'descripcion'] = null;
    }
    return json;
  }

  /// Returns a new [PostAccountingBankTransfersValidateResponse] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static PostAccountingBankTransfersValidateResponse? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "PostAccountingBankTransfersValidateResponse[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "PostAccountingBankTransfersValidateResponse[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return PostAccountingBankTransfersValidateResponse(
        transferenciaId: mapValueOfType<String>(json, r'transferenciaId'),
        cuentaOrigenId: mapValueOfType<String>(json, r'cuentaOrigenId'),
        cuentaDestinoId: mapValueOfType<String>(json, r'cuentaDestinoId'),
        montoOrigen: num.parse('${json[r'montoOrigen']}'),
        montoDestino: num.parse('${json[r'montoDestino']}'),
        tasaCambio: json[r'tasaCambio'] == null
            ? null
            : num.parse('${json[r'tasaCambio']}'),
        motivo: mapValueOfType<String>(json, r'motivo'),
        descripcion: mapValueOfType<String>(json, r'descripcion'),
      );
    }
    return null;
  }

  static List<PostAccountingBankTransfersValidateResponse> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <PostAccountingBankTransfersValidateResponse>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = PostAccountingBankTransfersValidateResponse.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, PostAccountingBankTransfersValidateResponse> mapFromJson(dynamic json) {
    final map = <String, PostAccountingBankTransfersValidateResponse>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = PostAccountingBankTransfersValidateResponse.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of PostAccountingBankTransfersValidateResponse-objects as value to a dart map
  static Map<String, List<PostAccountingBankTransfersValidateResponse>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<PostAccountingBankTransfersValidateResponse>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = PostAccountingBankTransfersValidateResponse.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
  };
}

