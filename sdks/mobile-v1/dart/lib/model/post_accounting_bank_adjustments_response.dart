//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class PostAccountingBankAdjustmentsResponse {
  /// Returns a new [PostAccountingBankAdjustmentsResponse] instance.
  PostAccountingBankAdjustmentsResponse({
    required this.ajuste,
    required this.saldoAnterior,
    required this.saldoNuevo,
    required this.advertenciaSaldoNegativo,
    required this.message,
  });

  AjusteBancario ajuste;

  num saldoAnterior;

  num saldoNuevo;

  bool advertenciaSaldoNegativo;

  String message;

  @override
  bool operator ==(Object other) => identical(this, other) || other is PostAccountingBankAdjustmentsResponse &&
    other.ajuste == ajuste &&
    other.saldoAnterior == saldoAnterior &&
    other.saldoNuevo == saldoNuevo &&
    other.advertenciaSaldoNegativo == advertenciaSaldoNegativo &&
    other.message == message;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (ajuste.hashCode) +
    (saldoAnterior.hashCode) +
    (saldoNuevo.hashCode) +
    (advertenciaSaldoNegativo.hashCode) +
    (message.hashCode);

  @override
  String toString() => 'PostAccountingBankAdjustmentsResponse[ajuste=$ajuste, saldoAnterior=$saldoAnterior, saldoNuevo=$saldoNuevo, advertenciaSaldoNegativo=$advertenciaSaldoNegativo, message=$message]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'ajuste'] = this.ajuste;
      json[r'saldoAnterior'] = this.saldoAnterior;
      json[r'saldoNuevo'] = this.saldoNuevo;
      json[r'advertenciaSaldoNegativo'] = this.advertenciaSaldoNegativo;
      json[r'message'] = this.message;
    return json;
  }

  /// Returns a new [PostAccountingBankAdjustmentsResponse] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static PostAccountingBankAdjustmentsResponse? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "PostAccountingBankAdjustmentsResponse[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "PostAccountingBankAdjustmentsResponse[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return PostAccountingBankAdjustmentsResponse(
        ajuste: AjusteBancario.fromJson(json[r'ajuste'])!,
        saldoAnterior: num.parse('${json[r'saldoAnterior']}'),
        saldoNuevo: num.parse('${json[r'saldoNuevo']}'),
        advertenciaSaldoNegativo: mapValueOfType<bool>(json, r'advertenciaSaldoNegativo')!,
        message: mapValueOfType<String>(json, r'message')!,
      );
    }
    return null;
  }

  static List<PostAccountingBankAdjustmentsResponse> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <PostAccountingBankAdjustmentsResponse>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = PostAccountingBankAdjustmentsResponse.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, PostAccountingBankAdjustmentsResponse> mapFromJson(dynamic json) {
    final map = <String, PostAccountingBankAdjustmentsResponse>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = PostAccountingBankAdjustmentsResponse.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of PostAccountingBankAdjustmentsResponse-objects as value to a dart map
  static Map<String, List<PostAccountingBankAdjustmentsResponse>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<PostAccountingBankAdjustmentsResponse>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = PostAccountingBankAdjustmentsResponse.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'ajuste',
    'saldoAnterior',
    'saldoNuevo',
    'advertenciaSaldoNegativo',
    'message',
  };
}

