import { GoogleGenAI } from "@google/genai";
import { InsurancePlan, InsuranceVerificationResult } from "../types";

export interface VerificationInput {
  text?: string;
  imageBase64?: string;
  imageMimeType?: string;
  patientNameHint?: string;
}

const STORAGE_KEY = "post_gemini_api_key";

export function getGeminiApiKey(): string {
  if (typeof process !== "undefined" && process.env && process.env.GEMINI_API_KEY) {
    return process.env.GEMINI_API_KEY;
  }
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage.getItem(STORAGE_KEY) || "";
  }
  return "";
}

export function setGeminiApiKey(key: string): void {
  if (typeof window !== "undefined" && window.localStorage) {
    if (key.trim()) {
      window.localStorage.setItem(STORAGE_KEY, key.trim());
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }
}

// Built-in vision insurance sample data for rapid testing and demonstrations
export const SAMPLE_PORTAL_SNIPPETS = {
  activeEyeMed: {
    title: "EyeMed - Active ($150 Frame Allowance)",
    text: `PROVIDER ACCESS - MEMBER ELIGIBILITY & BENEFIT SHEET
Subscriber: JANE DOE
Member ID: 984712039-01   DOB: 04/12/1988
Plan: EyeMed Access Plan H (Insight Network)
Status: ELIGIBLE / ACTIVE
Effective Date: 01/01/2026
Benefits Breakdown:
- Comprehensive Eye Exam: $10 Copay (Eligible: Yes)
- Standard Plastic Lenses: $25 Materials Copay (Eligible: Yes)
- Frame Benefit: $150.00 Retail Allowance, plus 20% off balance over allowance.
- Progressive Tier 1 Copay: $65
- Anti-Reflective Coating (Standard): $45 Copay
Frequency: Frame every 12 months, Lenses every 12 months.
Authorization Status: Open / Available for service today.`,
  },
  inactiveTerminated: {
    title: "VSP / Eyefinity - Terminated / No Benefits",
    text: `EYEFINITY REAL-TIME ELIGIBILITY VERIFICATION
Patient: JOHN SMITH   DOB: 11/03/1979
VSP Member ID: 481928374
Group: Acme Industrial Corp (Plan: Signature)
COVERAGE STATUS: TERMINATED / INELIGIBLE
Termination Date: 09/30/2026
Reason: Employment termination / coverage ceased.
Vision Hardware Benefits: NONE AVAILABLE.
Alert: Member has no active coverage under this plan. Any eyewear or examinations provided must be billed as Private Pay / Self-Pay retail.`,
  },
  exhaustedBenefit: {
    title: "Spectera - Benefit Exhausted (Frame used recently)",
    text: `SPECTERA VISION ELIGIBILITY SUMMARY
Member: MICHAEL RAY JOHNSON   DOB: 02/15/1995
Policy ID: 883719201
Status: ACTIVE ENROLLMENT (Medical/Vision)
Hardware Benefit Availability:
- Frames: NOT ELIGIBLE - Benefit exhausted. Last frame claim date: 04/18/2026. Next frame eligibility date: 04/18/2028 (24 month frequency).
- Lenses: NOT ELIGIBLE - Claimed on 04/18/2026.
- Exam: Active ($10 copay).
Notice: Patient is NOT eligible for eyewear hardware benefits today. Frame and lens purchase must be paid out-of-pocket by patient.`,
  },
  wellcareAllowance: {
    title: "Wellcare Medicare - $350 Total Allowance",
    text: `WELLCARE BY ALLWELL - MEDICARE ADVANTAGE VISION RIDER
Enrollee: ROBERT DAVIS   DOB: 08/21/1952
Member ID: WCR-77281902
Plan: Wellcare Medicare Value (HMO)
Benefit Period: Calendar Year 2026
Annual Eyewear Allowance: $350.00 Total Annual Combined Allowance
Available Allowance Balance: $350.00 Remaining
Coverage Rules: $350 applies toward frames, prescription lenses, and options. Any remaining balance over $350 is the responsibility of the enrollee.
Status: ACTIVE / IN BENEFIT`,
  },
};

export async function verifyInsuranceWithAI(
  input: VerificationInput,
  apiKeyOverride?: string
): Promise<InsuranceVerificationResult> {
  const apiKey = (apiKeyOverride || getGeminiApiKey()).trim();

  // If no API key is set, check if the input matches one of our samples or run offline mock parser
  if (!apiKey) {
    return runOfflineFallbackParser(input);
  }

  const ai = new GoogleGenAI({ apiKey });

  const systemInstructions = `
You are an expert Optical Practice Billing & Vision Insurance Verification Specialist.
Your task is to analyze vision insurance eligibility documents, portal summaries, or screenshots (from EyeMed, VSP Eyefinity, Medicaid/KyHealth, Spectera, Availity, Unum, NVA, VBA, etc.) and extract key billing data for an optical shop.

Supported Insurance Plans:
- "MEDICAID"
- "EYE-MED"
- "AETNA EYE-MED"
- "PREMIER VISION"
- "MARCH/EYESYNERGY"
- "UNUM"
- "NVA"
- "VBA"
- "VSP"
- "SPECTERA"
- "WELLCARE MEDICARE"
- "SCHOOL LETTER"
- "None"

CRITICAL INSTRUCTIONS:
1. Determine if the patient currently has ACTIVE benefits for vision hardware / glasses ("hasBenefits": true or false).
   - If status is "Terminated", "Inactive", "Exhausted", "No Hardware Benefit", "Prior service used within frequency period", or "Exam Only", set "hasBenefits": false.
   - Provide a clear, unmistakable "statusReason" explaining WHY they do or do not have benefits.
2. Determine "matchedPlan": match to the closest plan name from the supported list above. If not eligible or unknown, set "None".
3. Extract:
   - "frameAllowance": dollar amount allowed for frames (e.g. 150 for VSP/EyeMed). 0 if none.
   - "isAllowancePlan": true if the entire benefit is a lump sum allowance (e.g. Wellcare Medicare $350 allowance, or EyeMed global allowance).
   - "globalAllowance": total dollar amount of lump sum allowance if isAllowancePlan is true.
   - "progressiveCopay": specific copay for progressive / multifocal lenses (e.g. 65 for Tier 1 / Standard Progressive). 0 if allowance plan or Medicaid.
   - "arCopay": specific copay for Anti-Reflective (A/R) coating (e.g. 45 for Standard A/R). 0 if allowance plan or Medicaid.
   - "examCopay" & "materialsCopay" if mentioned.
   - "patientName", "memberId", "dob", "effectiveDate", "terminationDate" if visible.
   - "warnings": array of string alerts (e.g. "Coverage terminated on [date]", "Frame frequency not met", "20% overage applies to frame").
   - "rawSummary": 2-3 concise sentences summarizing patient's coverage for the optician.

Respond STRICTLY in JSON format with this exact schema:
{
  "hasBenefits": boolean,
  "eligibilityStatus": "ACTIVE" | "INACTIVE" | "TERMINATED" | "EXHAUSTED" | "NOT_FOUND" | "UNKNOWN",
  "statusReason": string,
  "matchedPlan": "None" | "MEDICAID" | "EYE-MED" | "AETNA EYE-MED" | "PREMIER VISION" | "MARCH/EYESYNERGY" | "UNUM" | "NVA" | "VBA" | "VSP" | "SPECTERA" | "WELLCARE MEDICARE" | "SCHOOL LETTER",
  "carrierName": string,
  "patientName": string,
  "memberId": string,
  "dob": string,
  "effectiveDate": string,
  "terminationDate": string,
  "frameAllowance": number,
  "isAllowancePlan": boolean,
  "globalAllowance": number,
  "examCopay": number,
  "materialsCopay": number,
  "progressiveCopay": number,
  "arCopay": number,
  "rawSummary": string,
  "warnings": string[]
}
`;

  try {
    const contents: any[] = [];

    let promptText = `Please analyze this vision insurance verification info for optical billing.\nPatient Name Hint: ${input.patientNameHint || "Unknown"}\n\n`;

    if (input.text) {
      promptText += `PORTAL TEXT CONTENT:\n"""\n${input.text}\n"""\n`;
    }

    contents.push({ text: promptText });

    if (input.imageBase64) {
      const mimeType = input.imageMimeType || "image/png";
      const base64Data = input.imageBase64.replace(/^data:image\/\w+;base64,/, "");
      contents.push({
        inlineData: {
          mimeType: mimeType,
          data: base64Data,
        },
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: contents,
      config: {
        systemInstruction: systemInstructions,
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    });

    const responseText = response.text || "{}";
    const parsed = JSON.parse(responseText);

    return {
      hasBenefits: Boolean(parsed.hasBenefits),
      eligibilityStatus: parsed.eligibilityStatus || (parsed.hasBenefits ? "ACTIVE" : "INACTIVE"),
      statusReason: parsed.statusReason || (parsed.hasBenefits ? "Active vision benefits verified" : "No active vision hardware benefits"),
      matchedPlan: normalizePlan(parsed.matchedPlan),
      carrierName: parsed.carrierName || "Insurance Carrier",
      patientName: parsed.patientName || input.patientNameHint || "",
      memberId: parsed.memberId || "",
      dob: parsed.dob || "",
      effectiveDate: parsed.effectiveDate || "",
      terminationDate: parsed.terminationDate || "",
      frameAllowance: typeof parsed.frameAllowance === "number" ? parsed.frameAllowance : 0,
      isAllowancePlan: Boolean(parsed.isAllowancePlan),
      globalAllowance: typeof parsed.globalAllowance === "number" ? parsed.globalAllowance : 0,
      examCopay: typeof parsed.examCopay === "number" ? parsed.examCopay : 0,
      materialsCopay: typeof parsed.materialsCopay === "number" ? parsed.materialsCopay : 0,
      progressiveCopay: typeof parsed.progressiveCopay === "number" ? parsed.progressiveCopay : (parsed.hasBenefits && !parsed.isAllowancePlan ? 65 : 0),
      arCopay: typeof parsed.arCopay === "number" ? parsed.arCopay : (parsed.hasBenefits && !parsed.isAllowancePlan ? 45 : 0),
      rawSummary: parsed.rawSummary || "Insurance eligibility processed.",
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
      verifiedAt: Date.now(),
    };
  } catch (err: any) {
    console.error("Gemini Insurance Verification error:", err);
    // If API error occurred, fall back to offline parser
    return runOfflineFallbackParser(input, err?.message);
  }
}

function normalizePlan(planStr: string): InsurancePlan {
  if (!planStr) return "None";
  const upper = planStr.toUpperCase().trim();
  if (upper.includes("AETNA") && upper.includes("EYE")) return "AETNA EYE-MED";
  if (upper.includes("EYE-MED") || upper.includes("EYEMED")) return "EYE-MED";
  if (upper.includes("VSP")) return "VSP";
  if (upper.includes("MEDICAID")) return "MEDICAID";
  if (upper.includes("SPECTERA") || upper.includes("OPTUM")) return "SPECTERA";
  if (upper.includes("WELLCARE")) return "WELLCARE MEDICARE";
  if (upper.includes("PREMIER")) return "PREMIER VISION";
  if (upper.includes("MARCH") || upper.includes("SYNERGY")) return "MARCH/EYESYNERGY";
  if (upper.includes("UNUM")) return "UNUM";
  if (upper.includes("NVA")) return "NVA";
  if (upper.includes("VBA")) return "VBA";
  if (upper.includes("SCHOOL")) return "SCHOOL LETTER";
  return "None";
}

// Fallback regex/heuristic parser when offline or testing without an API key
function runOfflineFallbackParser(input: VerificationInput, errorNotice?: string): InsuranceVerificationResult {
  const text = (input.text || "").toUpperCase();

  const isTerminated =
    text.includes("TERMINATED") ||
    text.includes("INELIGIBLE") ||
    text.includes("INACTIVE") ||
    text.includes("EXHAUSTED") ||
    text.includes("BENEFIT EXHAUSTED") ||
    text.includes("NOT ELIGIBLE");

  let matchedPlan: InsurancePlan = "None";
  let carrierName = "Carrier";
  let frameAllowance = 0;
  let isAllowancePlan = false;
  let globalAllowance = 0;

  if (text.includes("WELLCARE")) {
    matchedPlan = "WELLCARE MEDICARE";
    carrierName = "Wellcare Medicare";
    isAllowancePlan = true;
    const allowMatch = text.match(/\$?(\d{2,3})\s*(?:TOTAL|ANNUAL|ALLOWANCE)/i);
    globalAllowance = allowMatch ? parseFloat(allowMatch[1]) : 350;
  } else if (text.includes("EYEMED") || text.includes("EYE-MED")) {
    matchedPlan = text.includes("AETNA") ? "AETNA EYE-MED" : "EYE-MED";
    carrierName = matchedPlan;
    const frameMatch = text.match(/(?:FRAME|RETAIL)\s*(?:ALLOWANCE|BENEFIT)?:?\s*\$?(\d{2,3})/i);
    frameAllowance = frameMatch ? parseFloat(frameMatch[1]) : 150;
  } else if (text.includes("VSP") || text.includes("EYEFINITY")) {
    matchedPlan = "VSP";
    carrierName = "VSP Vision Care";
    const frameMatch = text.match(/FRAME\s*(?:ALLOWANCE|BENEFIT)?:?\s*\$?(\d{2,3})/i);
    frameAllowance = frameMatch ? parseFloat(frameMatch[1]) : 150;
  } else if (text.includes("SPECTERA")) {
    matchedPlan = "SPECTERA";
    carrierName = "Spectera Vision";
  } else if (text.includes("MEDICAID")) {
    matchedPlan = "MEDICAID";
    carrierName = "State Medicaid";
  } else if (text.includes("PREMIER")) {
    matchedPlan = "PREMIER VISION";
    carrierName = "Premier Vision";
    frameAllowance = 130;
  } else if (text.includes("UNUM")) {
    matchedPlan = "UNUM";
    carrierName = "Unum Vision";
    frameAllowance = 130;
  } else if (text.includes("NVA")) {
    matchedPlan = "NVA";
    carrierName = "National Vision Administrators";
    frameAllowance = 120;
  } else if (text.includes("VBA")) {
    matchedPlan = "VBA";
    carrierName = "Vision Benefits of America";
    frameAllowance = 125;
  }

  const hasBenefits = !isTerminated && matchedPlan !== "None";

  let progressiveCopay = 0;
  let arCopay = 0;
  if (hasBenefits && !isAllowancePlan) {
    if (matchedPlan === "EYE-MED" || matchedPlan === "AETNA EYE-MED") {
      progressiveCopay = 65;
      arCopay = 45;
    } else if (matchedPlan === "VSP") {
      progressiveCopay = 55;
      arCopay = 41;
    } else if (matchedPlan === "SPECTERA") {
      progressiveCopay = 70;
      arCopay = 40;
    } else if (
      matchedPlan === "PREMIER VISION" ||
      matchedPlan === "UNUM" ||
      matchedPlan === "NVA" ||
      matchedPlan === "VBA"
    ) {
      progressiveCopay = 60;
      arCopay = 40;
    }
  }

  const warnings: string[] = [];
  if (errorNotice) {
    warnings.push(`AI note: ${errorNotice} (parsed using optical rule heuristics).`);
  }
  if (!hasBenefits) {
    warnings.push("CRITICAL: Patient has no active vision hardware coverage. Must be billed as Private Pay.");
  } else if (frameAllowance > 0) {
    warnings.push(`Standard 20% overage discount applies to frame balance above $${frameAllowance}.`);
  }

  return {
    hasBenefits,
    eligibilityStatus: isTerminated ? "TERMINATED" : (hasBenefits ? "ACTIVE" : "UNKNOWN"),
    statusReason: isTerminated
      ? "Coverage is terminated, inactive, or hardware frequency is exhausted."
      : hasBenefits
      ? `Active vision hardware benefits verified for ${carrierName}.`
      : "No clear active vision hardware benefits detected in document.",
    matchedPlan: hasBenefits ? matchedPlan : "None",
    carrierName,
    patientName: input.patientNameHint || "",
    frameAllowance,
    isAllowancePlan,
    globalAllowance,
    progressiveCopay,
    arCopay,
    rawSummary: hasBenefits
      ? `Patient is eligible for ${carrierName}. Frame allowance: $${frameAllowance || globalAllowance}. Progressive copay: $${progressiveCopay}. A/R copay: $${arCopay}.`
      : `Patient coverage is inactive or exhausted. Proceed with private pay pricing.`,
    warnings,
    verifiedAt: Date.now(),
  };
}
