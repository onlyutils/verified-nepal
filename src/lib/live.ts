import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { data } from "@/lib/data";
import { labels } from "@/i18n";
import type {
  Language,
  MessageItem,
  MissingPersonRecord,
  OpmcmGovernmentEffort,
  OpmcmStats,
  RescueStatisticsData,
  StatusCountsData,
} from "@/lib/types";
import { opmcmApiBase } from "@/lib/urls";
import { extractMessages } from "@/lib/format";

export const rescueApiBase = "https://ndrrma.gov.np/api/v1/rescues/";

const refreshMs = 5 * 60 * 1000;
const minRefreshMs = 60 * 1000;
const requestTimeoutMs = 15 * 1000;

interface MissingPersonsPage {
  count: number;
  next: string | null;
  previous: string | null;
  results: MissingPersonRecord[];
}

interface LivePayload {
  rescuedStatistics: RescueStatisticsData;
  statusCounts: StatusCountsData;
  messages: MessageItem[];
  missingCount: number;
  isComplete: boolean;
  officialUpdates: OpmcmGovernmentEffort[];
  opmcmStats: OpmcmStats;
  opmcmUpdatedAt: string;
}

interface LiveDataValue {
  rescuedStatistics: RescueStatisticsData;
  statusCounts: StatusCountsData;
  messages: MessageItem[];
  missingCount: number | null;
  officialUpdates: OpmcmGovernmentEffort[] | null;
  opmcmStats: OpmcmStats | null;
  opmcmUpdatedAt: string | null;
  isLive: boolean;
  updatedAt: string | null;
}

const fallbackLiveData: LiveDataValue = {
  rescuedStatistics: data.rescuedStatistics,
  statusCounts: data.statusCounts,
  messages: extractMessages(data.messages),
  missingCount: null,
  officialUpdates: null,
  opmcmStats: null,
  opmcmUpdatedAt: null,
  isLive: false,
  updatedAt: null,
};

const LiveDataContext = createContext<LiveDataValue>(fallbackLiveData);

