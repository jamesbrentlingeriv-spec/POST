import React, { useState, useEffect, useRef } from "react";
import { database } from "./firebase";
import {
  ref,
  onValue,
  set,
  push,
  serverTimestamp,
  limitToLast,
  query,
} from "firebase/database";
import {
  Printer,
  Trash2,
  UserPlus,
  CreditCard,
  ShieldCheck,
  Stethoscope,
  Search,
  Plus,
  History,
  LogOut,
  Moon,
  Sun,
  AlertCircle,
  FileText,
  X,
  ChevronDown,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  USERS,
  MASTER_PRICE_LIST,
  LEXINGTON_SCHOOLS,
  MEDICAID_TYPES,
  MEDICAID_CODES,
} from "./constants";
import { InsurancePlan, RxValue, BillingRow, JobSnapshot } from "./types";
import { SignaturePad } from "./components/SignaturePad";
import { MeasurementTool } from "./components/MeasurementTool";
import { PatientForm } from "./components/PatientForm";
import { Catalog } from "./components/Catalog";

// Utility for formatting numbers to currency
const f = (n: number | string) => {
  const val = typeof n === "string" ? parseFloat(n) : n;
  return isNaN(val) ? "0.00" : val.toFixed(2);
};

export default function App() {
  // --- APP STATE ---
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  // --- AUTH STATE ---
  const [user, setUser] = useState<{ name: string; initials: string } | null>(
    null,
  );
  const [loginForm, setLoginForm] = useState({ name: "", pass: "" });
  const [loginError, setLoginError] = useState(false);

  // --- JOB STATE ---
  const [jobNum, setJobNum] = useState(31599);
  const [history, setHistory] = useState<any[]>([]);

  // --- FORM STATE ---
  const [patient, setPatient] = useState("");
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [showMailPopup, setShowMailPopup] = useState(false);
  const [mailAddress, setMailAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [plan, setPlan] = useState<InsurancePlan>("None");
  const [dr, setDr] = useState("");
  const [drOther, setDrOther] = useState("");
  const [frame, setFrame] = useState("");
  const [frameA, setFrameA] = useState("");
  const [frameDbl, setFrameDbl] = useState("");
  const [pd, setPd] = useState("");
  const [seg, setSeg] = useState("");
  const [medicaidType, setMedicaidType] = useState("Regular");
  const [medicaidCode, setMedicaidCode] = useState("92340");
  const [schoolName, setSchoolName] = useState("");
  const [colorType, setColorType] = useState("CLEAR");
  const [colorDetail, setColorDetail] = useState("");

  // Rx State
  const [rx, setRx] = useState({
    od: { sph: "", cyl: "", axis: "", add: "", prism: "", prismBase: "BO", prism2: "", prismBase2: "BO", hasPrism: false, hasCompoundPrism: false },
    os: { sph: "", cyl: "", axis: "", add: "", prism: "", prismBase: "BO", prism2: "", prismBase2: "BO", hasPrism: false, hasCompoundPrism: false },
  });

  // Billing State
  const [billing, setBilling] = useState<Record<string, BillingRow>>({
    frame: { label: "FRAME", retail: "", retailWithTax: "0.00", owe: "0.00" },
    lens: { label: "LENS", retail: "", retailWithTax: "0.00", owe: "0.00" },
    coat: {
      label: "A/R COATING",
      retail: "",
      retailWithTax: "0.00",
      owe: "0.00",
    },
    m1: { label: "MISC 1", retail: "", retailWithTax: "0.00", owe: "0.00" },
    m2: { label: "MISC 2", retail: "", retailWithTax: "0.00", owe: "0.00" },
    m3: { label: "MISC 3", retail: "", retailWithTax: "0.00", owe: "0.00" },
  });

  const [payMethod, setPayMethod] = useState("");
  const [checkNum, setCheckNum] = useState("");
  const [showCardMenu, setShowCardMenu] = useState(false);

  const cardTypes = ["Visa", "Mastercard", "Discover", "Amex", "HSA/FSA"];

  const [cardType, setCardType] = useState("");

  // Promised State
  const [promise, setPromise] = useState({
    call: false,
    text: false,
    mail: false,
    time: false,
    timeVal: "",
  });

  // Toggle mail fee
  useEffect(() => {
    if (promise.mail) {
      updateBillingRow("m1", { label: "MAIL FEE", retail: "9.00", owe: "9.54" });
      if (!mailAddress) setShowMailPopup(true);
    } else {
      if (billing.m1.label === "MAIL FEE") {
        updateBillingRow("m1", { label: "", retail: "", owe: "" });
      }
    }
  }, [promise.mail]);

  const handleRxChange = (eye: 'od' | 'os', field: string, value: string) => {
    // Only numbers and decimals
    if (value !== "" && !/^-?\d*\.?\d*$/.test(value)) return;
    
    // Axis validation 1-180
    if (field === "axis" && value !== "") {
      const num = parseInt(value);
      if (!isNaN(num) && num > 180) return;
    }

    setRx({
      ...rx,
      [eye]: {
        ...(rx as any)[eye],
        [field]: value,
      },
    });
  };

  // Waivers / Flags
  const [waivers, setWaivers] = useState({
    expired: false,
    pof: false,
    thick: false,
    poly: false,
    noline: false,
    semirim: false,
    remake: false,
  });
  const [remakeReason, setRemakeReason] = useState("");
  const [rxFlags, setRxFlags] = useState({
    dvo: false,
    nvo: false,
    ivo: false,
    diff: false,
  });

  // Insurance Logic Flags
  const [isAllowancePlan, setIsAllowancePlan] = useState(false);
  const [globalAllowance, setGlobalAllowance] = useState(0);
  const [frameAllowance, setFrameAllowance] = useState(0);

  // UI State
  const [showMeasureTool, setShowMeasureTool] = useState(false);
  const [showPatientForm, setShowPatientForm] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [signature, setSignature] = useState("");
  const [isPrinting, setIsPrinting] = useState(false);

  // --- INITIALIZATION & FIREBASE ---
  useEffect(() => {
    // Sync Job Number
    const jRef = ref(database, "lastJobNumber");
    onValue(jRef, (snap) => setJobNum(snap.val() || 31599));

    // Sync History
    const hQuery = query(ref(database, "jobHistory"), limitToLast(20));
    onValue(hQuery, (snap) => {
      const data = snap.val();
      if (data) setHistory(Object.values(data).reverse());
    });
  }, []);

  // --- CORE LOGIC FUNCTIONS ---

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const u = USERS[loginForm.name.toUpperCase()];
    if (u && u.pass === loginForm.pass) {
      setUser({ name: loginForm.name.toUpperCase(), initials: u.initials });
      setLoginError(false);
    } else {
      setLoginError(true);
    }
  };

  const handleColorChoice = (type: string) => {
    setColorType(type);
    if (type === "CLEAR") {
      setColorDetail("");
      return;
    }

    let q = "color detail";
    if (type === "TINT") q = "tint color/shade";
    if (type === "POLAR") q = "polarized color (Grey/Brown etc)";
    if (type === "MIRROR") q = "mirror coating color";
    if (type === "TRANS") q = "transitions color (Grey/Brown etc)";

    const resp = prompt(`Selection: ${type}. Enter ${q}:`, "");
    if (!resp) return;
    setColorDetail(resp);

    // If not clear, check for commercial insurance and add to misc line
    if (plan !== "None" && plan !== "MEDICAID" && plan !== "SCHOOL LETTER") {
      // Get price from price list
      let itemPrice = 0;
      if (type === "TINT") itemPrice = 20.0;
      else if (type === "MIRROR") itemPrice = 160.0;
      else if (type === "POLAR") itemPrice = 80.0;
      else if (type === "TRANS") itemPrice = 110.0;

      const taxedAmount = itemPrice * 1.06;
      let oweAmount = 0;

      if (!isAllowancePlan) {
        // STANDARD COMMERCIAL: Prompt for Copay
        const copayStr = prompt(`What is the copay for ${type}?`, "0");
        if (copayStr === null) return;
        const copay = parseFloat(copayStr) || 0;
        oweAmount = copay * 1.06;
      } else {
        // ALLOWANCE PLAN: Prompt for allowance
        const allowanceStr = prompt(
          `What is the insurance allowance for ${type}?`,
          "0",
        );
        if (allowanceStr === null) return;
        const allowance = parseFloat(allowanceStr) || 0;
        oweAmount = Math.max(0, taxedAmount - allowance);
      }

      // Find first empty misc row and fill it
      setBilling((prev) => {
        const next = { ...prev };
        const rowKeys = ["m1", "m2", "m3"];
        for (const rowId of rowKeys) {
          if (next[rowId].label === "" || next[rowId].label.includes("MISC")) {
            next[rowId] = {
              label: `${type}: ${resp.toUpperCase()}`,
              retail: itemPrice.toString(),
              retailWithTax: taxedAmount.toFixed(2),
              owe: oweAmount.toFixed(2),
            };
            break;
          }
        }
        return next;
      });
    }
  };

  const handleInsuranceChange = (newPlan: InsurancePlan) => {
    setPlan(newPlan);
    setIsAllowancePlan(false);
    setGlobalAllowance(0);
    setFrameAllowance(0);

    let localIsAllowance = false;
    let localGlobalAllowance = 0;
    let localFrameAllowance = 0;

    if (newPlan === "WELLCARE MEDICARE") {
      localIsAllowance = true;
      setIsAllowancePlan(true);
      const input = prompt("Enter WELLCARE MEDICARE Total Allowance Amount (e.g. 350):", "0");
      localGlobalAllowance = parseFloat(input || "0") || 0;
      setGlobalAllowance(localGlobalAllowance);
      alert(
        `Allowance Plan Active. $${localGlobalAllowance} will be deducted from the Retail cost of the glasses.`,
      );
    } else if (
      newPlan !== "MEDICAID" &&
      newPlan !== "SCHOOL LETTER" &&
      newPlan !== "None"
    ) {
      // 1. ASK IF ALLOWANCE PLAN
      if (
        confirm(
          "Is this an ALLOWANCE PLAN? (e.g. $350 total allowance to use freely)\nClick OK for YES.\nClick Cancel for NO.",
        )
      ) {
        localIsAllowance = true;
        setIsAllowancePlan(true);
        const input = prompt("Enter Total Allowance Amount (e.g. 350):", "0");
        localGlobalAllowance = parseFloat(input || "0") || 0;
        setGlobalAllowance(localGlobalAllowance);
        alert(
          `Allowance Plan Active. $${localGlobalAllowance} will be deducted from the Retail cost of the glasses.`,
        );
      } else {
        // CHECK FOR FRAME ALLOWANCE CONDITION
        const isEyeMedGroup =
          newPlan === "EYE-MED" ||
          newPlan === "AETNA EYE-MED" ||
          newPlan === "MARCH/EYESYNERGY";

        if (newPlan === "VSP" || isEyeMedGroup) {
          const amt = prompt(
            `Enter ${newPlan} FRAME allowance amount (e.g. 150):`,
            "150",
          );
          localFrameAllowance = parseFloat(amt || "0") || 0;
          setFrameAllowance(localFrameAllowance);
        }
      }
    }

    // Refresh all billing rows with new calculation (resetting to basic tax or insurance logic)
    setBilling((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        const row = next[key];
        if (row.retail) {
          const r = parseFloat(row.retail) || 0;
          let oweVal = r * 1.06;

          if (newPlan === "MEDICAID" || newPlan === "SCHOOL LETTER") {
            oweVal = 0;
          } else if (
            key === "frame" &&
            !localIsAllowance &&
            (newPlan === "VSP" ||
              newPlan === "EYE-MED" ||
              newPlan === "AETNA EYE-MED" ||
              newPlan === "MARCH/EYESYNERGY")
          ) {
            const overage = Math.max(0, r - localFrameAllowance);
            oweVal = overage * 0.8 * 1.06;
          }

          next[key] = { ...row, owe: oweVal.toFixed(2) };
        }
      });
      return next;
    });
  };

  const calcOwe = (retail: string, key: string) => {
    const r = parseFloat(retail) || 0;
    if (plan === "MEDICAID" || plan === "SCHOOL LETTER") return "0.00";
    if (plan === "None") return (r * 1.06).toFixed(2);

    // EyeMed Allowance Logic: (Total Retail - Global Allowance) - 20%
    if (isAllowancePlan && globalAllowance > 0) {
      // This is handled in finalOwe but we can reflect it per line if needed
      // Actually the prompt says: "if its eyemed allowance plan it also takes 20% off the leftover amount then puts that in the pt owe box"
      // This implies the calculation applies to the total.
      return (r * 1.06).toFixed(2);
    }

    // Frame Allowance logic for VSP or EyeMed Non-Allowance
    const isVSP = plan === "VSP";
    const isEyeMedGroup =
      plan === "EYE-MED" ||
      plan === "AETNA EYE-MED" ||
      plan === "MARCH/EYESYNERGY";

    if (key === "frame" && (isVSP || (isEyeMedGroup && !isAllowancePlan))) {
      const overage = Math.max(0, r - frameAllowance);
      // 20% discount on overage + 6% tax
      return (overage * 0.8 * 1.06).toFixed(2);
    }

    if (isAllowancePlan && isEyeMedGroup) {
      // In allowance plans, individual rows show full price with tax, 
      // but the final total handles the global discount.
      return (r * 1.06).toFixed(2);
    }

    return (r * 1.06).toFixed(2);
  };

  const updateBillingRow = (key: string, updates: Partial<BillingRow>) => {
    setBilling((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...updates },
    }));
  };

  const handleCatalogSelect = (name: string, price: number, cat: string) => {
    const isMiscCat =
      cat === "Tints and Coatings" ||
      cat === "Overpower/Oversize" ||
      cat === "Miscellaneous";
    const isAntiGlare =
      name.toUpperCase().includes("ANTI-GLARE") ||
      name.toUpperCase().includes("AR COAT") ||
      name.toUpperCase().includes("A/R") ||
      cat === "A/R Coatings";
    const isCommercial =
      plan !== "None" && plan !== "MEDICAID" && plan !== "SCHOOL LETTER";

    let targetRow = "lens";
    if (isAntiGlare) {
      targetRow = "coat";
    } else if (isMiscCat) {
      // Find empty misc row
      if (billing.m1.retail === "") targetRow = "m1";
      else if (billing.m2.retail === "") targetRow = "m2";
      else if (billing.m3.retail === "") targetRow = "m3";
      else {
        alert("Misc fields full - please clear one to add more.");
        return;
      }
    }

    let oweValStr = "0.00";
    if (isCommercial) {
      // Logic for copays and allowances
      if (
        plan === "EYE-MED" ||
        plan === "AETNA EYE-MED" ||
        plan === "MARCH/EYESYNERGY"
      ) {
        const isAllowance = window.confirm("Is this an ALLOWANCE plan?");
        if (isAllowance) {
          setIsAllowancePlan(true);
          const amt = window.prompt("Enter Allowance Amount:", "150");
          if (amt) {
            setGlobalAllowance(parseFloat(amt));
            oweValStr = (price * 1.06).toFixed(2);
          }
        } else {
          setIsAllowancePlan(false);
          const cp = window.prompt(`Enter CO-PAY for ${name}:`, "0");
          if (cp !== null) {
            oweValStr = (parseFloat(cp) * 1.06).toFixed(2);
          }
        }
      } else {
        // VSP or other commercial
        const cp = window.prompt(`Enter CO-PAY for ${name}:`, "0");
        if (cp !== null) {
          oweValStr = (parseFloat(cp) * 1.06).toFixed(2);
        }
      }
    } else {
      oweValStr = (price * 1.06).toFixed(2);
    }

    updateBillingRow(targetRow, {
      retail: price.toString(),
      label: isMiscCat || isAntiGlare ? name : `LENS: ${name}`,
      retailWithTax: (price * 1.06).toFixed(2),
      owe: oweValStr,
    });

    const nameUpper = name.toUpperCase();
    let promptMsg = "";
    if (nameUpper.includes("TRANS")) promptMsg = "What color for Transitions?";
    else if (nameUpper.includes("TINT")) promptMsg = "What tint color/shade?";
    else if (nameUpper.includes("POLAR")) promptMsg = "What polarized color?";
    else if (nameUpper.includes("MIRROR"))
      promptMsg = "What mirror coating color?";

    if (promptMsg) {
      const resp = window.prompt(promptMsg, "");
      if (resp) {
        updateBillingRow(targetRow, {
          label: `${isMiscCat || isAntiGlare ? name : `LENS: ${name}`} (${resp})`,
        });
        setColorType(
          nameUpper.includes("TRANS")
            ? "TRANS"
            : nameUpper.includes("TINT")
              ? "TINT"
              : nameUpper.includes("POLAR")
                ? "POLAR"
                : "MIRROR",
        );
        setColorDetail(resp);
      }
    }

    // Auto-close catalog on mobile
    if (window.innerWidth < 768) setShowCatalog(false);
  };

  // --- AUTOMATIC REASONING (The "If" Functions) ---
  useEffect(() => {
    // 1. Oversize Check
    const size = parseFloat(frameA) || 0;
    if (size >= 58) {
      // Check if already in misc
      const alreadyCharged = Object.values(billing).some(
        (b: any) => b.autoChargeKey === "oversize",
      );
      if (!alreadyCharged) {
        const row =
          billing.m1.retail === ""
            ? "m1"
            : billing.m2.retail === ""
              ? "m2"
              : "m3";
        updateBillingRow(row, {
          label: "EYESIZE 58+",
          retail: "20.00",
          retailWithTax: "21.20",
          owe: plan === "None" ? "21.20" : "0.00",
          autoChargeKey: "oversize",
        });
      }
    }

    // 2. RX Evaluation (Prism Check)
    const hasPrism = rx.od.hasPrism || rx.os.hasPrism;
    if (hasPrism) {
      const alreadyCharged = Object.values(billing).some(
        (b: any) => b.autoChargeKey === "prism",
      );
      if (!alreadyCharged) {
        const row =
          billing.m1.retail === ""
            ? "m1"
            : billing.m2.retail === ""
              ? "m2"
              : "m3";
        updateBillingRow(row, {
          label: "PRISM CHARGE",
          retail: "10.00",
          retailWithTax: "10.60",
          owe: plan === "None" ? "10.60" : "0.00",
          autoChargeKey: "prism",
        });
      }
    }

    // 3. SPH Check
    const parseRx = (val: string) =>
      Math.abs(parseFloat(val.replace(/[^0-9.-]/g, "")) || 0);
    const maxSph = Math.max(parseRx(rx.od.sph), parseRx(rx.os.sph));
    if (maxSph >= 8) {
      const already = Object.values(billing).some(
        (b: any) => b.autoChargeKey === "sph8",
      );
      if (!already) {
        const row =
          billing.m1.retail === ""
            ? "m1"
            : billing.m2.retail === ""
              ? "m2"
              : "m3";
        updateBillingRow(row, {
          label: "OVER ±8.00 SPH",
          retail: "20.00",
          retailWithTax: "21.20",
          owe: plan === "None" ? "21.20" : "0.00",
          autoChargeKey: "sph8",
        });
      }
    } else if (maxSph >= 4) {
      const already = Object.values(billing).some(
        (b: any) => b.autoChargeKey === "sph4",
      );
      if (!already) {
        const row =
          billing.m1.retail === ""
            ? "m1"
            : billing.m2.retail === ""
              ? "m2"
              : "m3";
        updateBillingRow(row, {
          label: "OVER ±4.00 SPH",
          retail: "10.00",
          retailWithTax: "10.60",
          owe: plan === "None" ? "10.60" : "0.00",
          autoChargeKey: "sph4",
        });
      }
    }

    // 4. ADD Check
    const maxAdd = Math.max(parseRx(rx.od.add), parseRx(rx.os.add));
    if (maxAdd >= 4) {
      const already = Object.values(billing).some(
        (b: any) => b.autoChargeKey === "add4",
      );
      if (!already) {
        const row =
          billing.m1.retail === ""
            ? "m1"
            : billing.m2.retail === ""
              ? "m2"
              : "m3";
        updateBillingRow(row, {
          label: "ADD OVER +4.00",
          retail: "30.00",
          retailWithTax: "31.80",
          owe: plan === "None" ? "31.80" : "0.00",
          autoChargeKey: "add4",
        });
      }
    } else if (maxAdd >= 3) {
      const already = Object.values(billing).some(
        (b: any) => b.autoChargeKey === "add3",
      );
      if (!already) {
        const row =
          billing.m1.retail === ""
            ? "m1"
            : billing.m2.retail === ""
              ? "m2"
              : "m3";
        updateBillingRow(row, {
          label: "ADD OVER +3.00",
          retail: "15.00",
          retailWithTax: "15.90",
          owe: plan === "None" ? "15.90" : "0.00",
          autoChargeKey: "add3",
        });
      }
    }
  }, [frameA, rx]);

  // --- TOTAL CALCULATIONS ---
  const totals = (Object.values(billing) as any[]).reduce(
    (acc, b) => {
      acc.retail += parseFloat(b.retail) || 0;
      acc.owe += parseFloat(b.owe) || 0;
      return acc;
    },
    { retail: 0, owe: 0 },
  );

  let finalOwe = totals.owe;
  if (isAllowancePlan && globalAllowance > 0) {
    const overage = Math.max(0, totals.retail - globalAllowance);
    const isEyeMedGroup =
      plan === "EYE-MED" ||
      plan === "AETNA EYE-MED" ||
      plan === "MARCH/EYESYNERGY";
    if (isEyeMedGroup) {
      // 20% off the overage
      finalOwe = overage * 0.8 * 1.06;
    } else {
      finalOwe = overage * 1.06;
    }
  }

  // --- SUBMISSION ---
  const handlePrint = async () => {
    const snapshot: JobSnapshot = {
      jobNum,
      optician: user.initials,
      patient,
      plan,
      dr: dr === "Other" ? drOther : dr,
      frame,
      pd,
      seght: seg,
      lensName: billing.lens.label,
      rx,
      billing,
      timestamp: serverTimestamp() as any,
    };

    try {
      await push(ref(database, "jobHistory"), snapshot);
      await set(ref(database, "lastJobNumber"), jobNum + 1);

      // Visual feedback
      setIsPrinting(true);
      setTimeout(() => {
        window.print();
        setIsPrinting(false);
      }, 500);
    } catch (err) {
      alert("Database error: " + err);
    }
  };

  // --- SPLASH SCREEN ---
  if (showSplash) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black z-[9999]" id="splash-screen">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.1 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center gap-6"
        >
          <img 
            src="/android-chrome-512x512.png" 
            alt="POST" 
            className="w-48 h-48 object-contain"
          />
          <div className="flex flex-col items-center gap-2">
            <h1 className="text-3xl font-bold text-white tracking-tight">POST</h1>
            <h2 className="text-white text-sm uppercase tracking-widest font-medium">PAL optical slip tool</h2>
            <div className="w-48 h-1 bg-zinc-800 rounded-full overflow-hidden mt-2">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ duration: 2.5, ease: "linear" }}
                className="h-full bg-white"
              />
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // --- LOGIN SECURITY ---
  if (!user) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 transition-all ${theme === 'dark' ? 'theme-dark bg-theme-bg' : 'bg-slate-100'}`}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-theme-card rounded-2xl shadow-sm p-8 w-full max-w-sm border-theme-main"
        >
          <div className="text-center mb-8">
            <h1 className="text-4xl font-black italic tracking-tighter text-theme-text transition-all">
              P.O.S.T.
            </h1>
            <p className="text-xs font-black text-theme-muted uppercase tracking-widest">
              Pal Optical Slip Tool
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[10px] font-black uppercase text-black mb-1">
                First Name
              </label>
              <input
                type="text"
                required
                className="w-full bg-theme-bg border-theme-border rounded-xl px-4 py-3 outline-none focus:ring-1 focus:ring-theme-accent transition-all font-bold uppercase text-theme-text"
                value={loginForm.name}
                onChange={(e) =>
                  setLoginForm({ ...loginForm, name: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase text-black mb-1">
                Password
              </label>
              <input
                type="password"
                required
                className="w-full bg-theme-bg border-theme-border rounded-xl px-4 py-3 outline-none focus:ring-1 focus:ring-theme-accent transition-all font-bold text-theme-text"
                value={loginForm.pass}
                onChange={(e) =>
                  setLoginForm({ ...loginForm, pass: e.target.value })
                }
              />
            </div>

            {loginError && (
              <p className="text-red-600 text-[10px] font-black uppercase text-center flex items-center justify-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Invalid Patient Order Selection
              </p>
            )}

            <button className="w-full bg-theme-text text-theme-card rounded-xl py-4 font-black uppercase tracking-widest shadow-lg hover:opacity-90 transition-all active:scale-95 border-theme-border">
              Login Device
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  // --- MAIN APP UI ---
  const missingFields: string[] = [];
  const isPrintDisabled = false;

  return (
    <div className={`flex flex-col md:flex-row h-screen overflow-hidden transition-all ${theme === 'dark' ? 'theme-dark bg-theme-bg' : 'bg-slate-50'}`}>
      {/* SIDEBAR REMOVED AS REQUESTED (Consolidated to left stream) */}

      {/* CENTER: WORKBENCH */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-hide">
        <div className="max-w-2xl mx-auto space-y-8">
          {/* HEADER DASHBOARD */}
          <header className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6 transition-colors ${theme === 'dark' ? 'border-white' : 'border-black'}`}>
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-5xl font-black italic tracking-tighter uppercase leading-none text-theme-text">
                  P.O.S.T.
                </h1>
                <p className="text-[10px] font-black text-theme-text uppercase tracking-[0.2em] mt-3">
                  Workbench v2.0 &bull; {user.name}
                </p>
              </div>
              <button
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                className="p-3 bg-theme-card border-theme-border rounded-2xl text-theme-text hover:opacity-80 transition-all flex items-center gap-2"
                title="Toggle Theme"
              >
                {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              </button>
              <button
                onClick={() => setShowCatalog(true)}
                className="p-3 bg-theme-card border-theme-border rounded-2xl text-theme-text hover:opacity-80 transition-all group"
                title="Open Lens Catalog"
              >
                <Search className="w-5 h-5 group-hover:scale-110 transition-transform" />
              </button>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <div className="bg-theme-card p-3 px-5 rounded-2xl border-theme-border">
                <label className="block text-[9px] font-black text-theme-text uppercase">
                  Current Job
                </label>
                <span className="text-xl font-black text-theme-accent">
                  {jobNum}
                </span>
              </div>
              <div className="flex flex-col items-end gap-1">
                <button
                  onClick={handlePrint}
                  disabled={isPrintDisabled}
                  className={`rounded-2xl px-6 py-2 flex items-center gap-2 font-black uppercase text-xs tracking-widest transition-all border-2 ${
                    !isPrintDisabled
                      ? "bg-green-500 border-green-500 text-white hover:bg-green-600 shadow-lg shadow-green-500/30 cursor-pointer"
                      : theme === 'dark'
                      ? "bg-white border-white text-black opacity-50 cursor-not-allowed"
                      : "bg-transparent border-black text-black opacity-50 cursor-not-allowed"
                  }`}
                >
                  <Printer className="w-4 h-4" />
                  Submit Order
                </button>
                {missingFields.length > 0 && (
                  <div className="text-right">
                    <p className="text-[9px] font-black uppercase text-red-500 tracking-widest">⚠ Caution</p>
                    {missingFields.map(f => (
                      <p key={f} className="text-[9px] font-bold text-red-500 uppercase">• {f}</p>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => setUser(null)}
                className="p-3 bg-theme-card border-theme-border rounded-2xl text-theme-text hover:text-red-500"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </header>

          <div className="flex flex-col gap-8 pb-32">
            {/* SINGLE COLUMN: ALL TOGETHER ON LEFT */}
            <section className="bg-theme-card p-6 rounded-3xl border-theme-main space-y-4 transition-all shadow-sm">
              <button
                onClick={() => setShowPatientForm(true)}
                className="w-full bg-theme-card text-theme-text border-theme-border rounded-xl py-3 px-4 flex items-center justify-between font-black uppercase text-[10px] tracking-widest hover:bg-theme-bg transition-all"
              >
                <span className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4" /> New Patient Sheet
                </span>
                <Plus className="w-4 h-4" />
              </button>

              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-black uppercase text-theme-text mb-1">
                    Insurance Plan
                  </label>
                  <select
                    value={plan}
                    onChange={(e) =>
                      handleInsuranceChange(e.target.value as InsurancePlan)
                    }
                    className="w-full bg-theme-bg border-theme-border rounded-xl px-4 py-2.5 font-bold outline-none focus:ring-1 focus:ring-theme-accent text-sm text-theme-text"
                  >
                    <option value="None">Private Pay / None</option>
                    <option value="MEDICAID">MEDICAID</option>
                    <option value="SCHOOL LETTER">SCHOOL LETTER</option>
                    <option value="EYE-MED">EYE-MED</option>
                    <option value="AETNA EYE-MED">AETNA EYE-MED</option>
                    <option value="PREMIER VISION">PREMIER VISION</option>
                    <option value="MARCH/EYESYNERGY">MARCH/EYESYNERGY</option>
                    <option value="UNUM">UNUM</option>
                    <option value="NVA">NVA</option>
                    <option value="VBA">VBA</option>
                    <option value="VSP">VSP</option>
                    <option value="SPECTERA">SPECTERA</option>
                    <option value="WELLCARE MEDICARE">WELLCARE MEDICARE</option>
                  </select>
                </div>

                {plan === "MEDICAID" && (
                  <div className="grid grid-cols-2 gap-3 p-4 bg-theme-bg rounded-2xl border-theme-border">
                    <div>
                      <label className="block text-[9px] font-black uppercase text-theme-text mb-1">
                        Medicaid Type
                      </label>
                      <select
                        value={medicaidType}
                        onChange={(e) => setMedicaidType(e.target.value)}
                        className="w-full bg-theme-bg border-theme-border rounded-lg px-3 py-2 text-xs font-bold focus:ring-1 focus:ring-theme-accent outline-none text-theme-text"
                      >
                        {MEDICAID_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] font-black uppercase text-theme-text mb-1">
                        Medicaid Code
                      </label>
                      <select
                        value={medicaidCode}
                        onChange={(e) => setMedicaidCode(e.target.value)}
                        className="w-full bg-theme-bg border-theme-border rounded-lg px-3 py-2 text-xs font-bold focus:ring-1 focus:ring-theme-accent outline-none text-theme-text"
                      >
                        {MEDICAID_CODES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {plan === "SCHOOL LETTER" && (
                  <div className="p-4 bg-theme-bg rounded-2xl border-theme-border">
                    <label className="block text-[9px] font-black uppercase text-theme-text mb-1">
                      Lexington KY Schools
                    </label>
                    <select
                      value={schoolName}
                      onChange={(e) => setSchoolName(e.target.value)}
                      className="w-full bg-theme-bg border-theme-border rounded-lg px-3 py-2 text-xs font-bold focus:ring-1 focus:ring-theme-accent outline-none text-theme-text"
                    >
                      <option value="">Select School...</option>
                      {LEXINGTON_SCHOOLS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-black uppercase text-theme-text mb-1">
                      Patient Name
                    </label>
                    <input
                      placeholder="Last, First"
                      className="w-full bg-theme-bg border-theme-border rounded-xl px-4 py-2.5 font-bold outline-none focus:ring-1 focus:ring-theme-accent text-sm text-theme-text"
                      value={patient}
                      onChange={(e) => setPatient(e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-black uppercase text-theme-text mb-1">
                      Phone Number
                    </label>
                    <input
                      placeholder="(XXX) XXX-XXXX"
                      className="w-full bg-theme-bg border-theme-border rounded-xl px-4 py-2.5 font-bold outline-none focus:ring-1 focus:ring-theme-accent text-sm text-theme-text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <div className="flex items-center gap-6 py-2">
                      {[
                        { id: "call", label: "Call" },
                        { id: "mail", label: "Mail" },
                        { id: "time", label: "Time" },
                      ].map((p) => (
                        <label
                          key={p.id}
                          className="flex items-center gap-2 cursor-pointer group"
                        >
                          <input
                            type="checkbox"
                            className="w-5 h-5 rounded border-theme-border text-theme-text focus:ring-theme-accent accent-theme-accent"
                            checked={(promise as any)[p.id]}
                            onChange={(e) =>
                              setPromise({
                                ...promise,
                                [p.id]: e.target.checked,
                              })
                            }
                          />
                          <span className="text-[10px] font-black uppercase text-theme-text group-hover:text-theme-accent transition-colors">
                            {p.label}
                          </span>
                        </label>
                      ))}
                    </div>
                    {promise.time && (
                      <div className="md:col-span-2 animate-in slide-in-from-top-2 duration-200">
                        <label className="block text-[10px] font-black uppercase text-black mb-1 italic">
                          Promise Time
                        </label>
                        <input
                          placeholder="e.g. 2:00 PM"
                          className="w-full bg-white border border-black rounded-xl px-4 py-2.5 font-bold outline-none focus:ring-1 focus:ring-black text-sm text-black"
                          value={promise.timeVal}
                          onChange={(e) =>
                            setPromise({ ...promise, timeVal: e.target.value })
                          }
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* MEASUREMENTS */}
            <section className="bg-theme-card p-6 rounded-3xl border-theme-main space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-black uppercase tracking-widest text-theme-text font-bold italic">
                  Measurements
                </h3>
                <button
                  onClick={() => setShowMeasureTool(true)}
                  className="text-[10px] font-black uppercase text-theme-text flex items-center gap-1 hover:underline"
                >
                  <CreditCard className="w-3 h-3 text-theme-accent" /> Use Camera Grid
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-theme-bg p-3 rounded-2xl border-theme-border">
                  <label className="block text-[9px] font-black uppercase text-theme-text font-bold mb-1 tracking-wider">
                    P.D.
                  </label>
                  <input
                    className="w-full bg-transparent font-black text-lg outline-none text-theme-text"
                    value={pd}
                    onChange={(e) => setPd(e.target.value)}
                  />
                </div>
                <div className="bg-theme-bg p-3 rounded-2xl border-theme-border">
                  <label className="block text-[9px] font-black uppercase text-theme-text font-bold mb-1 tracking-wider">
                    Seg Height
                  </label>
                  <input
                    className="w-full bg-transparent font-black text-lg outline-none text-theme-text"
                    value={seg}
                    onChange={(e) => setSeg(e.target.value)}
                  />
                </div>
              </div>
            </section>

            {/* LENS COLORS */}
            <section className="bg-theme-card p-6 rounded-3xl border-theme-border shadow-sm space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-black font-bold italic">
                Lens Options & Colors
              </h3>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-wrap gap-2 items-center">
                  {["CLEAR", "TINT", "POLAR", "MIRROR", "TRANS"].map((type) => (
                    <button
                      key={type}
                      onClick={() => handleColorChoice(type)}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                        colorType === type
                          ? "bg-theme-text border-theme-border text-theme-card shadow-md"
                          : "bg-theme-card border-theme-border text-theme-text hover:bg-theme-bg"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                  
                  {colorType !== "CLEAR" && (
                    <motion.div 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-2 border-b-2 border-black pb-1 ml-2"
                    >
                      <span className="text-[10px] font-black uppercase whitespace-nowrap italic text-black">Color:</span>
                      <input
                        type="text"
                        placeholder="Type color..."
                        className="bg-transparent border-none outline-none font-black uppercase text-[11px] w-32 placeholder:text-slate-400 text-black"
                        value={colorDetail}
                        onChange={(e) => setColorDetail(e.target.value)}
                      />
                    </motion.div>
                  )}
                </div>
              </div>
            </section>

            {/* INTEGRATED Rx & BILLING IN SINGLE COLUMN STREAM */}
            <section className="bg-theme-card p-6 rounded-3xl border-theme-main space-y-4 transition-all">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-widest text-theme-text font-bold italic">
                  Rx Summary
                </h3>
                <span className="p-1 px-2 rounded bg-white text-black font-black text-[9px] uppercase flex items-center gap-1 border border-black">
                  <ShieldCheck className="w-3 h-3 text-green-600" /> Verified
                </span>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col gap-2 p-3 bg-theme-bg rounded-2xl border-theme-border transition-all">
                  <label className="block text-[10px] font-black uppercase text-theme-text">
                    Prescribing Doctor
                  </label>
                  <select
                    className="w-full bg-white border border-black rounded-xl px-4 py-2 font-bold outline-none focus:ring-1 focus:ring-black text-xs text-black"
                    value={dr}
                    onChange={(e) => setDr(e.target.value)}
                  >
                    <option value="">Select Dr...</option>
                    <option value="Steven Klecker">Dr. Steven Klecker</option>
                    <option value="Kathryn Robbins">Dr. Kathryn Robbins</option>
                    <option value="Other">Other...</option>
                  </select>
                  {dr === "Other" && (
                    <input
                      placeholder="Type Doctor Name..."
                      className="w-full bg-white border border-black rounded-xl px-4 py-2 font-bold outline-none focus:ring-1 focus:ring-black text-xs text-black"
                      value={drOther}
                      onChange={(e) => setDrOther(e.target.value)}
                    />
                  )}
                </div>

                {["od", "os"].map((eye) => (
                  <div key={eye} className="grid grid-cols-5 gap-2">
                    <div className="col-span-5 text-[9px] font-black uppercase text-theme-text mb-1 italic">
                      {eye === "od" ? "RIGHT EYE (OD)" : "LEFT EYE (OS)"}
                    </div>
                    {["sph", "cyl", "axis", "add"].map((field) => (
                      <div key={field}>
                        <label className="block text-[8px] font-black uppercase text-theme-text mb-0.5 text-center">
                          {field}
                        </label>
                        <input
                          placeholder="0.00"
                          className="w-full bg-theme-bg border-b border-theme-border py-1 text-center font-bold text-xs outline-none text-theme-text"
                          value={(rx as any)[eye][field]}
                          onChange={(e) => handleRxChange(eye as 'od' | 'os', field, e.target.value)}
                        />
                      </div>
                    ))}
                    <div className="flex flex-col items-center">
                      <label className="block text-[8px] font-black uppercase text-theme-text mb-0.5 text-center">
                        Prism
                      </label>
                      <input
                        type="checkbox"
                        checked={(rx as any)[eye].hasPrism}
                        onChange={(e) =>
                          setRx({
                            ...rx,
                            [eye]: {
                              ...(rx as any)[eye],
                              hasPrism: e.target.checked,
                            },
                          })
                        }
                        className="w-4 h-4 rounded border-theme-border text-theme-accent focus:ring-theme-accent accent-theme-accent"
                      />
                    </div>

                    {(rx as any)[eye].hasPrism && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="col-span-5 flex flex-col gap-2 mt-2 p-2 bg-theme-bg rounded-xl border border-theme-border"
                      >
                        <div className="flex items-end gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setRx({
                                ...rx,
                                [eye]: {
                                  ...(rx as any)[eye],
                                  hasCompoundPrism: !(rx as any)[eye].hasCompoundPrism,
                                },
                              })
                            }
                            className={`w-6 h-6 mb-1 shrink-0 rounded-full flex items-center justify-center transition-colors ${(rx as any)[eye].hasCompoundPrism ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'} text-white`}
                            title="Toggle Compound Prism"
                          >
                            <Plus className={`w-4 h-4 transition-transform ${(rx as any)[eye].hasCompoundPrism ? 'rotate-45' : ''}`} />
                          </button>
                          <div className="flex-1">
                            <label className="block text-[8px] font-black uppercase text-theme-text mb-0.5">
                              Amount
                            </label>
                            <input
                              placeholder="0.00"
                              className="w-full bg-white border border-theme-border rounded px-2 py-1 text-xs font-bold text-black"
                              value={(rx as any)[eye].prism}
                              onChange={(e) => handleRxChange(eye as 'od' | 'os', 'prism', e.target.value)}
                            />
                          </div>
                          <div className="flex-1">
                            <label className="block text-[8px] font-black uppercase text-theme-text mb-0.5">
                              Base
                            </label>
                            <select
                              className="w-full bg-white border border-theme-border rounded px-1 py-1 text-xs font-bold text-black"
                              value={(rx as any)[eye].prismBase}
                              onChange={(e) =>
                                setRx({
                                  ...rx,
                                  [eye]: {
                                    ...(rx as any)[eye],
                                    prismBase: e.target.value,
                                  },
                                })
                              }
                            >
                              <option value="BO">BO</option>
                              <option value="BU">BU</option>
                              <option value="BD">BD</option>
                              <option value="BI">BI</option>
                            </select>
                          </div>
                        </div>

                        {(rx as any)[eye].hasCompoundPrism && (
                          <div className="flex items-end gap-2 pl-8">
                            <div className="flex-1">
                              <label className="block text-[8px] font-black uppercase text-theme-text mb-0.5">
                                Amount 2
                              </label>
                              <input
                                placeholder="0.00"
                                className="w-full bg-white border border-theme-border rounded px-2 py-1 text-xs font-bold text-black"
                                value={(rx as any)[eye].prism2}
                                onChange={(e) => handleRxChange(eye as 'od' | 'os', 'prism2', e.target.value)}
                              />
                            </div>
                            <div className="flex-1">
                              <label className="block text-[8px] font-black uppercase text-theme-text mb-0.5">
                                Base 2
                              </label>
                              <select
                                className="w-full bg-white border border-theme-border rounded px-1 py-1 text-xs font-bold text-black"
                                value={(rx as any)[eye].prismBase2}
                                onChange={(e) =>
                                  setRx({
                                    ...rx,
                                    [eye]: {
                                      ...(rx as any)[eye],
                                      prismBase2: e.target.value,
                                    },
                                  })
                                }
                              >
                                <option value="BO">BO</option>
                                <option value="BU">BU</option>
                                <option value="BD">BD</option>
                                <option value="BI">BI</option>
                              </select>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </div>
                ))}

                <div className="flex gap-2">
                  {["dvo", "nvo", "ivo"].map((flag) => (
                    <button
                      key={flag}
                      onClick={() =>
                        setRxFlags({
                          ...rxFlags,
                          [flag]: !(rxFlags as any)[flag],
                        })
                      }
                      className={`flex-1 p-2 rounded-xl text-[10px] font-black uppercase transition-all border-theme-border ${(rxFlags as any)[flag] ? "bg-theme-text text-theme-card" : "bg-theme-card text-theme-text hover:bg-theme-bg"}`}
                    >
                      {flag}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* BILLING TABLE */}
            <section className="bg-theme-card p-6 rounded-3xl border-theme-main space-y-4 text-theme-text shadow-lg">
              <h3 className="text-xs font-black uppercase tracking-widest text-black font-bold italic">
                Billing Summary
              </h3>

              <div className="flex text-[8px] font-black uppercase text-theme-text border-b-theme-border pb-1 gap-2">
                <span className="flex-1">Description</span>
                <span className="w-16 text-right">Retail</span>
                <span className="w-16 text-right">+Tax(6%)</span>
                <span className="w-16 text-right">Pt Owe</span>
              </div>

              <div className="space-y-2">
                {Object.keys(billing).map((key) => (
                  <div
                    key={key}
                    className="flex items-center justify-between py-2 border-b border-theme-border group/row gap-2"
                  >
                    <div className="flex-1">
                      {key.startsWith("m") ? (
                        <input
                          placeholder={`Misc ${key.charAt(1)}`}
                          className="bg-transparent border-none outline-none text-xs font-bold w-full uppercase placeholder:text-slate-400 text-black"
                          value={billing[key].label}
                          onChange={(e) =>
                            updateBillingRow(key, { label: e.target.value })
                          }
                        />
                      ) : (
                        <span className="text-[10px] font-bold text-theme-text uppercase">
                          {billing[key].label}
                        </span>
                      )}
                    </div>
                    <div className="w-16">
                      <input
                        className="w-full bg-transparent text-right font-black text-xs outline-none text-theme-text"
                        placeholder="0.00"
                        value={billing[key].retail}
                        onChange={(e) =>
                          updateBillingRow(key, {
                            retail: e.target.value,
                            retailWithTax: (
                              parseFloat(e.target.value || "0") * 1.06
                            ).toFixed(2),
                            owe: calcOwe(e.target.value, key),
                          })
                        }
                      />
                    </div>
                    <div className="w-16 text-right text-[10px] font-bold text-slate-500">
                      {billing[key].retailWithTax}
                    </div>
                    <div className="w-16">
                      <input
                        className="w-full bg-transparent text-right font-black text-xs outline-none text-red-600"
                        value={billing[key].owe}
                        onChange={(e) =>
                          updateBillingRow(key, { owe: e.target.value })
                        }
                      />
                    </div>
                    <button
                      onClick={() => {
                        const defaultLabels: any = {
                          frame: "FRAME",
                          lens: "LENS",
                          coat: "A/R COATING",
                        };
                        updateBillingRow(key, {
                          label: defaultLabels[key] || "",
                          retail: "",
                          retailWithTax: "0.00",
                          owe: "0.00",
                        });
                      }}
                      className="p-1 text-black hover:text-red-500 opacity-0 group-hover/row:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>

              {isAllowancePlan && (
                <div className="bg-theme-bg p-3 rounded-xl border-theme-border flex justify-between items-center text-[11px]">
                  <span className="text-black font-bold uppercase tracking-widest italic">
                    Plan Allowance
                  </span>
                  <span className="font-black text-red-600">
                    -${globalAllowance.toFixed(2)}
                  </span>
                </div>
              )}

              <div className="pt-6 border-t border-theme-border space-y-4">
                <label className="block text-[10px] font-black uppercase text-theme-text tracking-widest italic">
                  Payment Method
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setShowCardMenu(!showCardMenu);
                      if (payMethod === "Cash" || payMethod === "Check") {
                        setPayMethod("");
                      }
                    }}
                    className={`px-4 py-2 rounded-xl border-theme-border text-[10px] font-black uppercase transition-all flex items-center gap-2 ${
                      cardTypes.includes(payMethod)
                        ? "bg-theme-text text-theme-card"
                        : "bg-theme-card text-theme-text hover:bg-theme-bg"
                    }`}
                  >
                    {cardTypes.includes(payMethod) ? `Card: ${payMethod}` : "Credit Card"}
                    <ChevronDown className={`w-3 h-3 transition-transform ${showCardMenu ? 'rotate-180' : ''}`} />
                  </button>

                  <button
                    onClick={() => {
                      setPayMethod("Cash");
                      setShowCardMenu(false);
                    }}
                    className={`px-4 py-2 rounded-xl border-theme-border text-[10px] font-black uppercase transition-all ${
                      payMethod === "Cash"
                        ? "bg-theme-text text-theme-card shadow-lg"
                        : "bg-theme-card text-theme-text hover:bg-theme-bg"
                    }`}
                  >
                    Cash
                  </button>

                  <button
                    onClick={() => {
                      setPayMethod("Check");
                      setShowCardMenu(false);
                      const num = prompt("Enter Check Number:");
                      setCheckNum(num || "");
                    }}
                    className={`px-4 py-2 rounded-xl border-theme-border text-[10px] font-black uppercase transition-all ${
                      payMethod === "Check"
                        ? "bg-theme-text text-theme-card shadow-lg"
                        : "bg-theme-card text-theme-text hover:bg-theme-bg"
                    }`}
                  >
                    {payMethod === "Check" && checkNum ? `Check #${checkNum}` : "Check"}
                  </button>
                </div>

                <AnimatePresence>
                  {showCardMenu && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex flex-wrap gap-2 p-4 bg-theme-bg rounded-2xl border border-dashed border-theme-border"
                    >
                      {cardTypes.map(c => (
                        <button
                          key={c}
                          onClick={() => {
                            setPayMethod(c);
                            setShowCardMenu(false);
                          }}
                          className={`px-3 py-1.5 rounded-lg border-theme-border text-[9px] font-black uppercase transition-all ${
                            payMethod === c
                              ? "bg-theme-text text-theme-card"
                              : "bg-theme-card text-theme-text hover:bg-theme-bg"
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="pt-4 flex justify-between items-end">
                <div>
                  <label className="block text-[10px] font-black uppercase text-theme-text mb-1">
                    Patient Total
                  </label>
                  <span className="text-5xl font-black italic tracking-tighter text-theme-text">
                    ${f(finalOwe)}
                  </span>
                </div>
                <div className="text-right">
                  <div className={`w-full md:w-80 h-32 border-theme-border rounded-lg overflow-hidden ${theme === 'dark' ? 'bg-white' : ''}`}>
                    <SignaturePad
                      onSave={setSignature}
                      className="w-full h-full"
                    />
                  </div>
                </div>
              </div>
            </section>
            {/* WAIVERS & PRECAUTIONS AT THE VERY BOTTOM */}
            <section className="bg-theme-card p-6 rounded-3xl border-theme-main space-y-4 shadow-sm">
              <h3 className="text-xs font-black uppercase tracking-widest text-theme-accent font-bold italic">
                Waivers & Precautions
              </h3>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { id: "expired", label: "Expired Rx / Out of date" },
                  { id: "pof", label: "Patient Own Frame (No Liability)" },
                  { id: "remake", label: "REMAKE" },
                ].map((w) => (
                  <label
                    key={w.id}
                    className="flex items-center gap-3 p-3 bg-theme-bg rounded-xl border-theme-border cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    <input
                      type="checkbox"
                      className="w-5 h-5 rounded border-theme-border text-theme-accent focus:ring-theme-accent accent-theme-accent"
                      checked={(waivers as any)[w.id]}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        if (w.id === "remake" && checked) {
                          const reason = prompt("Why is this a remake?");
                          setRemakeReason(reason || "");
                          setWaivers({ ...waivers, [w.id]: true });
                        } else {
                          setWaivers({ ...waivers, [w.id]: checked });
                        }
                      }}
                    />
                    <span className="text-[11px] font-black uppercase text-theme-text font-bold">
                      {w.label}
                    </span>
                  </label>
                ))}
              </div>
              {waivers.remake && (
                <input
                  placeholder="Reason for remake..."
                  className="w-full bg-theme-bg border-theme-border rounded-xl px-4 py-2 font-bold outline-none focus:ring-1 focus:ring-theme-accent text-[11px] text-theme-text"
                  value={remakeReason}
                  onChange={(e) => setRemakeReason(e.target.value)}
                />
              )}
            </section>
          </div>
        </div>
      </main>

      {/* OVERLAYS */}
      <AnimatePresence>
        {showMeasureTool && (
          <MeasurementTool
            onClose={() => setShowMeasureTool(false)}
            onSave={(m) => {
              setPd(m.pd.toFixed(1));
              setSeg(m.seg.toFixed(1));
              setShowMeasureTool(false);
            }}
          />
        )}
        {showPatientForm && (
          <PatientForm
            initialName={patient}
            onClose={() => setShowPatientForm(false)}
            onSave={(data) => {
              setPatient(data.name);
              setPhone(data.phone);
              setShowPatientForm(false);
            }}
          />
        )}
      </AnimatePresence>

      {/* MAIL ADDRESS MODAL */}
      <AnimatePresence>
        {showMailPopup && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowMailPopup(false)} 
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-theme-card border-theme-main p-8 rounded-3xl w-full max-w-md shadow-2xl"
            >
              <h2 className="text-xl font-black uppercase italic mb-4 text-theme-text">Mailing Address</h2>
              <p className="text-[11px] font-bold text-theme-muted uppercase mb-6">Patient requested Mail Option. Enter address for clinical slip.</p>
              
              <textarea
                autoFocus
                placeholder="Enter full address..."
                className="w-full h-32 bg-theme-bg border-theme-border rounded-xl p-4 font-bold text-theme-text outline-none focus:ring-1 focus:ring-theme-accent transition-all uppercase"
                value={mailAddress}
                onChange={(e) => setMailAddress(e.target.value)}
              />
              
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setShowMailPopup(false)}
                  className="flex-1 bg-theme-text text-theme-card py-3 rounded-xl font-black uppercase tracking-widest border-theme-border"
                >
                  Confirm Address
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CATALOG OVERLAY */}
      <AnimatePresence>
        {showCatalog && (
          <div className="fixed inset-0 z-[1100] flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCatalog(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              className="relative w-full max-w-lg bg-theme-card h-full shadow-2xl flex flex-col border-l border-theme-border"
            >
              <div className="p-4 border-b border-theme-border flex items-center justify-between bg-theme-card">
                <h2 className="text-sm font-black uppercase tracking-widest text-theme-text italic">
                  Select Lens Option
                </h2>
                <button
                  onClick={() => setShowCatalog(false)}
                  className="p-2 text-theme-text hover:text-theme-accent"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <Catalog
                  currentPlan={plan}
                  onSelectItem={handleCatalogSelect}
                />

                {/* RECENT ACTIVITY MOVED HERE */}
                <div className="p-6 border-t-4 border-theme-main bg-theme-card">
                  <h3 className="text-xs font-black uppercase text-theme-text mb-4 flex items-center gap-2 italic">
                    <History className="w-5 h-5" />
                    Recent Activity
                  </h3>
                  <div className="space-y-3 pb-20">
                    {history.length > 0 ? (
                      history.map((j, idx) => (
                        <div
                          key={idx}
                          className="bg-theme-bg p-3 rounded-xl border border-theme-border flex flex-col gap-1 text-[11px] text-theme-text hover:bg-theme-accent hover:text-theme-card transition-all cursor-pointer group"
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-black text-xs">
                              {j.jobNum}
                            </span>
                            <span className="p-1 px-2 rounded bg-theme-card border border-theme-border font-black text-[9px] uppercase">
                              {j.plan}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="font-bold uppercase">
                              {j.patient}
                            </span>
                            <small className="text-theme-muted font-black">
                              ({j.optician})
                            </small>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-theme-muted font-bold uppercase text-[10px] tracking-widest">
                        No recent transactions
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MOBILE NAV */}
      <nav className="lg:hidden h-16 bg-theme-card border-t border-theme-border flex items-center justify-around px-4">
        <button
          onClick={() => setShowCatalog(true)}
          className="flex flex-col items-center gap-1 text-theme-text"
        >
          <Search className="w-5 h-5" />
          <span className="text-[9px] font-black uppercase">Search</span>
        </button>
        <button
          onClick={() => setShowPatientForm(true)}
          className="flex flex-col items-center gap-1 text-theme-text"
        >
          <UserPlus className="w-5 h-5" />
          <span className="text-[9px] font-black uppercase">Form</span>
        </button>
        <button
          onClick={handlePrint}
          disabled={isPrintDisabled}
          className={`p-3 px-6 rounded-2xl flex items-center gap-2 shadow-xl border-2 transition-all ${
            !isPrintDisabled
              ? "bg-green-500 border-green-500 text-white hover:bg-green-600 shadow-green-500/30"
              : theme === 'dark'
              ? "bg-white border-white text-black opacity-50"
              : "bg-transparent border-black text-black opacity-50"
          }`}
        >
          <Printer className="w-5 h-5" />
          <span className="text-[10px] font-black uppercase">Order</span>
        </button>
      </nav>

      {/* HIDDEN PRINT LAYOUT */}
      <div
        className={`fixed inset-0 bg-white z-[99999] pointer-events-none opacity-0 ${isPrinting ? "opacity-100 flex flex-col items-center p-8 overflow-y-auto" : "hidden"}`}
      >
        <div className="w-full max-w-5xl bg-white text-black p-8 border-4 border-black">
          {/* This mimics the "Slip" design from legacy but in React */}
          <div className="grid grid-cols-2 gap-12">
            {[1, 2].map((n) => (
              <div
                key={n}
                className="space-y-4 border-r-2 border-dashed border-black pr-8 last:border-r-0 last:pl-8 last:pr-0"
              >
                <div className="flex justify-between items-start">
                  <h1 className="text-4xl font-black border-2 border-black p-2">
                    P.O.S.T.
                  </h1>
                  <div className="text-right">
                    <p className="text-xs font-bold uppercase">
                      Write-Up # {jobNum}
                    </p>
                    <p className="text-xs font-bold uppercase">
                      Date: {new Date().toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="space-y-2 text-sm font-bold uppercase">
                  <div className="border-b border-black flex justify-between">
                    <span>Patient:</span> <span>{patient}</span>
                  </div>
                  {promise.mail && mailAddress && (
                    <div className="border-b border-black flex flex-col pt-1">
                      <span className="text-[10px] text-black">Mailing Address:</span>
                      <span className="text-[11px] whitespace-pre-wrap">{mailAddress}</span>
                    </div>
                  )}
                  <div className="border-b border-black flex justify-between">
                    <span>Plan:</span>{" "}
                    <span>
                      {plan}{" "}
                      {plan === "MEDICAID"
                        ? `(${medicaidType} - ${medicaidCode})`
                        : plan === "SCHOOL LETTER"
                          ? `(${schoolName})`
                          : ""}
                    </span>
                  </div>
                  <div className="border-b border-black flex justify-between">
                    <span>Doctor:</span>{" "}
                    <span>{dr === "Other" ? drOther : dr}</span>
                  </div>
                  <div className="border-b border-black flex justify-between">
                    <span>Payment:</span>{" "}
                    <span>
                      {payMethod} {payMethod === "Check" && `#${checkNum}`}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] font-black border-2 border-black p-2 bg-white">
                  <div className="col-span-2 border-b border-black/10 pb-1 flex justify-around">
                    <span>
                      OD: {rx.od.sph} {rx.od.cyl} x {rx.od.axis} ({rx.od.add}) {rx.od.hasPrism && `P: ${rx.od.prism} ${rx.od.prismBase}${rx.od.hasCompoundPrism ? ` & ${rx.od.prism2} ${rx.od.prismBase2}` : ''}`}
                    </span>
                    <span>
                      OS: {rx.os.sph} {rx.os.cyl} x {rx.os.axis} ({rx.os.add}) {rx.os.hasPrism && `P: ${rx.os.prism} ${rx.os.prismBase}${rx.os.hasCompoundPrism ? ` & ${rx.os.prism2} ${rx.os.prismBase2}` : ''}`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>PD:</span> <span>{pd}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>SEG:</span> <span>{seg}</span>
                  </div>
                  <div className="col-span-2">
                    FRAME: {frame} (A:{frameA} DBL: {frameDbl})
                  </div>
                  <div className="col-span-2">LENS: {billing.lens.label}</div>
                  <div className="col-span-2 bg-black text-white px-2 py-0.5">
                    COLOR: {colorType} {colorDetail ? `(${colorDetail})` : ""}
                  </div>
                </div>

                <table className="w-full text-xs font-bold border-collapse border border-black">
                  <thead>
                    <tr className="bg-slate-100 italic">
                      <th>ITEM</th>
                      <th>RETAIL</th>
                      <th>OWE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(Object.values(billing) as BillingRow[]).map((b, i) => (
                      <tr key={i} className="border-t border-black">
                        <td className="p-1">{b.label}</td>
                        <td className="p-1 text-center">${f(b.retail)}</td>
                        <td className="p-1 text-right">${f(b.owe)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="flex justify-between items-end pt-4">
                  <div className="text-3xl font-black italic">
                    TOTAL: ${f(finalOwe)}
                  </div>
                  <div className="text-right">
                    {signature && (
                      <img
                        src={signature}
                        className="h-12 border-b border-black"
                        alt="sig"
                      />
                    )}
                    <p className="text-[10px] font-bold">
                      Authorized Signature
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* WAIVER PAGE */}
        <div className="w-full max-w-5xl bg-white text-black p-12 mt-12 border-4 border-black page-break-before">
          <h2 className="text-2xl font-black uppercase text-center border-b-4 border-black pb-4 mb-8">
            Patient Disclosure & Waiver
          </h2>
          <div className="grid grid-cols-1 gap-6 text-sm leading-relaxed">
            {waivers.expired && (
              <p>
                <b>EXPIRED Rx:</b> Patient acknowledges exam is past expiration
                date and holds Pal Optical harmless for vision quality issues.
              </p>
            )}
            {waivers.pof && (
              <p>
                <b>PATIENT OWN FRAME (POF):</b> Patient acknowledges risk of
                breakage during lab processing or adjustment. No liability
                assumed by Pal Optical.
              </p>
            )}
            {waivers.remake && (
              <p>
                <b>REMAKE:</b> {remakeReason}
              </p>
            )}
            <p className="border-2 border-black p-6 italic bg-slate-50">
              I hereby authorize Pal Optical to process my prescription order as
              described above. I have reviewed the billing and insurance
              details.
            </p>
          </div>
          <div className="pt-12 flex justify-between items-end">
            <div className="border-b-2 border-black w-64 pb-2">
              {signature && <img src={signature} className="h-16" alt="sig" />}
              <span className="text-xs font-bold uppercase">
                Patient/Guardian Signature
              </span>
            </div>
            <div className="text-right font-bold text-xs uppercase underline">
              Optician: {user.initials}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
