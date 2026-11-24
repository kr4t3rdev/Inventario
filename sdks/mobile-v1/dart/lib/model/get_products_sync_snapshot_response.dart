//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class GetProductsSyncSnapshotResponse {
  /// Returns a new [GetProductsSyncSnapshotResponse] instance.
  GetProductsSyncSnapshotResponse({
    this.items = const [],
    required this.nextPageToken,
    required this.changesCursor,
  });

  List<MobileSyncProduct> items;

  /// Token opaco para continuar el snapshot; nulo al llegar a la última página.
  String? nextPageToken;

  /// Cursor de cambios con el watermark capturado al iniciar el snapshot.
  String changesCursor;

  @override
  bool operator ==(Object other) => identical(this, other) || other is GetProductsSyncSnapshotResponse &&
    _deepEquality.equals(other.items, items) &&
    other.nextPageToken == nextPageToken &&
    other.changesCursor == changesCursor;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (items.hashCode) +
    (nextPageToken == null ? 0 : nextPageToken!.hashCode) +
    (changesCursor.hashCode);

  @override
  String toString() => 'GetProductsSyncSnapshotResponse[items=$items, nextPageToken=$nextPageToken, changesCursor=$changesCursor]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'items'] = this.items;
    if (this.nextPageToken != null) {
      json[r'nextPageToken'] = this.nextPageToken;
    } else {
      json[r'nextPageToken'] = null;
    }
      json[r'changesCursor'] = this.changesCursor;
    return json;
  }

  /// Returns a new [GetProductsSyncSnapshotResponse] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static GetProductsSyncSnapshotResponse? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      // Ensure that the map contains the required keys.
      // Note 1: the values aren't checked for validity beyond being non-null.
      // Note 2: this code is stripped in release mode!
      assert(() {
        requiredKeys.forEach((key) {
          assert(json.containsKey(key), 'Required key "GetProductsSyncSnapshotResponse[$key]" is missing from JSON.');
          assert(json[key] != null, 'Required key "GetProductsSyncSnapshotResponse[$key]" has a null value in JSON.');
        });
        return true;
      }());

      return GetProductsSyncSnapshotResponse(
        items: MobileSyncProduct.listFromJson(json[r'items']),
        nextPageToken: mapValueOfType<String>(json, r'nextPageToken'),
        changesCursor: mapValueOfType<String>(json, r'changesCursor')!,
      );
    }
    return null;
  }

  static List<GetProductsSyncSnapshotResponse> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <GetProductsSyncSnapshotResponse>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = GetProductsSyncSnapshotResponse.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, GetProductsSyncSnapshotResponse> mapFromJson(dynamic json) {
    final map = <String, GetProductsSyncSnapshotResponse>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = GetProductsSyncSnapshotResponse.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of GetProductsSyncSnapshotResponse-objects as value to a dart map
  static Map<String, List<GetProductsSyncSnapshotResponse>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<GetProductsSyncSnapshotResponse>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = GetProductsSyncSnapshotResponse.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'items',
    'nextPageToken',
    'changesCursor',
  };
}

