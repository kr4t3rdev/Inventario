//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class GetAccountingAccountsReceivableMetricsResponse {
  /// Returns a new [GetAccountingAccountsReceivableMetricsResponse] instance.
  GetAccountingAccountsReceivableMetricsResponse({
    this.total,
    this.pendiente,
    this.pagado,
    this.vencido,
  });

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? total;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? pendiente;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? pagado;

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? vencido;

  @override
  bool operator ==(Object other) => identical(this, other) || other is GetAccountingAccountsReceivableMetricsResponse &&
    other.total == total &&
    other.pendiente == pendiente &&
    other.pagado == pagado &&
    other.vencido == vencido;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (total == null ? 0 : total!.hashCode) +
    (pendiente == null ? 0 : pendiente!.hashCode) +
    (pagado == null ? 0 : pagado!.hashCode) +
    (vencido == null ? 0 : vencido!.hashCode);

  @override
  String toString() => 'GetAccountingAccountsReceivableMetricsResponse[total=$total, pendiente=$pendiente, pagado=$pagado, vencido=$vencido]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
    if (this.total != null) {
      json[r'total'] = this.total;
    } else {
      json[r'total'] = null;
    }
    if (this.pendiente != null) {
      json[r'pendiente'] = this.pendiente;
    } else {
      json[r'pendiente'] = null;
    }
    if (this.pagado != null) {
      json[r'pagado'] = this.pagado;
    } else {
      json[r'pagado'] = null;
    }
    if (this.vencido != null) {
      json[r'vencido'] = this.vencido;
    } else {
      json[r'vencido'] = null;
    }
    return json;
  }

  /// Returns a new [GetAccountingAccountsReceivableMetricsResponse] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static GetAccountingAccountsReceivableMetricsResponse? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "GetAccountingAccountsReceivableMetricsResponse[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "GetAccountingAccountsReceivableMetricsResponse[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return GetAccountingAccountsReceivableMetricsResponse(
        total: num.parse('${json[r'total']}'),
        pendiente: num.parse('${json[r'pendiente']}'),
        pagado: num.parse('${json[r'pagado']}'),
        vencido: num.parse('${json[r'vencido']}'),
      );
    }
    return null;
  }

  static List<GetAccountingAccountsReceivableMetricsResponse> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <GetAccountingAccountsReceivableMetricsResponse>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = GetAccountingAccountsReceivableMetricsResponse.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, GetAccountingAccountsReceivableMetricsResponse> mapFromJson(dynamic json) {
    final map = <String, GetAccountingAccountsReceivableMetricsResponse>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = GetAccountingAccountsReceivableMetricsResponse.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of GetAccountingAccountsReceivableMetricsResponse-objects as value to a dart map
  static Map<String, List<GetAccountingAccountsReceivableMetricsResponse>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<GetAccountingAccountsReceivableMetricsResponse>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = GetAccountingAccountsReceivableMetricsResponse.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
  };
}

