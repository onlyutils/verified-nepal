export function toMeView({ sub, email, name, role, districts, guidelinesAckAt, lastSeen, activity }) {
  const out = { sub, email: email ?? "", name: name ?? "", role, districts: districts ?? [] };
  if (guidelinesAckAt) out.guidelinesAckAt = guidelinesAckAt;
  if (lastSeen && Object.keys(lastSeen).length) out.lastSeen = lastSeen;
  if (activity) out.activity = activity;
  return out;
}

export function toAdminUserView(u, fallbackSub) {
  return {
    sub: u.sub || fallbackSub,
    email: u.email || "",
    name: u.name || "",
    role: u.role,
    districts: Array.isArray(u.districts) ? u.districts : [],
    guidelinesAckAt: u.guidelinesAckAt,
    createdAt: u.createdAt,
  };
}
