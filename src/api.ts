export const API_BASE = ((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") ?? "";

export type Category = "goods" | "shelter" | "transport" | "medical" | "skilled-labor" | "funds-guidance";
export const CATEGORIES: Category[] = ["goods", "shelter", "transport", "medical", "skilled-labor", "funds-guidance"];

export interface NeedPublic {
  id: string;
  maskedName: string;
  district: string;
  ward: number;
  category: Category;
  description: string;
  status: string;
  createdAt: string;
  claimCode?: string;
  flagCount?: number;
}

export interface NeedsListResponse {
  items: NeedPublic[];
  cursor?: string;
}

export interface StatusResponse {
  status: string;
  category: Category;
  district: string;
  createdAt: string;
  expiresAt: string;
  claimCode?: string;
}

export interface CreateNeedBody {
  onBehalf: boolean;
  registrant: { name: string; phone: string; email?: string } | null;
  beneficiary: { name: string; phone?: string; email?: string; district: string; ward: number; householdSize?: number };
  category: Category;
  description: string;
  language: "en" | "ne";
  turnstileToken?: string;
}

export interface CreateNeedResponse {
  id: string;
  refCode: string;
}

export interface OfferPublic {
  id: string;
  helperLabel: string;
  org?: { name: string; contact?: string };
  categories: Category[];
  districts: string[];
  description: string;
  status: string;
  createdAt: string;
}

export interface OffersListResponse {
  items: OfferPublic[];
  cursor?: string;
}

export interface CreateOfferBody {
  org?: { name: string; contact: string };
  categories: Category[];
  districts: string[];
  description: string;
  phone: string;
  email?: string;
}

export interface ModerationQueueItem {
  id: string;
  kind?: "need" | "offer";
  status?: string;
  category?: Category;
  categories?: Category[];
  description: string;
  district?: string;
  districts?: string[];
  ward?: number;
  beneficiary?: { name: string; phone?: string; email?: string; district: string; ward: number; householdSize?: number };
  registrant?: { name: string; phone: string; email?: string } | null;
  onBehalf?: boolean;
  maskedName?: string;
  helperLabel?: string;
  org?: { name: string; contact: string };
  phone?: string;
  email?: string;
  language?: string;
  createdAt: string;
  dupCandidates?: Array<{ id: string; maskedName: string; ward: number }>;
  [key: string]: unknown;
}

export interface ModerationQueueResponse {
  items: ModerationQueueItem[];
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function request<T>(path: string, opts: RequestInit & { token?: string } = {}): Promise<T> {
  if (!API_BASE) throw new ApiError("API not configured", 0, null);
  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((opts.headers as Record<string, string>) ?? {}),
  };
  if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;
  const res = await fetch(url, { ...opts, headers });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg =
      data && typeof data === "object" && data !== null && "error" in (data as Record<string, unknown>)
        ? String((data as Record<string, unknown>).error)
        : res.statusText || "Request failed";
    throw new ApiError(msg, res.status, data);
  }
  return data as T;
}

export function createNeed(body: CreateNeedBody): Promise<CreateNeedResponse> {
  return request<CreateNeedResponse>("/needs", { method: "POST", body: JSON.stringify(body) });
}

export function listNeeds(params: { district?: string; category?: string; cursor?: string } = {}, token?: string): Promise<NeedsListResponse> {
  const q = new URLSearchParams();
  if (params.district) q.set("district", params.district);
  if (params.category) q.set("category", params.category);
  if (params.cursor) q.set("cursor", params.cursor);
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return request<NeedsListResponse>(`/needs${suffix}`, { token });
}

export function getStatus(refCode: string): Promise<StatusResponse> {
  return request<StatusResponse>(`/status/${encodeURIComponent(refCode)}`);
}

export function renewNeed(refCode: string): Promise<{ expiresAt: string }> {
  return request<{ expiresAt: string }>(`/needs/${encodeURIComponent(refCode)}/renew`, { method: "POST" });
}

export function createOffer(token: string, body: CreateOfferBody): Promise<{ id: string }> {
  return request<{ id: string }>("/offers", { method: "POST", token, body: JSON.stringify(body) });
}

export function listOffers(params: { district?: string; category?: string } = {}, token?: string): Promise<OffersListResponse> {
  const q = new URLSearchParams();
  if (params.district) q.set("district", params.district);
  if (params.category) q.set("category", params.category);
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return request<OffersListResponse>(`/offers${suffix}`, { token });
}

export function getModerationQueue(token: string): Promise<ModerationQueueResponse> {
  return request<ModerationQueueResponse>("/moderation/queue", { token });
}

export function moderateNeed(
  token: string,
  id: string,
  body: { action: "publish" | "reject"; reason?: string; edits?: Record<string, unknown> },
): Promise<{ status: string }> {
  return request<{ status: string }>(`/moderation/${encodeURIComponent(id)}`, {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

export function updateNeedStatus(
  token: string,
  id: string,
  body: { status: "matched" | "fulfilled" | "archived"; offerId?: string },
): Promise<{ status: string; contact?: unknown }> {
  return request<{ status: string; contact?: unknown }>(`/needs/${encodeURIComponent(id)}/status`, {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

export interface MeResponse {
  sub: string;
  email?: string;
  name?: string;
  role?: string;
  displayName?: string;
  districts?: string[];
  guidelinesAckAt?: string;
  user?: MeResponse;
}

export function getMe(token: string): Promise<MeResponse> {
  return request<MeResponse>("/me", { token });
}

export function ackGuidelines(token: string): Promise<{ guidelinesAckAt: string }> {
  return request<{ guidelinesAckAt: string }>("/me/ack-guidelines", { method: "POST", token, body: JSON.stringify({}) });
}

export interface AdminUser {
  sub: string;
  email: string;
  name?: string;
  role: string;
  districts: string[];
  guidelinesAckAt?: string;
  createdAt: string;
}

export interface AdminUsersResponse {
  items: AdminUser[];
  cursor?: string;
}

export interface AdminStatsResponse {
  needs: { pending: number; published: number; matched: number; fulfilled: number };
  offers: { pending: number; published: number };
  projects: { pending: number; published: number; "in-progress": number; completed: number };
  dispatches: { pending: number; published: number };
  oldestPendingAgeHours: number;
  moderators: number;
}

export interface AuditItem {
  ts: string;
  actorName: string;
  action: string;
  targetType: string;
  targetLabel: string;
  reason?: string;
}

export interface AuditResponse {
  items: AuditItem[];
  cursor?: string;
}

export function getAdminUsers(token: string, params: { role?: string; cursor?: string } = {}): Promise<AdminUsersResponse> {
  const q = new URLSearchParams();
  if (params.role) q.set("role", params.role);
  if (params.cursor) q.set("cursor", params.cursor);
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return request<AdminUsersResponse>(`/admin/users${suffix}`, { token });
}

export function lookupAdminUser(token: string, email: string): Promise<AdminUser> {
  const q = new URLSearchParams({ email });
  return request<AdminUser>(`/admin/users/lookup?${q.toString()}`, { token });
}

export function setAdminUserRole(token: string, sub: string, body: { role: string; districts?: string[] }): Promise<{ role: string; districts: string[] }> {
  return request<{ role: string; districts: string[] }>(`/admin/users/${encodeURIComponent(sub)}/role`, { method: "POST", token, body: JSON.stringify(body) });
}

export function getAdminStats(token: string): Promise<AdminStatsResponse> {
  return request<AdminStatsResponse>("/admin/stats", { token });
}

export function getAudit(params: { month: string; cursor?: string }): Promise<AuditResponse> {
  const q = new URLSearchParams({ month: params.month });
  if (params.cursor) q.set("cursor", params.cursor);
  return request<AuditResponse>(`/audit?${q.toString()}`);
}

export interface ClaimPrintItem {
  claimCode: string;
  maskedName: string;
  category: Category;
  ward: number;
  status: string;
}

export interface ClaimsPrintResponse {
  items: ClaimPrintItem[];
}

export interface LedgerItem {
  maskedName: string;
  category: Category;
  district: string;
  ward: number;
  redeemedAt: string;
}

export interface LedgerResponse {
  items: LedgerItem[];
}

export interface FlagInput {
  reason: "already_received" | "not_real" | "other";
  details?: string;
  turnstileToken?: string;
}

export interface ModerationFlag {
  reason: string;
  details?: string;
  createdAt: string;
}

export interface FlagInboxItem {
  needId: string;
  maskedName: string;
  ward: number;
  district: string;
  flagCount: number;
  flags: ModerationFlag[];
}

export interface FlagsInboxResponse {
  items: FlagInboxItem[];
}

export interface SyncResult {
  code: string;
  status: "redeemed" | "already_redeemed" | "unknown";
  needId?: string;
}

export function getClaimsPrint(token: string, params: { district: string; ward: number }): Promise<ClaimsPrintResponse> {
  const q = new URLSearchParams({ district: params.district, ward: String(params.ward) });
  return request<ClaimsPrintResponse>(`/claims/print?${q.toString()}`, { token });
}

export function redeemClaim(token: string, code: string, body?: { note?: string }): Promise<{ status: string; needId: string; redeemedAt: string }> {
  return request(`/claims/${encodeURIComponent(code)}/redeem`, { method: "POST", token, body: JSON.stringify(body || {}) });
}

export function syncClaims(token: string, body: { redemptions: Array<{ code: string; redeemedAt: string; note?: string }> }): Promise<{ results: SyncResult[] }> {
  return request<{ results: SyncResult[] }>("/claims/sync", { method: "POST", token, body: JSON.stringify(body) });
}

export function getLedger(params: { district: string; ward?: number }): Promise<LedgerResponse> {
  const q = new URLSearchParams({ district: params.district });
  if (params.ward != null) q.set("ward", String(params.ward));
  return request<LedgerResponse>(`/ledger?${q.toString()}`);
}

export function getLedgerCsvUrl(district: string, ward?: number, turnstileToken?: string): string {
  if (!API_BASE) return "";
  const q = new URLSearchParams({ district, format: "csv" });
  if (ward != null) q.set("ward", String(ward));
  if (turnstileToken) q.set("turnstileToken", turnstileToken);
  return `${API_BASE}/ledger?${q.toString()}`;
}

export function flagNeed(id: string, body: FlagInput): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/needs/${encodeURIComponent(id)}/flag`, { method: "POST", body: JSON.stringify(body) });
}

export function getModerationFlags(token: string): Promise<FlagsInboxResponse> {
  return request<FlagsInboxResponse>("/moderation/flags", { token });
}


export type ProjectType = "tuin" | "bridge" | "trail" | "water" | "school" | "other";
export const PROJECT_TYPES: ProjectType[] = ["tuin","bridge","trail","water","school","other"];
export type ProjectStatus = "pending" | "published" | "in-progress" | "completed" | "rejected" | "archived";
export const PROJECT_STATUSES_PUBLIC: ProjectStatus[] = ["published","in-progress","completed"];

export interface ProjectCommitteePublic {
  name: string;
  bank: { bankName: string; accountName: string; accountNumber: string };
  esewaId?: string;
  khaltiId?: string;
  verified: boolean;
}
export interface ProjectCommitteePrivate extends ProjectCommitteePublic {
  contactName: string;
  phone: string;
  email?: string;
}
export interface ProjectPhoto {
  fileId: string;
  url: string;
  caption?: string;
  status: "pending" | "published";
}
export interface ProjectUpdate {
  id: string;
  text: string;
  photos: ProjectPhoto[];
  spentNpr?: number;
  status: "pending" | "published";
  createdAt: string;
}
export interface ProjectPublic {
  id: string;
  title: { en: string; ne?: string };
  description: { en: string; ne?: string };
  type: ProjectType;
  district: string;
  ward: number;
  locationText: string;
  costEstimateNpr: number;
  committee: ProjectCommitteePublic;
  photos: ProjectPhoto[];
  coverPhoto?: { url: string; fileId?: string } | string;
  status: ProjectStatus;
  createdAt: string;
  updates?: ProjectUpdate[];
}
export interface ProjectListResponse {
  items: ProjectPublic[];
  cursor?: string;
}
export interface ProjectDetailResponse extends ProjectPublic {
  updates: ProjectUpdate[];
}
export interface CreateProjectBody {
  title: { en: string; ne?: string };
  description: { en: string; ne?: string };
  type: ProjectType;
  district: string;
  ward: number;
  locationText: string;
  costEstimateNpr: number;
  committee: {
    name: string;
    contactName: string;
    phone: string;
    email?: string;
    bank: { bankName: string; accountName: string; accountNumber: string };
    esewaId?: string;
    khaltiId?: string;
  };
  turnstileToken?: string;
}
export interface CreateProjectResponse { id: string; updateCode: string; }

export interface PresignResponse { uploadUrl: string; fileId: string; publicUrl: string; headers?: Record<string,string>; }

export interface ModerationProjectItem extends ProjectPublic {
  committee: ProjectCommitteePrivate & { verified: boolean };
  pendingPhotos?: ProjectPhoto[];
  pendingUpdates?: ProjectUpdate[];
  createdAt: string;
  updateCodeHash?: string;
}
export interface ModerationProjectsResponse { items: ModerationProjectItem[]; }

export function listProjects(params: { district?: string; status?: string; cursor?: string } = {}): Promise<ProjectListResponse> {
  const q = new URLSearchParams();
  if (params.district) q.set("district", params.district);
  if (params.status) q.set("status", params.status);
  if (params.cursor) q.set("cursor", params.cursor);
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return request<ProjectListResponse>(`/projects${suffix}`);
}
export function getProject(id: string): Promise<ProjectDetailResponse> {
  return request<ProjectDetailResponse>(`/projects/${encodeURIComponent(id)}`);
}
export function createProject(body: CreateProjectBody): Promise<CreateProjectResponse> {
  return request<CreateProjectResponse>("/projects", { method: "POST", body: JSON.stringify(body) });
}
export function presignProjectPhoto(id: string, body: { filename: string; contentType: string; size: number }, opts: { token?: string; updateCode?: string } = {}): Promise<PresignResponse> {
  const headers: Record<string,string> = {};
  if (opts.updateCode) headers["X-Update-Code"] = opts.updateCode;
  const req: RequestInit & { token?: string } = { method: "POST", body: JSON.stringify(body), headers };
  if (opts.token) req.token = opts.token;
  return request<PresignResponse>(`/projects/${encodeURIComponent(id)}/photos/presign`, req);
}
export function attachProjectPhoto(id: string, body: { fileId: string; url: string; caption?: string }, opts: { token?: string; updateCode?: string } = {}): Promise<{ ok: boolean }> {
  const headers: Record<string,string> = {};
  if (opts.updateCode) headers["X-Update-Code"] = opts.updateCode;
  const req: RequestInit & { token?: string } = { method: "POST", body: JSON.stringify(body), headers };
  if (opts.token) req.token = opts.token;
  return request<{ ok: boolean }>(`/projects/${encodeURIComponent(id)}/photos`, req);
}
export function createProjectUpdate(id: string, body: { text: string; photoFileIds: string[]; spentNpr?: number }, updateCode: string): Promise<{ updateId: string }> {
  return request<{ updateId: string }>(`/projects/${encodeURIComponent(id)}/updates`, { method: "POST", body: JSON.stringify(body), headers: { "X-Update-Code": updateCode } });
}
export function getModerationProjects(token: string): Promise<ModerationProjectsResponse> {
  return request<ModerationProjectsResponse>("/moderation/projects", { token });
}
export function moderateProject(token: string, id: string, body: { action: "verify-committee"|"publish"|"reject"|"set-status"|"publish-photo"|"reject-photo"; reason?: string; status?: ProjectStatus; fileId?: string }): Promise<{ status: string }> {
  return request<{ status: string }>(`/moderation/projects/${encodeURIComponent(id)}`, { method: "POST", token, body: JSON.stringify(body) });
}
export function moderateProjectUpdate(token: string, id: string, updateId: string, body: { action: "publish"|"reject"; reason?: string }): Promise<{ status: string }> {
  return request<{ status: string }>(`/moderation/projects/${encodeURIComponent(id)}/updates/${encodeURIComponent(updateId)}`, { method: "POST", token, body: JSON.stringify(body) });
}


export type DispatchTag = "climate" | "mountains" | "floods" | "landslides" | "glaciers" | "community" | "story";
export const DISPATCH_TAGS: DispatchTag[] = ["climate","mountains","floods","landslides","glaciers","community","story"];

export interface DispatchAuthorPublic { displayName: string; place?: string; }
export interface DispatchPublicItem {
  id: string;
  title: string | { en: string; ne?: string };
  excerpt: string | { en: string; ne?: string };
  author: DispatchAuthorPublic;
  tags: DispatchTag[];
  publishedAt: string;
  createdAt?: string;
}
export interface DispatchListResponse { items: DispatchPublicItem[]; cursor?: string; }

export interface DispatchDetailResponse {
  id: string;
  title: string | { en: string; ne?: string };
  body: string | { en: string; ne?: string };
  author: DispatchAuthorPublic;
  tags: DispatchTag[];
  publishedAt: string;
  createdAt: string;
}

export interface CreateDispatchBody {
  title: string;
  body: string;
  author: { displayName: string; place?: string; email: string };
  tags: DispatchTag[];
  language: "en" | "ne";
  turnstileToken?: string;
}
export interface CreateDispatchResponse { id: string; }

export interface ModerationDispatchItem {
  id: string;
  title: { en: string; ne?: string } | string;
  body: { en: string; ne?: string } | string;
  author: { displayName: string; place?: string; email: string };
  tags: DispatchTag[];
  status: "pending" | "published" | "rejected";
  createdAt: string;
  publishedAt?: string;
}
export interface ModerationDispatchResponse { items: ModerationDispatchItem[]; }

export function createDispatch(body: CreateDispatchBody): Promise<CreateDispatchResponse> {
  return request<CreateDispatchResponse>("/dispatches", { method: "POST", body: JSON.stringify(body) });
}
export function listDispatches(params: { tag?: string; cursor?: string } = {}): Promise<DispatchListResponse> {
  const q = new URLSearchParams();
  if (params.tag) q.set("tag", params.tag);
  if (params.cursor) q.set("cursor", params.cursor);
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return request<DispatchListResponse>(`/dispatches${suffix}`);
}
export function getDispatch(id: string): Promise<DispatchDetailResponse> {
  return request<DispatchDetailResponse>(`/dispatches/${encodeURIComponent(id)}`);
}
export function getModerationDispatches(token: string): Promise<ModerationDispatchResponse> {
  return request<ModerationDispatchResponse>("/moderation/dispatches", { token });
}
export function moderateDispatch(token: string, id: string, body: { action: "publish" | "reject"; reason?: string }): Promise<{ status: string }> {
  return request<{ status: string }>(`/moderation/dispatches/${encodeURIComponent(id)}`, { method: "POST", token, body: JSON.stringify(body) });
}

export function assertNoDispatchEmail(obj: Record<string, unknown>): boolean {
  const json = JSON.stringify(obj);
  return !json.toLowerCase().includes('"email"');
}

export function assertNoProjectSensitiveKeys(obj: Record<string, unknown>): string[] {
  const forbidden = ["phone","email","contactName","updateCodeHash","contactname","updatecode"];
  const found: string[] = [];
  for (const k of Object.keys(obj)) {
    const lk = k.toLowerCase();
    for (const f of forbidden) {
      if (lk.includes(f.toLowerCase())) found.push(k);
    }
  }
  if ("committee" in obj && obj.committee && typeof obj.committee === "object") {
    const c = obj.committee as Record<string,unknown>;
    for (const k of Object.keys(c)) {
      const lk = k.toLowerCase();
      if (lk === "phone" || lk === "email" || lk === "contactname") found.push(`committee.${k}`);
    }
  }
  return [...new Set(found)];
}

export function assertNoSensitiveKeys(obj: Record<string, unknown>): string[] {
  const forbidden = ["householdSize", "phone", "phones", "email", "registrant", "description", "household"];
  const found: string[] = [];
  for (const k of Object.keys(obj)) {
    const lk = k.toLowerCase();
    for (const f of forbidden) {
      if (lk.includes(f.toLowerCase())) found.push(k);
    }
  }
  return found;
}

