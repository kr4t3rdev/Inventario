//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class SaleUpdateRequest {
  /// Returns a new [SaleUpdateRequest] instance.
  SaleUpdateRequest({
    this.observaciones,
    this.descuento,
  });

  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  String? observaciones;

  /// Minimum value: 0
  ///
  /// Please note: This property should have been non-nullable! Since the specification file
  /// does not include a default value (using the "default:" property), however, the generated
  /// source code must fall back to having a nullable type.
  /// Consider adding a "default:" property in the specification file to hide this note.
  ///
  num? descuento;

  @override
  bool operator ==(Object other) => identical(this, other) || other is SaleUpdateRequest &&
    other.observaciones == observaciones &&
    other.descuento == descuento;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (observaciones == null ? 0 : observaciones!.hashCode) +
    (descuento == null ? 0 : descuento!.hashCode);

  @override
  String toString() => 'SaleUpdateRequest[observaciones=$observaciones, descuento=$descuento]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
    if (this.observaciones != null) {
      json[r'observaciones'] = this.observaciones;
    } else {
      json[r'observaciones'] = null;
    }
    if (this.descuento != null) {
      json[r'descuento'] = this.descuento;
    } else {
      json[r'descuento'] = null;
    }
    return json;
  }

  /// Returns a new [SaleUpdateRequest] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static SaleUpdateRequest? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "SaleUpdateRequest[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "SaleUpdateRequest[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return SaleUpdateRequest(
        observaciones: mapValueOfType<String>(json, r'observaciones'),
        descuento: num.parse('${json[r'descuento']}'),
      );
    }
    return null;
  }

  static List<SaleUpdateRequest> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <SaleUpdateRequest>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = SaleUpdateRequest.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, SaleUpdateRequest> mapFromJson(dynamic json) {
    final map = <String, SaleUpdateRequest>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = SaleUpdateRequest.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of SaleUpdateRequest-objects as value to a dart map
  static Map<String, List<SaleUpdateRequest>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<SaleUpdateRequest>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = SaleUpdateRequest.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
  };
}

