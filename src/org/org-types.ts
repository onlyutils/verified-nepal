import type { Dispatch, FormEvent, SetStateAction } from "react";
import type {
  CenterPrivate,
  CenterPublic,
  CenterStatus,
  DonationStatus,
  GoodsEntry,
  InboundTransfer,
  MyOrg,
  OrgMember,
  OrgType,
  StockItem,
} from "@/lib/api";
import type { Language } from "@/lib/types";

export type OrgSection = "overview" | "needs" | "centers" | "donations" | "team" | "settings";
export type OrgCopy = Record<string, string>;

export type LogForm = {
  entryType: "intake" | "distribution" | "transfer_out";
  category: string;
  qty: string;
  note: string;
  destinationType: "center" | "external";
  destinationCenterId: string;
  destinationLabel: string;
  error: string | null;
  fieldErrors: Record<string, string>;
  submitting: boolean;
};

export type CenterForm = {
  id: string | null;
  name: string;
  district: string;
  ward: string;
  address: string;
  lat: string;
  lng: string;
  hours: string;
  contactPhone: string;
  accepts: string[];
  notes: string;
};

export type OrgEditForm = {
  name: string;
  orgType: OrgType | "";
  registrationNumber: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  districts: string[];
  description: string;
  website: string;
};

export type DialogState = {
  receive: {
    open: boolean;
    centerId: string | null;
    transfer: InboundTransfer | null;
    qtyReceived: string;
    note: string;
    error: string | null;
    submitting: boolean;
  };
  correction: { open: boolean; centerId: string | null; entryId: string | null; note: string; error: string | null; submitting: boolean };
  donation: {
    open: boolean;
    ref: string | null;
    centerId: string | null;
    qty: string;
    error: string | null;
    submitting: boolean;
    mode: "receive" | "not_received";
  };
  remove: { open: boolean; member: OrgMember | null; error: string | null; submitting: boolean };
};

export interface OrgController {
  language: Language;
  t: OrgCopy;
  orgs: MyOrg[] | null;
  invites: { orgId: string; orgName: string }[];
  selectedId: string | null;
  setSelectedId: Dispatch<SetStateAction<string | null>>;
  selectedOrg: MyOrg | null;
  isOwner: boolean;
  centers: CenterPrivate[];
  loadingOrgs: boolean;
  orgsError: string | null;
  loadingCenters: boolean;
  centersError: string | null;
  stockById: Record<string, StockItem[]>;
  stockLoadingById: Record<string, boolean>;
  stockErrorById: Record<string, string | null>;
  entriesById: Record<string, GoodsEntry[]>;
  cursorById: Record<string, string | undefined>;
  entriesLoadingById: Record<string, boolean>;
  entriesErrorById: Record<string, string | null>;
  inboundById: Record<string, InboundTransfer[]>;
  inboundLoadingById: Record<string, boolean>;
  inboundErrorById: Record<string, string | null>;
  donationsById: Record<string, DonationStatus[]>;
  donationsLoadingById: Record<string, boolean>;
  donationsErrorById: Record<string, string | null>;
  members: OrgMember[];
  membersLoading: boolean;
  membersError: string | null;
  publicCenters: CenterPublic[] | null;
  publicCentersLoading: boolean;
  expanded: Set<string>;
  selectedCenterId: string | null;
  setSelectedCenterId: Dispatch<SetStateAction<string | null>>;
  logFormById: Record<string, LogForm>;
  setLogFormById: Dispatch<SetStateAction<Record<string, LogForm>>>;
  centerStatusUpdating: Record<string, boolean>;
  centerStatusError: Record<string, string | null>;
  queueLength: number;
  queueFlushing: boolean;
  centerForm: CenterForm;
  setCenterForm: Dispatch<SetStateAction<CenterForm>>;
  centerFormOpen: boolean;
  setCenterFormOpen: Dispatch<SetStateAction<boolean>>;
  centerFormErrors: Record<string, string>;
  centerFormApiError: string | null;
  centerSubmitting: boolean;
  editForm: OrgEditForm;
  setEditForm: Dispatch<SetStateAction<OrgEditForm>>;
  editOpen: boolean;
  setEditOpen: Dispatch<SetStateAction<boolean>>;
  editErrors: Record<string, string>;
  editApiError: string | null;
  editSubmitting: boolean;
  vouchTargetId: string;
  setVouchTargetId: Dispatch<SetStateAction<string>>;
  vouchError: string | null;
  vouchMsg: string | null;
  vouchSubmitting: boolean;
  copiedOrgId: boolean;
  dialogs: DialogState;
  setDialogs: Dispatch<SetStateAction<DialogState>>;
  qrCenter: CenterPrivate | null;
  qrDataUrl: string | null;
  qrLoading: boolean;
  inviteEmail: string;
  setInviteEmail: Dispatch<SetStateAction<string>>;
  inviteSubmitting: boolean;
  inviteMsg: string | null;
  inviteError: string | null;
  inviteActing: string | null;
  respondInvite: (orgId: string, accept: boolean) => Promise<void>;
  fetchOrgs: () => Promise<void>;
  fetchCenters: () => Promise<void>;
  fetchStock: (centerId: string) => Promise<void>;
  fetchEntries: (centerId: string, cursor?: string, append?: boolean) => Promise<void>;
  fetchInbound: (centerId: string) => Promise<void>;
  fetchDonations: (centerId: string) => Promise<void>;
  fetchMembers: () => Promise<void>;
  loadPublicCenters: () => Promise<void>;
  handleFlushQueue: () => Promise<void>;
  toggleExpanded: (centerId: string) => void;
  openAddCenter: () => void;
  openEditCenter: (center: CenterPrivate) => void;
  submitCenter: (event: FormEvent) => Promise<void>;
  submitEditOrg: (event: FormEvent) => Promise<void>;
  changeCenterStatus: (center: CenterPrivate, status: CenterStatus) => Promise<void>;
  submitEntry: (centerId: string) => Promise<void>;
  receiveTransfer: () => Promise<void>;
  correctEntry: () => Promise<void>;
  confirmDonation: () => Promise<void>;
  inviteMember: (event: FormEvent) => Promise<void>;
  removeMember: () => Promise<void>;
  vouch: () => Promise<void>;
  copyOrgId: () => Promise<void>;
  openQr: (center: CenterPrivate) => void;
  closeQr: () => void;
  auth: {
    idToken: string | null;
    clientId?: string;
    signIn: () => Promise<void>;
    signOut: () => void;
    error: string | null;
    profile: { name?: string | null; email?: string | null } | null;
  };
}
