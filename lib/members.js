export const MEMBERS = {
  "kgardner@discoverultrium.com": { name: "Kalena", role: "owner" },
  "paris@ultriumtechnologies.com": { name: "Paris", role: "strategist" },
};

export function memberForEmail(email = "") {
  const normalized = email.trim().toLowerCase();
  const member = MEMBERS[normalized];
  return member ? { email: normalized, ...member } : null;
}
