package com.paloptical.post.models

data class InsuranceBenefitResult(
    val carrierName: String,
    val isActive: Boolean,
    val statusMessage: String,
    val frameAllowance: Double,
    val progressiveCopay: Double,
    val arCopay: Double,
    val isTerminatedOrFuture: Boolean,
    val cautionMessage: String? = null
)
