const VERSION_PATTERN = /^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)$/;

export function parseReleaseVersion(value) {
  const match = VERSION_PATTERN.exec(String(value));
  if (!match) {
    throw new Error(`Invalid release version "${value}". Expected MAJOR.MINOR.PATCH.`);
  }
  return match.slice(1).map(Number);
}

/**
 * Increment the patch for each production release. Patch 99 rolls over to the
 * next minor version, keeping release tags numeric and monotonically ordered.
 */
export function incrementReleaseVersion(currentVersion, existingTags = []) {
  const [major, minor, patch] = parseReleaseVersion(currentVersion);
  let nextMinor = minor;
  let nextPatch = patch;

  do {
    if (nextPatch >= 99) {
      nextMinor += 1;
      nextPatch = 0;
    } else {
      nextPatch += 1;
    }
    const candidate = `${major}.${nextMinor}.${nextPatch}`;
    if (!existingTags.includes(`v${candidate}`)) return candidate;
  } while (nextMinor < Number.MAX_SAFE_INTEGER);

  throw new Error('Unable to find an unused release version.');
}
