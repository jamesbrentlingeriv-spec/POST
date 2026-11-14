package com.paloptical.post.models

data class PricingBreakdown(
    val frameRetail: Double,
    val frameInsurancePaid: Double,
    val framePatientCost: Double,
    val frameDiscount: Double,
    
    val baseLensCopay: Double,
    val progressiveCopay: Double,
    val arCopay: Double,
    val upgradesTotal: Double,
    
    val subtotalPatient: Double,
    val kySalesTax: Double,
    val totalDue: Double,
    
    val notes: String
)
