/** Official Government of Nepal donation gateway, listed on opmcm.gov.np/content/586. */
export const pmdrfUrl = "https://pmdrf.nchl.com.np/";
export const pmoAppealUrl = "https://opmcm.gov.np/content/586/heartfelt-appeal/";
export const onlyUtilsUrl = "https://onlyutils.com";
export const githubUrl = "https://github.com/onlyutils/verified-nepal";
export const opmcmMissingPersonUrl = "https://rescue.opmcm.gov.np/person-lost-found?type=lost";
export const opmcmAskHelpUrl = "https://rescue.opmcm.gov.np/ask-help";
export const opmcmUpdatesUrl = "https://rescue.opmcm.gov.np/government-efforts";
export const opmcmApiBase = "https://rescue.opmcm.gov.np/api/";
export const opmcmUnidentifiedUrl = "https://rescue.opmcm.gov.np/unidentified-bodies";
export const opmcmReportUrl = (id: string) => `https://rescue.opmcm.gov.np/person-reports/${encodeURIComponent(id)}`;
/** Server-side name search across the portal's public lost/found reports (both types). */
export function opmcmReportSearchUrl(query: string) {
  const params = new URLSearchParams({ search: query.trim(), limit: "30" });
  return `${opmcmApiBase}person-reports?${params.toString()}`;
}
