import {Context} from '@actions/github/lib/context';
import {ReleaseTagVersion} from './releasetag';

export const SEMVER_REGEX = /(?<=^v?|\sv?)(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|[\da-z-]*[a-z-][\da-z-]*)(?:\.(?:0|[1-9]\d*|[\da-z-]*[a-z-][\da-z-]*))*))?(?:\+([\da-z-]+(?:\.[\da-z-]+)*))?(?=$|\s)/i;
const NUMERIC_REGEX = /^\d+$/;

export interface Version {
  tag: string;
  semVer: string;
  major: number;
  minor: number;
  patch: number;
  preRelease: string;
  metadata: string;
  buildNumber: string;
  created: string;
  semVerNoMeta: string;
  semVerFourTupleNumeric: string;
}

export async function SemVer(
  baseVer: string,
  branchMappings: Map<string, string>,
  preReleasePrefix: string,
  context: Context,
  releaseTagVersion: ReleaseTagVersion | null = null,
): Promise<Version> {
  // Validate the base SEMVER
  const baseVerParts = baseVer.match(SEMVER_REGEX);
  if (baseVerParts == null || baseVerParts.length < 3) {
    throw new Error(`base-version of "${baseVer}" is not a valid SEMVER`);
  }

  // Get the pre-release prefix
  if (preReleasePrefix.length > 0) {
    preReleasePrefix += '.';
  }

  // Unless a tag changes it, the base ver is what we work from
  const created = new Date().toISOString();
  const ver: Version = {
    major: parseInt(baseVerParts[1] ?? '0', 10),
    minor: parseInt(baseVerParts[2] ?? '0', 10),
    patch: parseInt(baseVerParts[3] ?? '0', 10),
    preRelease: preReleasePrefix + context.runNumber.toString(),
    metadata: `${created.replace(/[.:-]/g, '')}.sha-${context.sha.substring(0, 8)}`,
    buildNumber: context.runNumber.toString(),
    created,
    tag: '',
    semVer: '',
    semVerNoMeta: '',
    semVerFourTupleNumeric: '',
  };

  // Update the tag and version based on the event name and ref values
  if (context.ref.startsWith('refs/tags')) {
    // The ref is a tag, parse it as a SEMVER
    const tagName = context.ref.substring('refs/tags/'.length);

    // Parse and validate the tag
    const tagParts = tagName.match(SEMVER_REGEX);
    if (tagParts == null || tagParts.length === 0) {
      throw new Error(`Tag of "${tagName}" is not a valid SEMVER`);
    }

    // Use the tag
    ver.tag = tagName.toLowerCase();

    // Tag wins for everything except metadata
    ver.major = parseInt(tagParts[1] ?? '0', 10);
    ver.minor = parseInt(tagParts[2] ?? '0', 10);
    ver.patch = parseInt(tagParts[3] ?? '0', 10);
    ver.preRelease = tagParts[4] ?? '';
  } else if (context.eventName === 'schedule') {
    // Scheduled builds just get a nightly tag
    ver.tag = 'nightly';
  } else if (context.eventName === 'pull_request') {
    // PR gets a simple 'pr-#' tag
    ver.tag = `pr-${context.ref.split('/')[2]}`;
  } else if (context.ref.startsWith('refs/heads')) {
    // Get the branch name
    const branchName = context.ref.substring('refs/heads/'.length).toLowerCase().replace('/', '-');

    // Handle any mappings
    if (branchMappings.has(branchName)) {
      const targetTag = branchMappings.get(branchName);
      if (!targetTag) {
        throw new Error("Target tag existed and then it didn't");
      }
      ver.tag = targetTag.toLowerCase();
    } else {
      ver.tag = branchName.toLowerCase();
    }

    // Override version with a release tag if it was created
    if (releaseTagVersion) {
      ver.preRelease = '';
      ver.major = releaseTagVersion.getMajor();
      ver.minor = releaseTagVersion.getMinor();
      ver.patch = releaseTagVersion.getPatch();
    }
  } else {
    throw new Error(`Unsupported event name (${context.eventName}) or ref (${context.ref})`);
  }

  // Put the SEMVER together
  ver.semVer = `${ver.major}.${ver.minor}.${ver.patch}`;
  if (ver.preRelease.length > 0) {
    ver.semVer += `-${ver.preRelease}`;
  }
  ver.semVerNoMeta = ver.semVer;
  if (ver.metadata.length > 0) {
    ver.semVer += `+${ver.metadata}`;
  }

  ver.semVerFourTupleNumeric = `${ver.major}.${ver.minor}.${ver.patch}.${ver.buildNumber}`;

  // Done
  return ver;
}

