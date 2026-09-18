//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class GetAccountingAdvancesAvailableResponse {
  /// Returns a new [GetAccountingAdvancesAvailableResponse] instance.
  GetAccountingAdvancesAvailableResponse({
    this.anticipos = const [],
  });

  List<Advance> anticipos;

  @override
  bool operator ==(Object other) => identical(this, other) || other is GetAccountingAdvancesAvailableResponse &&
    _deepEquality.equals(other.anticipos, anticipos);

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (anticipos.hashCode);

  @override
  String toString() => 'GetAccountingAdvancesAvailableResponse[anticipos=$anticipos]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'anticipos'] = this.anticipos;
    return json;
  }

  /// Returns a new [GetAccountingAdvancesAvailableResponse] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static GetAccountingAdvancesAvailableResponse? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "GetAccountingAdvancesAvailableResponse[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "GetAccountingAdvancesAvailableResponse[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return GetAccountingAdvancesAvailableResponse(
        anticipos: Advance.listFromJson(json[r'anticipos']),
      );
    }
    return null;
  }

  static List<GetAccountingAdvancesAvailableResponse> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <GetAccountingAdvancesAvailableResponse>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = GetAccountingAdvancesAvailableResponse.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, GetAccountingAdvancesAvailableResponse> mapFromJson(dynamic json) {
    final map = <String, GetAccountingAdvancesAvailableResponse>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = GetAccountingAdvancesAvailableResponse.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of GetAccountingAdvancesAvailableResponse-objects as value to a dart map
  static Map<String, List<GetAccountingAdvancesAvailableResponse>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<GetAccountingAdvancesAvailableResponse>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = GetAccountingAdvancesAvailableResponse.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'anticipos',
  };
}

