export interface LensItem {
  name: string;
  price: number;
}

export type InsurancePlan = 
  | "None"
  | "MEDICAID"
  | "EYE-MED"
  | "AETNA EYE-MED"
  | "PREMIER VISION"
  | "MARCH/EYESYNERGY"
  | "UNUM"
  | "NVA"
  | "VBA"
  | "VSP"
  | "SPECTERA"
  | "WELLCARE MEDICARE"
  | "SCHOOL LETTER";

export interface RxValue {
  sph: string;
  cyl: string;
  axis: string;
  add: string;
  prism: string;
  prismBase?: string;
  prism2?: string;
  prismBase2?: string;
  hasPrism?: boolean;
  hasCompoundPrism?: boolean;
}

export interface BillingRow {
  label: string;
  retail: string;
  retailWithTax: string;
  owe: string;
  autoChargeKey?: string;
}

export interface JobSnapshot {
  jobNum: number;
  optician: string;
  patient: string;
  plan: InsurancePlan;
  dr: string;
  frame: string;
  pd: string;
  seght: string;
  lensName: string;
  rx: {
    od: RxValue;
    os: RxValue;
  };
  billing: Record<string, BillingRow>;
  timestamp: number;
}
