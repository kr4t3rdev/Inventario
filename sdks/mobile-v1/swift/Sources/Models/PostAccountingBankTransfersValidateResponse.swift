// Generated from the mobile OpenAPI contract.
import Foundation
#if canImport(AnyCodable)
import AnyCodable
#endif

/** Response of POST /accounting/bank-transfers/validate. */
public struct PostAccountingBankTransfersValidateResponse: Codable, JSONEncodable, Hashable {
    public var saldoSuficiente: Bool?
    public var advertencias: [String]?

    public init(saldoSuficiente: Bool? = nil, advertencias: [String]? = nil) {
        self.saldoSuficiente = saldoSuficiente
        self.advertencias = advertencias
    }

    public enum CodingKeys: String, CodingKey, CaseIterable {
        case saldoSuficiente
        case advertencias
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(saldoSuficiente, forKey: .saldoSuficiente)
        try container.encodeIfPresent(advertencias, forKey: .advertencias)
    }
}
