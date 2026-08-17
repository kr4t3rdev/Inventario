// Generated from the mobile OpenAPI contract.
part of openapi.api;

class PostAccountingBankTransfersValidateResponse {
  PostAccountingBankTransfersValidateResponse({this.saldoSuficiente, this.advertencias});

  bool? saldoSuficiente;
  List<String>? advertencias;

  Map<String, dynamic> toJson() => {
    r'saldoSuficiente': saldoSuficiente,
    r'advertencias': advertencias,
  };

  static PostAccountingBankTransfersValidateResponse? fromJson(dynamic value) {
    if (value is! Map) return null;
    final json = value.cast<String, dynamic>();
    return PostAccountingBankTransfersValidateResponse(
      saldoSuficiente: mapValueOfType<bool>(json, r'saldoSuficiente'),
      advertencias: json[r'advertencias'] == null
        ? null
        : (json[r'advertencias'] as List).map((item) => item.toString()).toList(),
    );
  }
}
