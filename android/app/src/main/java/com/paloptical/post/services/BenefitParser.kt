package com.paloptical.post.services

import com.paloptical.post.models.InsuranceBenefitResult
import java.util.regex.Pattern

object BenefitParser {

    fun parse(rawText: String): InsuranceBenefitResult {
        val lower = rawText.lowercase()

        // 1. Detect Carrier
        val carrier = when {
            lower.contains("eyemed") -> "EyeMed"
            lower.contains("vsp") -> "VSP"
            lower.contains("wellcare") -> "Wellcare"
            lower.contains("medicaid") || lower.contains("ky health") || lower.contains("passport") || lower.contains("humana healthy") -> "Medicaid KY"
            lower.contains("davis") -> "Davis Vision"
            lower.contains("spectera") -> "Spectera"
            else -> "Insurance"
        }

        // 2. Check Active vs Inactive / Terminated
        val terminatedKeywords = listOf(
            "inactive", "terminated", "no coverage", "expired",
            "benefits exhausted", "not eligible", "disenroll", "cancelled"
        )
        val hasTerminatedKeyword = terminatedKeywords.any { lower.contains(it) }

        // Check for future effective dates (relative to current year 2026)
        // e.g. "effective 01/01/2027" or "benefits begin 01/01/27"
        var futureDateFlag = false
        var futureDateStr = ""
        val futureDateMatcher = Pattern.compile("(?:effective|begins?|starts?|coverage starts?)[^0-9]*(\\d{1,2}/\\d{1,2}/(202[7-9]|20[3-9]\\d))").matcher(lower)
        if (futureDateMatcher.find()) {
            futureDateFlag = true
            futureDateStr = futureDateMatcher.group(1) ?: ""
        }

        val isIneligible = hasTerminatedKeyword || futureDateFlag
        val statusMessage = when {
            futureDateFlag -> "INACTIVE - Benefits do not start until $futureDateStr"
            hasTerminatedKeyword -> "INACTIVE - Coverage is terminated or exhausted"
            else -> "ACTIVE - Eligible for routine vision materials"
        }

        val cautionMsg = when {
            futureDateFlag -> "Coverage does not take effect until $futureDateStr. Private pay rates apply."
            hasTerminatedKeyword -> "Patient has no active coverage. Benefits are terminated or inactive."
            else -> null
        }

        // 3. Extract Frame Allowance
        var frameAllowance = when (carrier) {
            "EyeMed" -> 150.0
            "VSP" -> 150.0
            "Wellcare" -> 350.0 // lump sum allowance
            "Medicaid KY" -> 0.0 // covered standard
            else -> 130.0
        }
        val frameMatcher = Pattern.compile("(?:frame|allowance|frames)[^$0-9]*\\$?(\\d{2,3}(?:\\.\\d{2})?)").matcher(lower)
        if (frameMatcher.find()) {
            frameMatcher.group(1)?.toDoubleOrNull()?.let {
                frameAllowance = it
            }
        }

        // 4. Extract Progressive Copay
        var progCopay = when (carrier) {
            "EyeMed" -> 65.0
            "VSP" -> 55.0
            "Wellcare" -> 0.0
            "Medicaid KY" -> 0.0
            else -> 65.0
        }
        val progMatcher = Pattern.compile("(?:progressive|prog(?:ressive)? copay|tier 1|standard prog)[^$0-9]*\\$?(\\d{1,3}(?:\\.\\d{2})?)").matcher(lower)
        if (progMatcher.find()) {
            progMatcher.group(1)?.toDoubleOrNull()?.let {
                progCopay = it
            }
        }

        // 5. Extract Anti-Reflective Copay
        var arCopay = when (carrier) {
            "EyeMed" -> 45.0
            "VSP" -> 41.0
            "Wellcare" -> 0.0
            "Medicaid KY" -> 0.0
            else -> 45.0
        }
        val arMatcher = Pattern.compile("(?:anti[- ]?reflective|a/?r|coating)[^$0-9]*\\$?(\\d{1,3}(?:\\.\\d{2})?)").matcher(lower)
        if (arMatcher.find()) {
            arMatcher.group(1)?.toDoubleOrNull()?.let {
                arCopay = it
            }
        }

        return InsuranceBenefitResult(
            carrierName = carrier,
            isActive = !isIneligible,
            statusMessage = statusMessage,
            frameAllowance = frameAllowance,
            progressiveCopay = progCopay,
            arCopay = arCopay,
            isTerminatedOrFuture = isIneligible,
            cautionMessage = cautionMsg
        )
    }
}
