/**
 * Environment preconditions, in one place.
 *
 * Every lane reads configuration the machine is supposed to supply, and every
 * lane used to refuse in its own words: two verbatim copies of this function
 * (the tenant seam and the auth lane) said only `X is not set`, while the two
 * sites someone happened to hand-write pointed at `.env.example`. That drift is
 * the fault this module fixes — not the wording of any one message. A reader
 * who hits an unset variable is a reader who does not yet know the file exists,
 * so the pointer belongs in the shape, where the next variable inherits it
 * rather than getting it by coin-flip.
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set (see .env.example)`);
  }
  return value;
}
