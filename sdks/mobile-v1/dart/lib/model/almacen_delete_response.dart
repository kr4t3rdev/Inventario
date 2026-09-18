//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class AlmacenDeleteResponse {
  /// Returns a new [AlmacenDeleteResponse] instance.
  AlmacenDeleteResponse({
    required this.id,
    required this.eliminado,
  });

  String id;

  bool eliminado;

  @override
  bool operator ==(Object other) => identical(this, other) || other is AlmacenDeleteResponse &&
    other.id == id &&
    other.eliminado == eliminado;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (id.hashCode) +
    (eliminado.hashCode);

  @override
  String toString() => 'AlmacenDeleteResponse[id=$id, eliminado=$eliminado]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'id'] = this.id;
      json[r'eliminado'] = this.eliminado;
    return json;
  }

  /// Returns a new [AlmacenDeleteResponse] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static AlmacenDeleteResponse? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "AlmacenDeleteResponse[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "AlmacenDeleteResponse[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return AlmacenDeleteResponse(
        id: mapValueOfType<String>(json, r'id')!,
        eliminado: mapValueOfType<bool>(json, r'eliminado')!,
      );
    }
    return null;
  }

  static List<AlmacenDeleteResponse> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <AlmacenDeleteResponse>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = AlmacenDeleteResponse.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, AlmacenDeleteResponse> mapFromJson(dynamic json) {
    final map = <String, AlmacenDeleteResponse>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = AlmacenDeleteResponse.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of AlmacenDeleteResponse-objects as value to a dart map
  static Map<String, List<AlmacenDeleteResponse>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<AlmacenDeleteResponse>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = AlmacenDeleteResponse.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'id',
    'eliminado',
  };
}

