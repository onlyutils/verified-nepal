import { csvEscape } from "../lib/http.js";
import { getMunicipality } from "../lib/adminUnits.js";

export function toAssignmentView(item) {
  return {
    id: item.id,
    orgId: item.orgId,
    shiftDate: item.shiftDate,
    shift: item.shift,
    assigneeSub: item.assigneeSub,
    assigneeName: item.assigneeName,
    ...(item.needId ? { needId: item.needId } : {}),
    ...(item.distributionId ? { distributionId: item.distributionId } : {}),
    ...(item.siteLabel ? { siteLabel: item.siteLabel } : {}),
    task: item.task,
    status: item.status,
    statusAt: item.statusAt,
    createdBy: item.createdBy,
    createdAt: item.createdAt,
  };
}

export function toActivityView(item) {
  return {
    at: item.at,
    bySub: item.bySub,
    byName: item.byName,
    text: item.text,
    ...(item.needId ? { needId: item.needId } : {}),
    ...(item.assignmentId ? { assignmentId: item.assignmentId } : {}),
  };
}

function toOpenNeedView(need) {
  return {
    id: need.id,
    category: need.category,
    description: need.description,
    status: need.status,
    district: need.beneficiary?.district || need.district,
    municipalityId: need.beneficiary?.municipalityId,
    municipality: getMunicipality(need.beneficiary?.municipalityId)?.name,
    ward: need.beneficiary?.ward ?? need.ward,
    createdAt: need.createdAt,
  };
}

export function groupAssignments(assignments) {
  const groups = new Map();
  for (const assignment of assignments) {
    let group = groups.get(assignment.assigneeSub);
    if (!group) {
      group = { assigneeSub: assignment.assigneeSub, assigneeName: assignment.assigneeName, assignments: [] };
      groups.set(assignment.assigneeSub, group);
    }
    group.assignments.push(toAssignmentView(assignment));
  }
  return Array.from(groups.values());
}

export function toHandoverView({ org, date, shift, assignments, activities, openNeeds, generatedAt }) {
  return {
    orgName: org.name,
    date,
    shift,
    assignments: groupAssignments(assignments),
    log: activities.map(toActivityView),
    openNeeds: openNeeds.map(toOpenNeedView),
    generatedAt,
  };
}

const ASSIGNMENT_COLUMNS = ["assignee", "date", "shift", "task", "status", "statusAt", "needId", "distributionId", "siteLabel"];
const LOG_COLUMNS = ["at", "by", "text", "needId", "assignmentId"];

export function toHandoverCsv({ assignments, activities }) {
  const assignmentRows = assignments.map((item) => [
    item.assigneeName, item.shiftDate, item.shift, item.task, item.status, item.statusAt,
    item.needId, item.distributionId, item.siteLabel,
  ]);
  const logRows = activities.map((item) => [item.at, item.byName, item.text, item.needId, item.assignmentId]);
  return [
    ASSIGNMENT_COLUMNS,
    ...assignmentRows,
    [],
    LOG_COLUMNS,
    ...logRows,
  ].map((row) => row.map(csvEscape).join(",")).join("\n");
}