export function LiveDataProvider({ children }: { children: ReactNode }) {
  const [liveData, setLiveData] = useState<LiveDataValue>(fallbackLiveData);
  const lastSuccessRef = useRef<number>(0);

  useEffect(() => {
    let mounted = true;
    let activeController: AbortController | null = null;

    const refresh = (force = false) => {
      if (!force && Date.now() - lastSuccessRef.current < minRefreshMs) return;
      activeController?.abort();
      const controller = new AbortController();
      activeController = controller;

      fetchLivePayload(controller.signal)
        .then((payload) => {
          if (!mounted || controller.signal.aborted) return;
          lastSuccessRef.current = Date.now();
          setLiveData((current) => ({
            rescuedStatistics: payload.rescuedStatistics ?? current.rescuedStatistics,
            statusCounts: payload.statusCounts ?? current.statusCounts,
            messages: payload.messages ?? current.messages,
            missingCount: payload.missingCount ?? current.missingCount,
            officialUpdates: payload.officialUpdates ?? current.officialUpdates,
            opmcmStats: payload.opmcmStats ?? current.opmcmStats,
            opmcmUpdatedAt: payload.opmcmUpdatedAt ?? current.opmcmUpdatedAt,
            isLive: current.isLive || payload.isComplete === true,
            updatedAt: payload.isComplete === true ? new Date().toISOString() : current.updatedAt,
          }));
        })
        .catch((error) => {
          if (!controller.signal.aborted) {
            console.warn("Live data fetch failed", error);
          }
        });
    };

    refresh(true);

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, refreshMs);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      mounted = false;
      activeController?.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return createElement(LiveDataContext.Provider, { value: liveData }, children);
}

export function useLiveData() {
  return useContext(LiveDataContext);
}

export function LiveStatusBadge({ language, className = "" }: { language: Language; className?: string }) {
  const t = labels[language];
  const liveData = useLiveData();
  const label = liveData.isLive
    ? `${t.liveData} · ${t.updated} ${formatShortTime(liveData.updatedAt, language)}`
    : `${t.snapshotData} · ${formatDateOnly(data.meta.synced_at, language)}`;

  return createElement(
    "span",
    {
      className: `inline-flex items-center gap-2 font-sans text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-ink ${className}`,
      title: liveData.isLive ? undefined : t.snapshotTooltip,
    },
    createElement("span", {
      className: `h-2 w-2 rounded-full ${liveData.isLive ? "bg-blue" : "border border-ink bg-transparent"}`,
      "aria-hidden": "true",
    }),
    label,
  );
}

async function fetchLivePayload(signal: AbortSignal): Promise<Partial<LivePayload>> {
  const [
    rescuedStatistics,
    statusCounts,
    messages,
    missingPersons,
    officialUpdates,
    opmcmStats,
  ] = await Promise.allSettled([
    fetchJson<RescueStatisticsData>(`${rescueApiBase}rescued-statistics/`, signal),
    fetchJson<StatusCountsData>(`${rescueApiBase}status-counts/`, signal),
    fetchJson<MessageItem[] | { results?: MessageItem[] }>(`${rescueApiBase}messages/`, signal),
    fetchJson<MissingPersonsPage>(`${rescueApiBase}missing-persons/`, signal),
    fetchOfficialUpdates(signal),
    fetchOpmcmStats(signal),
  ]);

  warnRejected("rescued-statistics", rescuedStatistics);
  warnRejected("status-counts", statusCounts);
  warnRejected("messages", messages);
  warnRejected("missing-persons", missingPersons);
  warnRejected("OPMCM government-efforts", officialUpdates);
  warnRejected("OPMCM stats", opmcmStats);

  const payload: Partial<LivePayload> = {};
  if (rescuedStatistics.status === "fulfilled") payload.rescuedStatistics = rescuedStatistics.value;
  if (statusCounts.status === "fulfilled") payload.statusCounts = statusCounts.value;
  if (messages.status === "fulfilled") payload.messages = extractMessages(messages.value);
  if (missingPersons.status === "fulfilled") payload.missingCount = missingPersons.value.count;
  if (officialUpdates.status === "fulfilled") payload.officialUpdates = officialUpdates.value.slice(0, 3);
  if (opmcmStats.status === "fulfilled") payload.opmcmStats = opmcmStats.value;
  if (officialUpdates.status === "fulfilled" || opmcmStats.status === "fulfilled") {
    payload.opmcmUpdatedAt = new Date().toISOString();
  }
  if (Object.keys(payload).length === 0) throw new Error("All live data requests failed");
  payload.isComplete =
    rescuedStatistics.status === "fulfilled" &&
    statusCounts.status === "fulfilled" &&
    messages.status === "fulfilled" &&
    missingPersons.status === "fulfilled";
  return payload;
}

async function fetchOfficialUpdates(signal: AbortSignal) {
  const payload = await fetchJson<{
    success?: boolean;
    data?: { items?: OpmcmGovernmentEffort[] };
  }>(`${opmcmApiBase}government-efforts`, signal);
  if (payload.success === false) throw new Error("OPMCM government-efforts returned success=false");
  return payload.data?.items ?? [];
}

async function fetchOpmcmStats(signal: AbortSignal) {
  const payload = await fetchJson<{
    success?: boolean;
    data?: OpmcmStats;
  }>(`${opmcmApiBase}stats`, signal);
  if (payload.success === false || !payload.data) throw new Error("OPMCM stats unavailable");
  return payload.data;
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), requestTimeoutMs);
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) controller.abort();

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`${url} returned ${response.status}`);
    return (await response.json()) as T;
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

function warnRejected(name: string, result: PromiseSettledResult<unknown>) {
  if (result.status === "rejected") {
    console.warn(`Live data ${name} fetch failed`, result.reason);
  }
}

function formatShortTime(value: string | null, language: Language) {
  if (!value) return "";
  return new Intl.DateTimeFormat(language === "ne" ? "ne-NP" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function formatDateOnly(value: string, language: Language) {
  return new Intl.DateTimeFormat(language === "ne" ? "ne-NP" : "en-US", {
    dateStyle: "medium",
  }).format(new Date(value));
}
