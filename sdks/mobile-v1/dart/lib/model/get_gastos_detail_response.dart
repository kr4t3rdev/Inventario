//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class GetGastosDetailResponse {
  /// Returns a new [GetGastosDetailResponse] instance.
  GetGastosDetailResponse({
    required this.gasto,
  });

  Gasto gasto;

  @override
  bool operator ==(Object other) => identical(this, other) || other is GetGastosDetailResponse &&
    other.gasto == gasto;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (gasto.hashCode);

  @override
  String toString() => 'GetGastosDetailResponse[gasto=$gasto]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'gasto'] = this.gasto;
    return json;
  }

  /// Returns a new [GetGastosDetailResponse] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static GetGastosDetailResponse? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "GetGastosDetailResponse[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "GetGastosDetailResponse[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return GetGastosDetailResponse(
        gasto: Gasto.fromJson(json[r'gasto'])!,
      );
    }
    return null;
  }

  static List<GetGastosDetailResponse> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <GetGastosDetailResponse>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = GetGastosDetailResponse.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, GetGastosDetailResponse> mapFromJson(dynamic json) {
    final map = <String, GetGastosDetailResponse>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = GetGastosDetailResponse.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of GetGastosDetailResponse-objects as value to a dart map
  static Map<String, List<GetGastosDetailResponse>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<GetGastosDetailResponse>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = GetGastosDetailResponse.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'gasto',
  };
}