/**
 * Compares two SEMVER strings using https://semver.org/#spec-item-11
 * if return value < 0 then it indicates left is less than right.
 * if return value > 0 then it indicates right is less than left.
 * if return value = 0 then it indicates left is equal to right.
 * @param left
 * @param right
 */
export function compareSemvers(left: string, right: string): number {
  const leftParts = left.match(SEMVER_REGEX);
  if (!leftParts) {
    throw new Error(`"${left} is not a valid SEMVER`);
  }
  const rightParts = right.match(SEMVER_REGEX);
  if (!rightParts) {
    throw new Error(`"${right} is not a valid SEMVER`);
  }

  // Major
  let leftInt = parseInt(leftParts[1], 10);
  let rightInt = parseInt(rightParts[1], 10);
  if (leftInt > rightInt) {
    return 1;
  } else if (leftInt < rightInt) {
    return -1;
  }

  // Minor
  leftInt = parseInt(leftParts[2], 10);
  rightInt = parseInt(rightParts[2], 10);
  if (leftInt > rightInt) {
    return 1;
  } else if (leftInt < rightInt) {
    return -1;
  }

  // Patch
  leftInt = parseInt(leftParts[3], 10);
  rightInt = parseInt(rightParts[3], 10);
  if (leftInt > rightInt) {
    return 1;
  } else if (leftInt < rightInt) {
    return -1;
  }

  // When major, minor, and patch are equal, a pre-release version has lower
  // precedence than a normal version
  if (leftParts[4] && !rightParts[4]) {
    return -1;
  } else if (!leftParts[4] && rightParts[4]) {
    return 1;
  } else if (leftParts[4] && rightParts[4]) {
    // Precedence for two pre-release versions with the same major, minor, and
    // patch version MUST be determined by comparing each dot separated identifier
    // from left to right until a difference is found
    const leftPRParts = leftParts[4].split('.');
    const rightPRParts = rightParts[4].split('.');
    for (let i = 0; i < Math.min(leftPRParts.length, rightPRParts.length); i++) {
      const leftNumeric = NUMERIC_REGEX.test(leftPRParts[i]);
      const rightNumeric = NUMERIC_REGEX.test(rightPRParts[i]);

      // Numeric identifiers always have lower precedence than non-numeric identifiers
      if (leftNumeric && !rightNumeric) {
        return -1;
      } else if (!leftNumeric && rightNumeric) {
        return 1;
      }

      // Identifiers consisting of only digits are compared numerically
      if (leftNumeric && rightNumeric) {
        leftInt = parseInt(leftPRParts[i], 10);
        rightInt = parseInt(rightPRParts[i], 10);
        if (leftInt > rightInt) {
          return 1;
        } else if (leftInt < rightInt) {
          return -1;
        }
      }

      // Identifiers with letters or hyphens are compared lexically in ASCII sort order
      const cmp = leftPRParts[i].localeCompare(rightPRParts[i]);
      if (cmp !== 0) {
        return cmp;
      }
    }

    // A larger set of pre-release fields has a higher precedence than a smaller set,
    // if all of the preceding identifiers are equal
    if (leftPRParts.length > rightPRParts.length) {
      return 1;
    } else if (leftPRParts.length < rightPRParts.length) {
      return -1;
    }
  }

  // Versions are equal
  return 0;
}
