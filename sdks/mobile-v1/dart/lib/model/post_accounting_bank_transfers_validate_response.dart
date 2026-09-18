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
    required this.saldoSuficiente,
    this.advertencias = const [],
  });

  bool saldoSuficiente;

  List<String> advertencias;

  @override
  bool operator ==(Object other) => identical(this, other) || other is PostAccountingBankTransfersValidateResponse &&
    other.saldoSuficiente == saldoSuficiente &&
    _deepEquality.equals(other.advertencias, advertencias);

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (saldoSuficiente.hashCode) +
    (advertencias.hashCode);

  @override
  String toString() => 'PostAccountingBankTransfersValidateResponse[saldoSuficiente=$saldoSuficiente, advertencias=$advertencias]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'saldoSuficiente'] = this.saldoSuficiente;
      json[r'advertencias'] = this.advertencias;
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
        saldoSuficiente: mapValueOfType<bool>(json, r'saldoSuficiente')!,
        advertencias: json[r'advertencias'] is Iterable
            ? (json[r'advertencias'] as Iterable).cast<String>().toList(growable: false)
            : const [],
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
    'saldoSuficiente',
    'advertencias',
  };
}

