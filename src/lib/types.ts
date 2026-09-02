export type Language = "en" | "ne";

export type Page =
  | "dashboard"
  | "search"
  | "missing"
  | "info"
  | "privacy"
  | "desk"
  | "getHelp"
  | "giveHelp"
  | "ledger"
  | "audit"
  | "projects"
  | "projectDetail"
  | "projectRegister"
  | "projectUpdate"
  | "dispatches"
  | "dispatchDetail"
  | "dispatchWrite"
  | "registerOrg"
  | "org"
  | "dropCenters"
  | "dropCenterDetail"
  | "donationStatus";

export interface RescueStatus {
  id: number;
  title: string;
  title_ne: string;
}

export interface PersonRecord {
  id: number;
  name: string;
  name_ne: string;
  display_name: string;
  age: number | null;
  rescued_location: string | NamedLocation | null;
  stationed_location: string | NamedLocation | null;
  status: RescueStatus | null;
  rescued_date: string | null;
  nationality: string | null;
  country: string | null;
  gender: string | null;
  remarks: string | null;
}

export interface MissingPersonRecord {
  id: number;
  name: string;
  name_ne: string;
  display_name?: string;
  age: number | null;
  nationality: string | null;
  country: string | null;
  gender: string | null;
  remarks: string | null;
  last_contact: string | null;
  reported_at: string | null;
  status: RescueStatus | null;
}

/** Public lost/found report on the OPMCM rescue portal (rescue.opmcm.gov.np). */
export interface OpmcmPersonReport {
  _id: string;
  type: "lost" | "found";
  status: string;
  fullName: string;
  approximateAge?: string;
  gender?: string;
  locationText?: string;
  eventAt?: string | null;
  description?: string;
  verified?: boolean;
  createdAt?: string;
}

export interface PersonsData {
  count: number;
  results: PersonRecord[];
}

export interface StatusCountsData {
  total_count: number;
  nepali_count: number;
  foreign_count: number;
  status_counts: Array<RescueStatus & { count: number }>;
}

export interface RescueStatisticsData {
  rescued_count: number;
  force_deployed?: number;
  out_of_reach?: number;
  tower?: string;
  active: boolean;
}

export interface NamedLocation {
  id: number;
  title: string;
  title_ne: string;
  centroid?: {
    type: "Point";
    coordinates: [number, number];
  } | null;
}

export interface LocationCollection {
  count: number;
  results: NamedLocation[];
}

export interface MetaData {
  synced_at: string;
  source_url: string;
  counts: {
    rescued_count: number;
    verified_records: number;
    nepali_count: number;
    foreign_count: number;
    rescued_person_records: number;
    rescued_locations: number;
    stationed_locations: number;
  };
}

export interface CountryCount {
  country: string;
  count: number;
}

export interface MessageItem {
  id?: number;
  title?: string;
  title_ne?: string;
  message?: string;
  message_ne?: string;
  description?: string;
  description_ne?: string;
  content?: string;
  content_ne?: string;
  [key: string]: unknown;
}

export interface OpmcmGovernmentEffort {
  _id: string;
  title?: string;
  title_en?: string;
  titleEn?: string;
  englishTitle?: string;
  titleEnglish?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface OpmcmStats {
  requests: {
    total: number;
    open: number;
    critical: number;
    inProgress: number;
    resolved: number;
  };
  offers: {
    available: number;
  };
}
