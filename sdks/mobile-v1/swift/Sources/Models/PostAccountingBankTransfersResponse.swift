// Generated from the mobile OpenAPI contract.
import Foundation
#if canImport(AnyCodable)
import AnyCodable
#endif

/** Response of POST /accounting/bank-transfers. */
public struct PostAccountingBankTransfersResponse: Codable, JSONEncodable, Hashable {
    public var transferencia: BankTransfer?
    public var numeroComprobante: String?

    public init(transferencia: BankTransfer? = nil, numeroComprobante: String? = nil) {
        self.transferencia = transferencia
        self.numeroComprobante = numeroComprobante
    }

    public enum CodingKeys: String, CodingKey, CaseIterable {
        case transferencia
        case numeroComprobante
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(transferencia, forKey: .transferencia)
        try container.encodeIfPresent(numeroComprobante, forKey: .numeroComprobante)
    }
}
