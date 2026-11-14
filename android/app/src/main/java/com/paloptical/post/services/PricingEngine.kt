package com.paloptical.post.services

import com.paloptical.post.models.PricingBreakdown
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

object PricingEngine {

    const val KY_SALES_TAX_RATE = 0.06

    fun calculate(
        carrier: String,
        isEligible: Boolean,
        frameRetail: Double,
        frameAllowance: Double,
        progressiveCopaySetting: Double,
        arCopaySetting: Double,
        lensType: String,
        arCoating: String,
        hasTransitions: Boolean,
        hasPolycarbonate: Boolean,
        hasHiIndex: Boolean
    ): PricingBreakdown {
        var baseLensCopay = 0.0
        var progressiveCopay = 0.0
        var arCopay = 0.0
        var upgradesTotal = 0.0
        var framePatientCost = 0.0
        var frameInsurancePaid = 0.0
        var frameDiscount = 0.0
        var notes = ""

        val isProgressive = lensType.contains("Progressive", ignoreCase = true)
        val hasAr = !arCoating.equals("None", ignoreCase = true)

        if (!isEligible || carrier.equals("Private Pay / Retail", ignoreCase = true)) {
            // Patient is either Ineligible or Private Pay Retail
            val retailLens = when {
                lensType.contains("Ultra", ignoreCase = true) -> 320.0
                lensType.contains("Premium", ignoreCase = true) -> 250.0
                lensType.contains("Standard", ignoreCase = true) -> 185.0
                lensType.contains("Bifocal", ignoreCase = true) -> 125.0
                else -> 85.0 // Single Vision
            }

            val retailAr = when {
                arCoating.contains("Blue", ignoreCase = true) -> 120.0
                arCoating.contains("Premium", ignoreCase = true) -> 95.0
                hasAr -> 65.0
                else -> 0.0
            }

            var upgrades = 0.0
            if (hasTransitions) upgrades += 90.0
            if (hasPolycarbonate) upgrades += 45.0
            if (hasHiIndex) upgrades += 85.0

            val pairRetail = frameRetail + retailLens + retailAr + upgrades

            if (carrier.equals("Private Pay / Retail", ignoreCase = true)) {
                // 20% Package Discount for complete pair
                val discount = round2(pairRetail * 0.20)
                val subtotal = round2(pairRetail - discount)
                val tax = round2(subtotal * KY_SALES_TAX_RATE)
                return PricingBreakdown(
                    frameRetail = frameRetail,
                    frameInsurancePaid = 0.0,
                    framePatientCost = frameRetail,
                    frameDiscount = discount,
                    baseLensCopay = retailLens,
                    progressiveCopay = 0.0,
                    arCopay = retailAr,
                    upgradesTotal = upgrades,
                    subtotalPatient = subtotal,
                    kySalesTax = tax,
                    totalDue = round2(subtotal + tax),
                    notes = "Private Pay: 20% Complete Pair Discount applied (-$$discount)."
                )
            } else {
                // Ineligible - strict retail rates apply
                framePatientCost = frameRetail
                baseLensCopay = retailLens
                arCopay = retailAr
                upgradesTotal = upgrades
                val subtotal = round2(framePatientCost + baseLensCopay + arCopay + upgradesTotal)
                val tax = round2(subtotal * KY_SALES_TAX_RATE)
                return PricingBreakdown(
                    frameRetail = frameRetail,
                    frameInsurancePaid = 0.0,
                    framePatientCost = framePatientCost,
                    frameDiscount = 0.0,
                    baseLensCopay = baseLensCopay,
                    progressiveCopay = 0.0,
                    arCopay = arCopay,
                    upgradesTotal = upgradesTotal,
                    subtotalPatient = subtotal,
                    kySalesTax = tax,
                    totalDue = round2(subtotal + tax),
                    notes = "CAUTION: Patient benefits inactive/terminated. Standard retail rates applied."
                )
            }
        }

        // --- Active Insurance Calculations ---

        when (carrier) {
            "Wellcare" -> {
                // Wellcare $350 lump-sum benefit for complete pair
                val allowance = 350.0
                val lensCost = if (isProgressive) 185.0 else 85.0
                val arCost = if (hasAr) 65.0 else 0.0
                var upgrades = 0.0
                if (hasTransitions) upgrades += 75.0
                if (hasPolycarbonate) upgrades += 40.0
                if (hasHiIndex) upgrades += 80.0

                val grossTotal = frameRetail + lensCost + arCost + upgrades
                val insCoverage = min(allowance, grossTotal)
                val patientSubtotal = max(0.0, grossTotal - insCoverage)
                val tax = round2(patientSubtotal * KY_SALES_TAX_RATE)

                return PricingBreakdown(
                    frameRetail = frameRetail,
                    frameInsurancePaid = insCoverage,
                    framePatientCost = patientSubtotal,
                    frameDiscount = 0.0,
                    baseLensCopay = 0.0,
                    progressiveCopay = 0.0,
                    arCopay = 0.0,
                    upgradesTotal = 0.0,
                    subtotalPatient = patientSubtotal,
                    kySalesTax = tax,
                    totalDue = round2(patientSubtotal + tax),
                    notes = "Wellcare: $350.00 total allowance applied toward complete pair."
                )
            }

            "Medicaid KY" -> {
                // Medicaid KY covers frame and standard lenses ($0.00 copay)
                frameInsurancePaid = min(frameRetail, 100.0)
                framePatientCost = max(0.0, frameRetail - 100.0)
                baseLensCopay = 0.0

                if (isProgressive) {
                    progressiveCopay = if (progressiveCopaySetting > 0) progressiveCopaySetting else 45.0
                }

                if (hasAr) {
                    arCopay = if (arCopaySetting > 0) arCopaySetting else 35.0
                }

                if (hasTransitions) upgradesTotal += 75.0
                if (hasPolycarbonate) upgradesTotal += 35.0
                if (hasHiIndex) upgradesTotal += 80.0

                notes = "Medicaid KY: $0 standard copay on covered materials; elective copays applied."
            }

            "EyeMed", "VSP", "Custom / Other" -> {
                // Frame overage calculation:
                // If frame > allowance, 20% discount on overage, patient pays remainder
                if (frameRetail <= frameAllowance) {
                    frameInsurancePaid = frameRetail
                    framePatientCost = 0.0
                    frameDiscount = 0.0
                } else {
                    val overage = frameRetail - frameAllowance
                    frameDiscount = round2(overage * 0.20)
                    framePatientCost = round2(overage - frameDiscount)
                    frameInsurancePaid = frameAllowance
                }

                // Base lens copay
                baseLensCopay = 10.0

                // Progressive copay
                if (isProgressive) {
                    progressiveCopay = progressiveCopaySetting
                    if (lensType.contains("Premium", ignoreCase = true)) {
                        progressiveCopay += 30.0
                    } else if (lensType.contains("Ultra", ignoreCase = true)) {
                        progressiveCopay += 55.0
                    }
                } else {
                    progressiveCopay = 0.0
                }

                // AR copay
                if (hasAr) {
                    arCopay = arCopaySetting
                    if (arCoating.contains("Premium", ignoreCase = true)) {
                        arCopay += 15.0
                    } else if (arCoating.contains("Blue", ignoreCase = true)) {
                        arCopay += 25.0
                    }
                } else {
                    arCopay = 0.0
                }

                // Upgrades
                if (hasTransitions) upgradesTotal += 75.0
                if (hasPolycarbonate) upgradesTotal += 40.0
                if (hasHiIndex) upgradesTotal += 80.0

                notes = "$carrier: 20% discount on frame balance over $$frameAllowance allowance."
            }
        }

        val subtotal = round2(framePatientCost + baseLensCopay + progressiveCopay + arCopay + upgradesTotal)
        val tax = round2(subtotal * KY_SALES_TAX_RATE)
        val total = round2(subtotal + tax)

        return PricingBreakdown(
            frameRetail = frameRetail,
            frameInsurancePaid = frameInsurancePaid,
            framePatientCost = framePatientCost,
            frameDiscount = frameDiscount,
            baseLensCopay = baseLensCopay,
            progressiveCopay = progressiveCopay,
            arCopay = arCopay,
            upgradesTotal = upgradesTotal,
            subtotalPatient = subtotal,
            kySalesTax = tax,
            totalDue = total,
            notes = notes
        )
    }

    private fun round2(value: Double): Double {
        return (value * 100.0).roundToInt() / 100.0
    }
}
