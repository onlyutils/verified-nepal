export function toPublicEntryView(entry) {
  const out = {
    id: entry.id,
    centerId: entry.centerId,
    district: entry.district,
    entryType: entry.entryType,
    category: entry.category,
    unit: entry.unit,
    qty: entry.qty,
    delta: entry.delta,
    createdAt: entry.createdAt,
  };
  // note and destinationLabel are free text that can contain PII (names, phones);
  // they are omitted from the public view and restored only in toPrivateEntryView.
  if (entry.transferId !== undefined) out.transferId = entry.transferId;
  if (entry.transferStatus !== undefined) out.transferStatus = entry.transferStatus;
  if (entry.destinationType !== undefined) out.destinationType = entry.destinationType;
  if (entry.destinationCenterId !== undefined) out.destinationCenterId = entry.destinationCenterId;
  if (entry.sourceCenterId !== undefined) out.sourceCenterId = entry.sourceCenterId;
  if (entry.sourceLabel !== undefined) out.sourceLabel = entry.sourceLabel;
  if (entry.qtyReceived !== undefined) out.qtyReceived = entry.qtyReceived;
  if (entry.discrepancy !== undefined) out.discrepancy = entry.discrepancy;
  if (entry.correctsEntryId !== undefined) out.correctsEntryId = entry.correctsEntryId;
  if (entry.correctedByEntryId !== undefined) out.correctedByEntryId = entry.correctedByEntryId;
  if (entry.donationRef !== undefined) out.donationRef = entry.donationRef;
  return out;
}

export function toPrivateEntryView(entry) {
  const out = toPublicEntryView(entry);
  if (entry.note !== undefined) out.note = entry.note;
  if (entry.destinationLabel !== undefined) out.destinationLabel = entry.destinationLabel;
  if (entry.createdBy !== undefined) out.createdBy = entry.createdBy;
  if (entry.createdByName !== undefined) out.createdByName = entry.createdByName;
  return out;
}
