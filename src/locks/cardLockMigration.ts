/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * CardLock hotel-identity guard.
 *
 * Every card family carries the 16-bit site code stored in CardLock.mdb. When
 * the imported database changes that code, the physical locks still belong to
 * the previous hotel until they are reprogrammed, so the app suspends access
 * cards and demands a full re-commissioning.
 *
 * A data purge also keeps the previous-site marker on purpose. Re-importing the
 * *same* database after such a purge is not a hotel change: the site code still
 * identifies the same hotel. Treating it as a migration used to deadlock the
 * import (same code rejected) and every card (migration pending with no
 * database loaded). This resolver keeps the refusal only when a database is
 * still loaded — i.e. the user is genuinely switching back to the hotel they
 * migrated away from.
 */

export interface CardLockImportState {
  /** Site code read from the database being imported, or null without a profile. */
  nextSiteCode: number | null;
  /** Site code of the database currently loaded in memory, if any. */
  currentSiteCode: number | undefined;
  /** True when a CardLock database with a system profile is still loaded. */
  hasLoadedDatabase: boolean;
  /** Raw `appointment_prousb_previous_site` value. */
  previousSite: string | null;
  /** True when `appointment_prousb_recommissioning_required` is `'true'`. */
  recommissioningRequired: boolean;
}

export interface CardLockImportDecision {
  /** Refuse the import: the user is going back to the previous hotel. */
  blocked: boolean;
  /** The imported database introduces a different hotel identity. */
  siteChanged: boolean;
  /** Drop the stale previous-site/recommissioning markers before importing. */
  clearGuard: boolean;
}

export function resolveCardLockImport(state: CardLockImportState): CardLockImportDecision {
  const { nextSiteCode, currentSiteCode, hasLoadedDatabase, previousSite, recommissioningRequired } = state;

  const sameAsPrevious = previousSite !== null
    && nextSiteCode !== null
    && Number(previousSite) === nextSiteCode;

  if (sameAsPrevious) {
    // Still returning to the hotel we migrated away from: a *different*
    // database is loaded, so the locks carry the new identity and the old
    // database stays refused.
    if (recommissioningRequired && hasLoadedDatabase && currentSiteCode !== nextSiteCode) {
      return { blocked: true, siteChanged: false, clearGuard: false };
    }
    // Same site code without an active hotel switch (no database loaded, or
    // the same database is already loaded) => not a migration; clear the
    // markers so import and card issuance keep working.
    return { blocked: false, siteChanged: false, clearGuard: true };
  }

  const siteChanged = previousSite !== null
    ? nextSiteCode !== null && Number(previousSite) !== nextSiteCode
    : currentSiteCode !== undefined
      && nextSiteCode !== null
      && currentSiteCode !== nextSiteCode;

  return { blocked: false, siteChanged, clearGuard: false };
}
