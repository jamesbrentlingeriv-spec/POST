import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Search,
  ExternalLink,
  Copy,
  Check,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Upload,
  Clipboard,
  Key,
  RotateCcw,
  FileText,
  Image as ImageIcon,
  DollarSign,
  Info,
} from "lucide-react";
import { InsurancePlan, InsuranceVerificationResult } from "../types";
import {
  verifyInsuranceWithAI,
  getGeminiApiKey,
  setGeminiApiKey,
  SAMPLE_PORTAL_SNIPPETS,
} from "../services/insuranceVerificationService";

interface InsuranceLookupModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientName: string;
  phone?: string;
  onApplyBenefits: (result: InsuranceVerificationResult) => void;
  onApplyPrivatePay: () => void;
}

const PROVIDER_PORTALS = [
  { name: "VSP (Eyefinity)", url: "https://www.eyefinity.com/", plan: "VSP" },
  { name: "EyeMed Provider Access", url: "https://portal.eyemedvisioncare.com/", plan: "EYE-MED" },
  { name: "Availity (Aetna/Anthem)", url: "https://www.availity.com/", plan: "AETNA EYE-MED" },
  { name: "Spectera / Optum", url: "https://www.spectera.com/", plan: "SPECTERA" },
  { name: "KyHealth / Medicaid", url: "https://kymmis.com/", plan: "MEDICAID" },
];

