export function toPublicDonationView(donation) {
  const out = {
    ref: donation.ref,
    center: { id: donation.centerId, name: donation.centerName, district: donation.district },
    category: donation.category,
    unit: donation.unit,
    qty: donation.qty,
    status: donation.status,
    declaredAt: donation.declaredAt,
  };
  if (donation.note !== undefined) out.note = donation.note;
  if (donation.receivedAt !== undefined) out.receivedAt = donation.receivedAt;
  if (donation.sinceReceived !== undefined) out.sinceReceived = donation.sinceReceived;
  return out;
}

export function toDonationListItem(donation) {
  return toPublicDonationView(donation);
}
