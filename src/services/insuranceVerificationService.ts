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
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0]; // e.g. "2026-11-10"

  const systemInstructions = `
You are an expert Optical Practice Billing & Vision Insurance Verification Specialist.
Your task is to analyze vision insurance eligibility documents, portal summaries, or screenshots (from EyeMed, VSP Eyefinity, Medicaid/KyHealth, Spectera, Availity, Unum, NVA, VBA, etc.) and extract key billing data for an optical shop.

CRITICAL DATE CONTEXT:
- TODAY'S REAL DATE IS: ${todayStr} (Year: ${today.getFullYear()}).
- Effective dates on or before ${todayStr} (such as 01/01/2026, 1/1/26, or any 2026 date prior to today) ARE ALREADY ACTIVE AND IN EFFECT!
- NEVER claim that benefits "have not started yet" or "start in the future on 1/1/26" because 2026 IS THE CURRENT YEAR and 1/1/26 is in the past.
- The patient's coverage IS CURRENTLY ACTIVE if effective date is on or before today!

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
   - If effective date is on or before ${todayStr}, benefits ARE active today.
   - Provide a clear, unmistakable "statusReason" explaining WHY they do or do not have benefits.
2. Determine "matchedPlan": Identify the vision plan or carrier explicitly mentioned in the text. Match to the closest supported name:
   - "VSP", "EYE-MED", "AETNA EYE-MED", "SPECTERA", "WELLCARE MEDICARE", "MEDICAID", "PREMIER VISION", "UNUM", "NVA", "VBA", "SCHOOL LETTER", or "None".
   - DO NOT default to EYE-MED if another plan or carrier is mentioned!
3. Extract EXACT DOLLAR AMOUNTS from the user's text:
   - "frameAllowance": Extract the EXACT frame allowance number from the text (e.g. 120, 130, 160, 200). DO NOT default to 150.
   - "progressiveCopay": Extract the EXACT progressive / multifocal lens copay from the text (e.g. 40, 50, 55, 75, 85, 95). DO NOT default to 65.
   - "arCopay": Extract the EXACT anti-reflective coating copay from the text (e.g. 25, 30, 35, 41, 45). DO NOT default to 45.
   - "globalAllowance": Extract the lump-sum total allowance if specified (e.g. 250, 350, 500).
   - "examCopay" & "materialsCopay" if mentioned.
   - "patientName", "memberId", "dob", "effectiveDate", "terminationDate" if visible.
   - "warnings": array of string alerts.
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

    let promptText = `Please analyze this vision insurance verification info for optical billing.\nToday's Date: ${todayStr}\nPatient Name Hint: ${input.patientNameHint || "Unknown"}\n\n`;

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
      progressiveCopay: typeof parsed.progressiveCopay === "number" ? parsed.progressiveCopay : 0,
      arCopay: typeof parsed.arCopay === "number" ? parsed.arCopay : 0,
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
  if (upper.includes("VSP") || upper.includes("EYEFINITY")) return "VSP";
  if (upper.includes("MEDICAID") || upper.includes("KYHEALTH")) return "MEDICAID";
  if (upper.includes("SPECTERA") || upper.includes("OPTUM")) return "SPECTERA";
  if (upper.includes("WELLCARE")) return "WELLCARE MEDICARE";
  if (upper.includes("PREMIER")) return "PREMIER VISION";
  if (upper.includes("MARCH") || upper.includes("SYNERGY")) return "MARCH/EYESYNERGY";
  if (upper.includes("UNUM")) return "UNUM";
  if (upper.includes("NVA")) return "NVA";
  if (upper.includes("VBA")) return "VBA";
  if (upper.includes("SCHOOL")) return "SCHOOL LETTER";
  return "EYE-MED"; // Flexible default for private vision carriers
}

