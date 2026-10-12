//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class GetContratosDetailResponse {
  /// Returns a new [GetContratosDetailResponse] instance.
  GetContratosDetailResponse({
    required this.contrato,
  });

  Contrato contrato;

  @override
  bool operator ==(Object other) => identical(this, other) || other is GetContratosDetailResponse &&
    other.contrato == contrato;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (contrato.hashCode);

  @override
  String toString() => 'GetContratosDetailResponse[contrato=$contrato]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'contrato'] = this.contrato;
    return json;
  }

  /// Returns a new [GetContratosDetailResponse] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static GetContratosDetailResponse? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "GetContratosDetailResponse[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "GetContratosDetailResponse[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return GetContratosDetailResponse(
        contrato: Contrato.fromJson(json[r'contrato'])!,
      );
    }
    return null;
  }

  static List<GetContratosDetailResponse> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <GetContratosDetailResponse>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = GetContratosDetailResponse.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, GetContratosDetailResponse> mapFromJson(dynamic json) {
    final map = <String, GetContratosDetailResponse>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = GetContratosDetailResponse.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of GetContratosDetailResponse-objects as value to a dart map
  static Map<String, List<GetContratosDetailResponse>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<GetContratosDetailResponse>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = GetContratosDetailResponse.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'contrato',
  };
}

