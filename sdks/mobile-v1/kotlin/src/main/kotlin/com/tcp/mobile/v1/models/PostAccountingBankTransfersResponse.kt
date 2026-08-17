/**
 * Response of POST /accounting/bank-transfers.
 * Generated from the mobile OpenAPI contract.
 */
@file:Suppress("UnusedImport")
package com.tcp.mobile.v1.models

import com.fasterxml.jackson.annotation.JsonProperty

data class PostAccountingBankTransfersResponse (
    @get:JsonProperty("transferencia")
    val transferencia: BankTransfer? = null,
    @get:JsonProperty("numeroComprobante")
    val numeroComprobante: kotlin.String? = null
)
