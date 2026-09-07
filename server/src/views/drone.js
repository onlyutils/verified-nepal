import { getMunicipality } from "../lib/adminUnits.js";

function baseRequestView(item) {
  return {
    id: item.id, incidentId: item.incidentId, district: item.district,
    municipalityId: item.municipalityId, municipality: getMunicipality(item.municipalityId)?.name,
    ward: item.ward, landingSiteId: item.landingSiteId, items: item.items, weightKg: item.weightKg,
    coldChain: item.coldChain, priority: item.priority, windowStart: item.windowStart, windowEnd: item.windowEnd,
    status: item.status, assignedOperatorId: item.assignedOperatorId, assignedOrgId: item.assignedOrgId,
    assignedOrgName: item.assignedOrgName, missionId: item.missionId, createdAt: item.createdAt, updatedAt: item.updatedAt,
  };
}

export function toPrivateRequestView(item) {
  return { ...baseRequestView(item), requestedBy: item.requestedBy, contactPhone: item.contactPhone };
}

export function toPublicRequestView(item) { return baseRequestView(item); }

export function toPrivateOperatorView(item) {
  return {
    id: item.id, orgId: item.orgId, orgName: item.orgName, aircraft: item.aircraft, payloadKg: item.payloadKg,
    rangeKm: item.rangeKm, caanUin: item.caanUin, permitStatus: item.permitStatus, permitRef: item.permitRef,
    baseDistrict: item.baseDistrict, baseMunicipalityId: item.baseMunicipalityId, contactPhone: item.contactPhone,
    status: item.status, createdAt: item.createdAt,
  };
}

export function toPublicOperatorView(item) {
  return { id: item.id, orgName: item.orgName, aircraft: item.aircraft, payloadKg: item.payloadKg, rangeKm: item.rangeKm, baseDistrict: item.baseDistrict, permitStatus: item.permitStatus };
}

export function toPrivateSiteView(item) { return { ...item }; }

export function toPublicSiteView(item) {
  return {
    id: item.id, name: item.name, district: item.district, municipalityId: item.municipalityId,
    municipality: getMunicipality(item.municipalityId)?.name, ward: item.ward,
    clearanceM: item.clearanceM, surface: item.surface, status: item.status,
    // Landing-site coordinates are public infrastructure, not personal data; contacts stay private.
    lat: item.lat, lng: item.lng,
  };
}

export function toPrivateMissionView(item) { return { ...item }; }

export function toPublicMissionView(item, operator) {
  return { id: item.id, district: item.district, etd: item.etd, eta: item.eta, operatorAircraft: operator?.aircraft, org: operator?.orgName, status: item.status };
}
