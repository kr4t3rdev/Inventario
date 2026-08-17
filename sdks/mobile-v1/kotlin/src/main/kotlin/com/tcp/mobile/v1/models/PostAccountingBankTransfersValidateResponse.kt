/**
 * Response of POST /accounting/bank-transfers/validate.
 * Generated from the mobile OpenAPI contract.
 */
@file:Suppress("UnusedImport")
package com.tcp.mobile.v1.models

import com.fasterxml.jackson.annotation.JsonProperty

data class PostAccountingBankTransfersValidateResponse (
    @get:JsonProperty("saldoSuficiente")
    val saldoSuficiente: kotlin.Boolean? = null,
    @get:JsonProperty("advertencias")
    val advertencias: kotlin.collections.List<kotlin.String>? = null
)
