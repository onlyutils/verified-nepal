/** Data shape for the flood relief drop-center finder (src/data/relief-centers.json). */

export type ReliefCenterCategory = "public_dropoff" | "volunteer_dropoff" | "coordinating_office" | "incoming_international_staging";

export type ReliefConfidence = "high" | "medium" | "low";

export interface ReliefContact {
  name: string;
  phone: string | null;
}

export interface ReliefCenter {
  id: string;
  name: string;
  name_np: string;
  district: string;
  lat: number | null;
  lng: number | null;
  category: ReliefCenterCategory;
  hours: string | null;
  contacts: ReliefContact[];
  run_by: string;
  accepts?: string[];
  serves_districts?: string[];
  note?: string;
  confidence: ReliefConfidence;
  unofficial?: boolean;
}

export interface ReliefEmergencyNumber {
  label: string;
  label_np: string;
  phone: string;
}

export interface ReliefOtherWay {
  name: string;
  note: string;
  url?: string;
}

export interface ReliefDataset {
  meta: {
    event: string;
    last_verified: string;
    disclaimer: string;
    emergency_numbers: ReliefEmergencyNumber[];
  };
  centers: ReliefCenter[];
  nuwakot_holding_centers: {
    note: string;
    venues: string[];
  };
  items_needed: Record<string, string[]>;
  other_ways_to_help: ReliefOtherWay[];
  cash_donation: {
    official_portal: string;
    warning: string;
    note: string;
  };
}
