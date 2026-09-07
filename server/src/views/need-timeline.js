const STEP_ORDER = { taken: 0, declared: 1, received: 2, handed_over: 3, confirmed: 4 };

/** Build the public, non-PII progress history shared by need views. */
export function needTimeline(need, { donation, ledgerRow } = {}) {
  const steps = [];
  if (need.handledBy?.at) steps.push({ key: "taken", at: need.handledBy.at });
  if (donation?.declaredAt) steps.push({ key: "declared", at: donation.declaredAt });
  if (donation?.receivedAt) steps.push({ key: "received", at: donation.receivedAt });
  const handedAt = ledgerRow?.redeemedAt || need.redeemedAt;
  if (need.deliveredBy && handedAt) steps.push({ key: "handed_over", at: handedAt });
  const confirmedAt = ledgerRow?.confirmedAt || need.confirmedAt;
  if (confirmedAt) steps.push({ key: "confirmed", at: confirmedAt });
  return steps.sort((a, b) => a.at.localeCompare(b.at) || STEP_ORDER[a.key] - STEP_ORDER[b.key]);
}
