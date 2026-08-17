// Generated from the mobile OpenAPI contract.
part of openapi.api;

class PostAccountingBankTransfersResponse {
  PostAccountingBankTransfersResponse({this.transferencia, this.numeroComprobante});

  BankTransfer? transferencia;
  String? numeroComprobante;

  Map<String, dynamic> toJson() => {
    r'transferencia': transferencia,
    r'numeroComprobante': numeroComprobante,
  };

  static PostAccountingBankTransfersResponse? fromJson(dynamic value) {
    if (value is! Map) return null;
    final json = value.cast<String, dynamic>();
    return PostAccountingBankTransfersResponse(
      transferencia: BankTransfer.fromJson(json[r'transferencia']),
      numeroComprobante: mapValueOfType<String>(json, r'numeroComprobante'),
    );
  }
}