export function InsuranceLookupModal({
  isOpen,
  onClose,
  patientName,
  phone,
  onApplyBenefits,
  onApplyPrivatePay,
}: InsuranceLookupModalProps) {
  const [activeTab, setActiveTab] = useState<"text" | "image" | "portals">("text");
  const [portalText, setPortalText] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string>("image/png");
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<InsuranceVerificationResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // API Key management
  const [showKeyConfig, setShowKeyConfig] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(getGeminiApiKey());
  const [apiKeySaved, setApiKeySaved] = useState(false);

  // Copied indicator
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setApiKeyInput(getGeminiApiKey());
  }, [isOpen]);

  // Global paste handler to catch clipboard screenshot snippets when modal is open
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (loadEvent) => {
              setImagePreview(loadEvent.target?.result as string);
              setImageMimeType(file.type);
              setActiveTab("image");
            };
            reader.readAsDataURL(file);
            break;
          }
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = (text: string, field: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSaveApiKey = () => {
    setGeminiApiKey(apiKeyInput);
    setApiKeySaved(true);
    setTimeout(() => setApiKeySaved(false), 2000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setImagePreview(event.target?.result as string);
      setImageMimeType(file.type || "image/png");
      setActiveTab("image");
    };
    reader.readAsDataURL(file);
  };

  const handleVerify = async () => {
    if (!portalText.trim() && !imagePreview) {
      setErrorMessage("Please paste portal text, a screenshot, or load a sample.");
      return;
    }

    setIsVerifying(true);
    setErrorMessage(null);

    try {
      const res = await verifyInsuranceWithAI(
        {
          text: portalText.trim() || undefined,
          imageBase64: imagePreview || undefined,
          imageMimeType: imageMimeType,
          patientNameHint: patientName,
        },
        apiKeyInput
      );
      setResult(res);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to analyze insurance eligibility.");
    } finally {
      setIsVerifying(false);
    }
  };

  const loadSample = (sampleKey: keyof typeof SAMPLE_PORTAL_SNIPPETS) => {
    const sample = SAMPLE_PORTAL_SNIPPETS[sampleKey];
    setPortalText(sample.text);
    setImagePreview(null);
    setActiveTab("text");
    setResult(null);
    setErrorMessage(null);
  };

  const handleReset = () => {
    setPortalText("");
    setImagePreview(null);
    setResult(null);
    setErrorMessage(null);
  };

  return (
    <div className="fixed inset-0 z-[1100] bg-black/75 backdrop-blur-sm flex justify-center items-start overflow-y-auto p-4 sm:p-6 transition-all">
      <div className="bg-slate-900 text-white rounded-3xl w-full max-w-4xl shadow-2xl border border-slate-700 overflow-hidden my-4 flex flex-col">
        {/* Header */}
        <div className="bg-slate-800/90 border-b border-slate-700 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-600/30 border border-indigo-500/40 text-indigo-400">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                Insurance Eligibility & Benefit Checker
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold lowercase">
                  ai-powered
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                Lookup coverage, verify benefits, and safely auto-price eyewear quotes.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowKeyConfig(!showKeyConfig)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all border border-slate-700 text-xs flex items-center gap-1.5"
              title="API Key Configuration"
            >
              <Key className="w-4 h-4" />
              <span className="hidden sm:inline font-bold">API Key</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* API Key Banner (Collapsible) */}
        {showKeyConfig && (
          <div className="bg-slate-950 border-b border-slate-800 px-6 py-3.5 flex flex-col sm:flex-row items-center gap-3">
            <div className="flex-1 w-full flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 whitespace-nowrap">
                Gemini API Key:
              </span>
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="AIzaSy... (leave blank to use offline parser)"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <button
              onClick={handleSaveApiKey}
              className="w-full sm:w-auto px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all"
            >
              {apiKeySaved ? <Check className="w-3.5 h-3.5" /> : null}
              {apiKeySaved ? "Saved" : "Save Key"}
            </button>
          </div>
        )}

        {/* Patient Quick Info & Quick Portals Bar */}
        <div className="bg-slate-950/70 border-b border-slate-800 px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4">
            <span className="text-slate-400 font-semibold">Active Patient:</span>
            <span className="font-black text-white text-sm">
              {patientName ? patientName.toUpperCase() : "NO PATIENT SELECTED"}
            </span>
            {patientName && (
              <button
                onClick={() => handleCopy(patientName, "name")}
                className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 font-bold bg-indigo-500/10 px-2 py-0.5 rounded-lg border border-indigo-500/20"
              >
                {copiedField === "name" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copiedField === "name" ? "Copied" : "Copy Name"}
              </button>
            )}
            {phone && (
              <button
                onClick={() => handleCopy(phone, "phone")}
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white font-bold bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700"
              >
                {copiedField === "phone" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copiedField === "phone" ? "Copied" : "Copy Phone"}
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-500 font-bold text-[10px] uppercase tracking-wider mr-1">
              Launch Portal:
            </span>
            {PROVIDER_PORTALS.map((portal) => (
              <a
                key={portal.name}
                href={portal.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-bold border border-slate-700 transition-all"
              >
                {portal.name}
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>
            ))}
          </div>
        </div>

        {/* Main Body */}
        <div className="p-6 space-y-6 flex-1 overflow-y-auto max-h-[70vh]">
          {/* Quick Demo Pre-sets for testing */}
          <div className="bg-slate-800/50 rounded-2xl p-3 border border-slate-700 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-indigo-400" /> Test With Sample Portal Data:
            </span>
            <button
              onClick={() => loadSample("activeEyeMed")}
              className="text-[11px] font-bold px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 transition-all"
            >
              EyeMed (Active $150)
            </button>
            <button
              onClick={() => loadSample("inactiveTerminated")}
              className="text-[11px] font-bold px-3 py-1 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 transition-all"
            >
              VSP (Terminated / No Benefits)
            </button>
            <button
              onClick={() => loadSample("exhaustedBenefit")}
              className="text-[11px] font-bold px-3 py-1 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/30 transition-all"
            >
              Spectera (Benefit Exhausted)
            </button>
            <button
              onClick={() => loadSample("wellcareAllowance")}
              className="text-[11px] font-bold px-3 py-1 rounded-lg bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 border border-sky-500/30 transition-all"
            >
              Wellcare ($350 Allowance)
            </button>
          </div>

          {/* Input Tabs */}
          <div className="flex border-b border-slate-700 gap-2">
            <button
              onClick={() => setActiveTab("text")}
              className={`pb-2.5 px-4 text-xs font-black uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all ${
                activeTab === "text"
                  ? "border-indigo-500 text-white"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <FileText className="w-4 h-4" />
              1. Paste Portal Text
            </button>
            <button
              onClick={() => setActiveTab("image")}
              className={`pb-2.5 px-4 text-xs font-black uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all ${
                activeTab === "image"
                  ? "border-indigo-500 text-white"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              2. Paste Screenshot (Ctrl+V) / Upload
            </button>
          </div>

          {/* Tab 1: Text Paste */}
          {activeTab === "text" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300">
                  Select and copy patient eligibility summary text from your provider portal, then paste below:
                </label>
                {portalText && (
                  <button
                    onClick={() => setPortalText("")}
                    className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" /> Clear Text
                  </button>
                )}
              </div>
              <textarea
                value={portalText}
                onChange={(e) => setPortalText(e.target.value)}
                placeholder="Paste eligibility sheet text here (e.g. from VSP Eyefinity, EyeMed Provider Access, Spectera, KyHealth Net, or Availity)..."
                rows={6}
                className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-4 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500 placeholder-slate-600 leading-relaxed"
              />
            </div>
          )}

          {/* Tab 2: Image / Screenshot Paste */}
          {activeTab === "image" && (
            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />

              {!imagePreview ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-2xl p-8 text-center cursor-pointer bg-slate-950/50 hover:bg-slate-950 transition-all flex flex-col items-center justify-center gap-3"
                >
                  <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-400">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase text-slate-200">
                      Click to upload an eligibility screenshot or document
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Tip: You can also press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">Ctrl+V</kbd> anywhere in this window to paste a clipped screenshot!
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400" /> Screenshot attached
                    </span>
                    <button
                      onClick={() => setImagePreview(null)}
                      className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 font-bold"
                    >
                      <RotateCcw className="w-3 h-3" /> Remove image
                    </button>
                  </div>
                  <div className="max-h-56 overflow-hidden rounded-xl border border-slate-700 bg-slate-950 flex items-center justify-center p-2">
                    <img
                      src={imagePreview}
                      alt="Eligibility Screenshot"
                      className="max-h-52 object-contain rounded-lg"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Verify Action Button */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleVerify}
              disabled={isVerifying || (!portalText.trim() && !imagePreview)}
              className="flex-1 py-3.5 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black uppercase text-xs tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all"
            >
              {isVerifying ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Analyzing Vision Eligibility with Gemini AI...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Analyze Eligibility & Extract Pricing Rules
                </>
              )}
            </button>

            {(portalText || imagePreview || result) && (
              <button
                onClick={handleReset}
                className="px-4 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-bold transition-all border border-slate-700"
              >
                Reset
              </button>
            )}
          </div>

          {errorMessage && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* RESULTS CARD & CAUTION DISPLAY */}
          {result && (
            <div className="space-y-4 pt-2">
              {/* === CASE 1: NO BENEFITS / INACTIVE / TERMINATED === */}
              {!result.hasBenefits ? (
                <div className="rounded-3xl bg-rose-950/40 border-2 border-rose-500/80 p-6 space-y-4 shadow-xl">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0">
                      <ShieldAlert className="w-8 h-8 text-rose-500 animate-pulse" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-rose-500 text-white">
                          Status: {result.eligibilityStatus}
                        </span>
                        <span className="text-xs font-bold text-rose-300">
                          {result.carrierName || "Insurance"}
                        </span>
                      </div>
                      <h3 className="text-lg font-black text-rose-100 uppercase tracking-tight flex items-center gap-2">
                        ⚠️ CAUTION: PATIENT HAS NO ACTIVE VISION BENEFITS
                      </h3>
                      <p className="text-xs text-rose-200/90 font-medium">
                        {result.statusReason}
                      </p>
                    </div>
                  </div>

                  {/* Warning Notice Box */}
                  <div className="bg-rose-900/30 border border-rose-500/40 rounded-2xl p-4 text-xs text-rose-200 space-y-1.5">
                    <div className="font-black uppercase tracking-wide flex items-center gap-1.5 text-rose-300">
                      <AlertTriangle className="w-4 h-4" /> Pricing Safety Warning:
                    </div>
                    <p className="leading-relaxed">
                      Do <strong>NOT</strong> apply insurance discounts, copays, or frame allowances to this job. If glasses are dispensed, the patient must be billed at <strong>Private Pay / Retail pricing</strong>.
                    </p>
                    {result.warnings && result.warnings.length > 0 && (
                      <ul className="list-disc list-inside text-rose-300/80 text-[11px] pt-1 space-y-0.5">
                        {result.warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Actions for No Benefits */}
                  <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                    <button
                      onClick={() => {
                        onApplyPrivatePay();
                        onClose();
                      }}
                      className="w-full sm:flex-1 py-3 px-5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black uppercase text-xs tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30 transition-all"
                    >
                      <DollarSign className="w-4 h-4" />
                      Set Patient as Private Pay (Cash / Retail Rates)
                    </button>
                    <button
                      onClick={onClose}
                      className="w-full sm:w-auto py-3 px-5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all"
                    >
                      Close Without Applying
                    </button>
                  </div>
                </div>
              ) : (
                /* === CASE 2: ACTIVE BENEFITS VERIFIED === */
                <div className="rounded-3xl bg-emerald-950/40 border-2 border-emerald-500/80 p-6 space-y-4 shadow-xl">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                        <ShieldCheck className="w-8 h-8 text-emerald-400" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500 text-white">
                            Status: ACTIVE
                          </span>
                          <span className="text-xs font-black text-emerald-300">
                            {result.matchedPlan}
                          </span>
                        </div>
                        <h3 className="text-lg font-black text-emerald-100 uppercase tracking-tight">
                          Active Vision Benefits Verified
                        </h3>
                        <p className="text-xs text-emerald-200/90 font-medium">
                          {result.statusReason}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                        {result.isAllowancePlan ? "Total Allowance" : "Frame Allowance"}
                      </span>
                      <span className="text-2xl font-black text-white">
                        ${result.isAllowancePlan ? result.globalAllowance : result.frameAllowance}
                      </span>
                    </div>
                  </div>

                  {/* Summary Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-900/90 border border-emerald-500/30 rounded-2xl p-4 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-black block">Matched Plan</span>
                      <span className="font-bold text-white">{result.matchedPlan}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-black block">Frame Allowance</span>
                      <span className="font-bold text-white">${result.frameAllowance || 0}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-black block">Plan Type</span>
                      <span className="font-bold text-white">
                        {result.isAllowancePlan ? `Allowance ($${result.globalAllowance})` : "Standard Tier / Copay"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-emerald-400 uppercase font-black block">Progressive Copay</span>
                      <span className="font-bold text-white">
                        {result.progressiveCopay ? `$${result.progressiveCopay}.00` : (result.isAllowancePlan ? "Under Allowance" : "N/A")}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-emerald-400 uppercase font-black block">A/R Coating Copay</span>
                      <span className="font-bold text-white">
                        {result.arCopay ? `$${result.arCopay}.00` : (result.isAllowancePlan ? "Under Allowance" : "N/A")}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-black block">Materials Copay</span>
                      <span className="font-bold text-white">
                        {result.materialsCopay ? `$${result.materialsCopay}.00` : "Included"}
                      </span>
                    </div>
                  </div>

                  {result.rawSummary && (
                    <div className="p-3 bg-emerald-900/20 border border-emerald-500/20 rounded-xl text-xs text-emerald-200/90">
                      <strong>AI Summary: </strong>
                      {result.rawSummary}
                    </div>
                  )}

                  {/* Apply Button */}
                  <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                    <button
                      onClick={() => {
                        onApplyBenefits(result);
                        onClose();
                      }}
                      className="w-full sm:flex-1 py-3.5 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase text-xs tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all"
                    >
                      <Check className="w-4 h-4" />
                      Apply Benefits to Patient Quote
                    </button>
                    <button
                      onClick={onClose}
                      className="w-full sm:w-auto py-3 px-5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
