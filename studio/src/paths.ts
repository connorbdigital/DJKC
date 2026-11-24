/** Path helpers shared by the installer and the packs, kept separate to avoid a cycle. */

/** Where a source file lands in the target repo. */
export function targetPath(prefix: string, sourcePath: string): string {
  const clean = prefix.trim().replace(/^\/+|\/+$/g, "");
  return clean ? `${clean}/${sourcePath}` : sourcePath;
}

/** studio/feature-booking-form-deposits-2026-11-24-0530 */
export function branchName(capabilityId: string, at: Date): string {
  const stamp = at.toISOString().slice(0, 16).replace(/[:T]/g, "-");
  return `studio/feature-${capabilityId}-${stamp}`;
}

/** studio/pack-new-site-2026-11-24-0530 */
export function packBranchName(packId: string, at: Date): string {
  const stamp = at.toISOString().slice(0, 16).replace(/[:T]/g, "-");
  return `studio/pack-${packId}-${stamp}`;
}