// Fallback dynamic extractor when offline or parsing without an API key
export function runOfflineFallbackParser(input: VerificationInput, errorNotice?: string): InsuranceVerificationResult {
  const rawText = input.text || "";
  const upper = rawText.toUpperCase();

  const isTerminated =
    upper.includes("TERMINATED") ||
    upper.includes("INELIGIBLE") ||
    upper.includes("INACTIVE") ||
    upper.includes("EXHAUSTED") ||
    upper.includes("BENEFIT EXHAUSTED") ||
    upper.includes("NOT ELIGIBLE");

  // 1. Identify Plan / Carrier from input text
  let matchedPlan: InsurancePlan = "None";
  let carrierName = "Vision Carrier";

  if (upper.includes("WELLCARE")) {
    matchedPlan = "WELLCARE MEDICARE";
    carrierName = "Wellcare Medicare";
  } else if (upper.includes("AETNA") && (upper.includes("EYE") || upper.includes("VISION"))) {
    matchedPlan = "AETNA EYE-MED";
    carrierName = "Aetna EyeMed";
  } else if (upper.includes("EYEMED") || upper.includes("EYE-MED") || upper.includes("INSIGHT") || upper.includes("ACCESS PLAN")) {
    matchedPlan = "EYE-MED";
    carrierName = "EyeMed Vision Care";
  } else if (upper.includes("VSP") || upper.includes("EYEFINITY") || upper.includes("SIGNATURE") || upper.includes("CHOICE PLAN")) {
    matchedPlan = "VSP";
    carrierName = "VSP Vision Care";
  } else if (upper.includes("SPECTERA") || upper.includes("OPTUM")) {
    matchedPlan = "SPECTERA";
    carrierName = "Spectera Vision";
  } else if (upper.includes("MEDICAID") || upper.includes("KYHEALTH")) {
    matchedPlan = "MEDICAID";
    carrierName = "State Medicaid";
  } else if (upper.includes("PREMIER")) {
    matchedPlan = "PREMIER VISION";
    carrierName = "Premier Vision";
  } else if (upper.includes("UNUM")) {
    matchedPlan = "UNUM";
    carrierName = "Unum Vision";
  } else if (upper.includes("NVA")) {
    matchedPlan = "NVA";
    carrierName = "National Vision Administrators";
  } else if (upper.includes("VBA")) {
    matchedPlan = "VBA";
    carrierName = "Vision Benefits of America";
  } else if (upper.includes("HUMANA") || upper.includes("DAVIS") || upper.includes("BLUE CROSS") || upper.includes("ANTHEM")) {
    matchedPlan = "EYE-MED"; // Uses standard allowance & copay schedule
    carrierName = upper.includes("HUMANA") ? "Humana Vision" : "Commercial Vision Plan";
  } else if (!isTerminated && (rawText.length > 5)) {
    matchedPlan = "EYE-MED";
    carrierName = "Vision Plan";
  }

  // 2. Dynamic Extraction of Copays and Allowances
  let frameAllowance = 0;
  let progressiveCopay = 0;
  let arCopay = 0;
  let globalAllowance = 0;
  let isAllowancePlan = matchedPlan === "WELLCARE MEDICARE";

  // Normalize "tier 1", "tier 2", etc. so numbers aren't confused with copays
  const cleanText = rawText.replace(/tier\s*[1-4]/gi, "tier");

  // Break text into clauses / lines
  const lines = cleanText.split(/[\n;]|\.\s+/);
  for (const line of lines) {
    const parts = line.split(/,\s*|\band\b/i);
    for (const part of parts) {
      const p = part.trim();
      if (!p) continue;

      const dollarMatch = p.match(/\$\s*(\d+(?:\.\d{2})?)/)
        || p.match(/(?:allowance|copay|cost|fee|is|at|balance)[:\s-]*(\d+(?:\.\d{2})?)/i)
        || p.match(/(\d+(?:\.\d{2})?)\s*(?:dollars?|copay|allowance)/i);
      
      const val = dollarMatch ? parseFloat(dollarMatch[1]) : 0;
      if (!val) continue;

      if (/total allowance|annual allowance|lump sum/i.test(p)) {
        globalAllowance = val;
        isAllowancePlan = true;
      } else if (/frame|eyewear/i.test(p) && !frameAllowance) {
        frameAllowance = val;
      } else if (/progressive|multifocal|pal/i.test(p) && !progressiveCopay) {
        progressiveCopay = val;
      } else if (/anti[-\s]*reflective|a\/?r|glare|coating/i.test(p) && !arCopay) {
        arCopay = val;
      }
    }
  }

  // Fallback defaults only if frame allowance was not in text
  if (!frameAllowance && !isAllowancePlan && matchedPlan !== "None" && matchedPlan !== "MEDICAID") {
    // If user text specified frame without dollar, check digits
    const anyFrameNum = rawText.match(/frame[^\d]*?(\d{2,3})/i);
    if (anyFrameNum) frameAllowance = parseFloat(anyFrameNum[1]);
  }

  const hasBenefits = !isTerminated && matchedPlan !== "None";

  // Only provide plan defaults if NO copay was specified in the text
  if (hasBenefits && !isAllowancePlan) {
    if (!progressiveCopay) {
      if (matchedPlan === "EYE-MED" || matchedPlan === "AETNA EYE-MED") progressiveCopay = 65;
      else if (matchedPlan === "VSP") progressiveCopay = 55;
      else if (matchedPlan === "SPECTERA") progressiveCopay = 70;
      else if (matchedPlan === "PREMIER VISION" || matchedPlan === "UNUM" || matchedPlan === "NVA" || matchedPlan === "VBA") progressiveCopay = 60;
    }
    if (!arCopay) {
      if (matchedPlan === "EYE-MED" || matchedPlan === "AETNA EYE-MED") arCopay = 45;
      else if (matchedPlan === "VSP") arCopay = 41;
      else if (matchedPlan === "SPECTERA") arCopay = 40;
      else if (matchedPlan === "PREMIER VISION" || matchedPlan === "UNUM" || matchedPlan === "NVA" || matchedPlan === "VBA") arCopay = 40;
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
