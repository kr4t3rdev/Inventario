//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class BankTransferValidationRequest {
  /// Returns a new [BankTransferValidationRequest] instance.
  BankTransferValidationRequest({
    required this.cuentaOrigenId,
    required this.cuentaDestinoId,
    required this.monto,
    required this.motivo,
    this.descripcion,
  });

  String cuentaOrigenId;

  String cuentaDestinoId;

  num monto;

  String motivo;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? descripcion;

  @override
  bool operator ==(Object other) => identical(this, other) || other is BankTransferValidationRequest &&
    other.cuentaOrigenId == cuentaOrigenId &&
    other.cuentaDestinoId == cuentaDestinoId &&
    other.monto == monto &&
    other.motivo == motivo &&
    other.descripcion == descripcion;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (cuentaOrigenId.hashCode) +
    (cuentaDestinoId.hashCode) +
    (monto.hashCode) +
    (motivo.hashCode) +
    (descripcion == null ? 0 : descripcion!.hashCode);

  @override
  String toString() => 'BankTransferValidationRequest[cuentaOrigenId=$cuentaOrigenId, cuentaDestinoId=$cuentaDestinoId, monto=$monto, motivo=$motivo, descripcion=$descripcion]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'cuentaOrigenId'] = this.cuentaOrigenId;
      json[r'cuentaDestinoId'] = this.cuentaDestinoId;
      json[r'monto'] = this.monto;
      json[r'motivo'] = this.motivo;
    if (this.descripcion != null) {
      json[r'descripcion'] = this.descripcion;
    } else {
      json[r'descripcion'] = null;
    }
    return json;
  }

  /// Returns a new [BankTransferValidationRequest] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static BankTransferValidationRequest? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "BankTransferValidationRequest[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "BankTransferValidationRequest[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return BankTransferValidationRequest(
        cuentaOrigenId: mapValueOfType<String>(json, r'cuentaOrigenId')!,
        cuentaDestinoId: mapValueOfType<String>(json, r'cuentaDestinoId')!,
        monto: num.parse('${json[r'monto']}'),
        motivo: mapValueOfType<String>(json, r'motivo')!,
        descripcion: mapValueOfType<String>(json, r'descripcion'),
      );
    }
    return null;
  }

  static List<BankTransferValidationRequest> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <BankTransferValidationRequest>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = BankTransferValidationRequest.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, BankTransferValidationRequest> mapFromJson(dynamic json) {
    final map = <String, BankTransferValidationRequest>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = BankTransferValidationRequest.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of BankTransferValidationRequest-objects as value to a dart map
  static Map<String, List<BankTransferValidationRequest>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<BankTransferValidationRequest>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = BankTransferValidationRequest.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'cuentaOrigenId',
    'cuentaDestinoId',
    'monto',
    'motivo',
  };
}

