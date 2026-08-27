import {
  Activity,
  Siren,
  Baby,
  Stethoscope,
  Zap,
  HeartPulse,
  ArrowRightLeft,
  Building2,
} from "lucide-react";

export const PATHWAY_META = {
  emergency: {
    name: "Emergency",
    icon: Activity,
    desc: "Full ESI triage and emergency care",
    color: "text-red-700",
    bg: "bg-red-50",
    border: "border-red-200",
  },
  trauma: {
    name: "Trauma",
    icon: Siren,
    desc: "Trauma team activation for multi-system injury",
    color: "text-orange-700",
    bg: "bg-orange-50",
    border: "border-orange-200",
  },
  pediatrics: {
    name: "Pediatrics",
    icon: Baby,
    desc: "Age-appropriate pediatric assessment & triage",
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
  },
  specialty: {
    name: "Specialty Assessment",
    icon: Stethoscope,
    desc: "Directed assessment by a specialist team",
    color: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
  },
  urgent: {
    name: "Urgent Care",
    icon: Zap,
    desc: "Same-day care for low-acuity symptoms — not the ED",
    color: "text-teal-700",
    bg: "bg-teal-50",
    border: "border-teal-200",
  },
  general: {
    name: "General Medicine",
    icon: HeartPulse,
    desc: "Routine / primary care assessment on site",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
  },
  referral: {
    name: "Referral",
    icon: ArrowRightLeft,
    desc: "Route to a regional partner for off-site specialty",
    color: "text-slate-600",
    bg: "bg-slate-100",
    border: "border-slate-300",
  },
};

export const HOSPITALS = {
  urban: {
    id: "urban",
    name: "Harborview Medical Center",
    shortName: "Harborview",
    type: "Large urban tertiary center",
    icon: Building2,
    volume: "≈ 180–400 visits/day",
    capacity: "28 ED beds · Level I trauma center",
    staff: "Full specialty mix · 24/7",
    specialties: [
      "Cardiology",
      "Respiratory / Pulmonary",
      "Orthopedics",
      "Neurology",
      "Dermatology",
      "ENT",
      "General Medicine",
      "Pediatrics",
      "Trauma",
      "Surgery",
    ],
    pathways: {
      emergency: { id: "emergency", name: PATHWAY_META.emergency.name },
      trauma: { id: "trauma", name: PATHWAY_META.trauma.name },
      pediatrics: { id: "pediatrics", name: PATHWAY_META.pediatrics.name },
      specialty: { id: "specialty", name: PATHWAY_META.specialty.name },
      urgent: { id: "urgent", name: PATHWAY_META.urgent.name },
      general: { id: "general", name: PATHWAY_META.general.name },
    },
    pathwayOrder: ["emergency", "trauma", "pediatrics", "specialty", "urgent", "general"],
    note: "Full on-site specialty mix — most conditions stay in-house.",
  },
  rural: {
    id: "rural",
    name: "West Creek Community Hospital",
    shortName: "West Creek",
    type: "Small rural community ED",
    icon: Building2,
    volume: "≈ 30–60 visits/day",
    capacity: "6 ED beds · on-call GP",
    staff: "GP + 2 RNs · limited on-site specialties",
    specialties: ["General Medicine", "Pediatrics"],
    pathways: {
      emergency: { id: "emergency", name: PATHWAY_META.emergency.name },
      general: { id: "general", name: PATHWAY_META.general.name },
      referral: { id: "referral", name: PATHWAY_META.referral.name },
    },
    pathwayOrder: ["emergency", "general", "referral"],
    note: "Bare-bones mix — non-urgent specialties route to regional partners.",
  },
};

export function getHospital(id) {
  return HOSPITALS[id] ?? HOSPITALS.urban;
}

export function pathwayName(hospitalId, key) {
  const h = getHospital(hospitalId);
  if (h.pathways[key]) return PATHWAY_META[key].name;
  return PATHWAY_META[key].name;
}
