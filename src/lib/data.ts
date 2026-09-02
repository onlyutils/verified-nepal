import meta from "../../public/data/meta.json";
import messages from "../../public/data/messages.json";
import countryCounts from "../../public/data/country-counts.json";
import rescuedLocations from "../../public/data/rescued-locations.json";
import rescuedStatistics from "../../public/data/rescued-statistics.json";
import stationedLocations from "../../public/data/stationed-locations.json";
import statusCounts from "../../public/data/status-counts.json";
import statuses from "../../public/data/statuses.json";
import type {
  CountryCount,
  LocationCollection,
  MessageItem,
  MetaData,
  RescueStatisticsData,
  RescueStatus,
  StatusCountsData,
} from "@/lib/types";

export const data = {
  meta: meta as unknown as MetaData,
  messages: messages as unknown as MessageItem[] | { results?: MessageItem[] },
  countryCounts: countryCounts as unknown as CountryCount[],
  rescuedLocations: rescuedLocations as unknown as LocationCollection,
  rescuedStatistics: rescuedStatistics as unknown as RescueStatisticsData,
  stationedLocations: stationedLocations as unknown as LocationCollection,
  statusCounts: statusCounts as unknown as StatusCountsData,
  statuses: statuses as unknown as RescueStatus[] | { results?: RescueStatus[] },
};
