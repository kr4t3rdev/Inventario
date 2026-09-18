//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class PayableAccountSummary {
  /// Returns a new [PayableAccountSummary] instance.
  PayableAccountSummary({
    this.cuentaPorPagarId,
    this.estado,
    this.montoPagado,
    this.saldoPendiente,
  });

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? cuentaPorPagarId;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? estado;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? montoPagado;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? saldoPendiente;

  @override
  bool operator ==(Object other) => identical(this, other) || other is PayableAccountSummary &&
    other.cuentaPorPagarId == cuentaPorPagarId &&
    other.estado == estado &&
    other.montoPagado == montoPagado &&
    other.saldoPendiente == saldoPendiente;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (cuentaPorPagarId == null ? 0 : cuentaPorPagarId!.hashCode) +
    (estado == null ? 0 : estado!.hashCode) +
    (montoPagado == null ? 0 : montoPagado!.hashCode) +
    (saldoPendiente == null ? 0 : saldoPendiente!.hashCode);

  @override
  String toString() => 'PayableAccountSummary[cuentaPorPagarId=$cuentaPorPagarId, estado=$estado, montoPagado=$montoPagado, saldoPendiente=$saldoPendiente]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
    if (this.cuentaPorPagarId != null) {
      json[r'cuentaPorPagarId'] = this.cuentaPorPagarId;
    } else {
      json[r'cuentaPorPagarId'] = null;
    }
    if (this.estado != null) {
      json[r'estado'] = this.estado;
    } else {
      json[r'estado'] = null;
    }
    if (this.montoPagado != null) {
      json[r'montoPagado'] = this.montoPagado;
    } else {
      json[r'montoPagado'] = null;
    }
    if (this.saldoPendiente != null) {
      json[r'saldoPendiente'] = this.saldoPendiente;
    } else {
      json[r'saldoPendiente'] = null;
    }
    return json;
  }

  /// Returns a new [PayableAccountSummary] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static PayableAccountSummary? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "PayableAccountSummary[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "PayableAccountSummary[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return PayableAccountSummary(
        cuentaPorPagarId: mapValueOfType<String>(json, r'cuentaPorPagarId'),
        estado: mapValueOfType<String>(json, r'estado'),
        montoPagado: num.parse('${json[r'montoPagado']}'),
        saldoPendiente: num.parse('${json[r'saldoPendiente']}'),
      );
    }
    return null;
  }

  static List<PayableAccountSummary> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <PayableAccountSummary>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = PayableAccountSummary.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, PayableAccountSummary> mapFromJson(dynamic json) {
    final map = <String, PayableAccountSummary>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = PayableAccountSummary.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of PayableAccountSummary-objects as value to a dart map
  static Map<String, List<PayableAccountSummary>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<PayableAccountSummary>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = PayableAccountSummary.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
  };
}

