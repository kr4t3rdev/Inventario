//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class PostAccountingBankTransfersResponse {
  /// Returns a new [PostAccountingBankTransfersResponse] instance.
  PostAccountingBankTransfersResponse({
    required this.transferencia,
    required this.numeroComprobante,
  });

  BankTransfer transferencia;

  String numeroComprobante;

  @override
  bool operator ==(Object other) => identical(this, other) || other is PostAccountingBankTransfersResponse &&
    other.transferencia == transferencia &&
    other.numeroComprobante == numeroComprobante;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (transferencia.hashCode) +
    (numeroComprobante.hashCode);

  @override
  String toString() => 'PostAccountingBankTransfersResponse[transferencia=$transferencia, numeroComprobante=$numeroComprobante]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'transferencia'] = this.transferencia;
      json[r'numeroComprobante'] = this.numeroComprobante;
    return json;
  }

  /// Returns a new [PostAccountingBankTransfersResponse] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static PostAccountingBankTransfersResponse? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "PostAccountingBankTransfersResponse[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "PostAccountingBankTransfersResponse[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return PostAccountingBankTransfersResponse(
        transferencia: BankTransfer.fromJson(json[r'transferencia'])!,
        numeroComprobante: mapValueOfType<String>(json, r'numeroComprobante')!,
      );
    }
    return null;
  }

  static List<PostAccountingBankTransfersResponse> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <PostAccountingBankTransfersResponse>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = PostAccountingBankTransfersResponse.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, PostAccountingBankTransfersResponse> mapFromJson(dynamic json) {
    final map = <String, PostAccountingBankTransfersResponse>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = PostAccountingBankTransfersResponse.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of PostAccountingBankTransfersResponse-objects as value to a dart map
  static Map<String, List<PostAccountingBankTransfersResponse>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<PostAccountingBankTransfersResponse>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = PostAccountingBankTransfersResponse.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'transferencia',
    'numeroComprobante',
  };
}

