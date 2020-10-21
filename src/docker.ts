import * as github from '@actions/github';
import {ReposListReleasesResponseData, OctokitResponse} from '@octokit/types';
import {Context} from '@actions/github/lib/context';
import {Version, SEMVER_REGEX, compareSemvers} from './version';
import {KnownPayload} from './oci';

export interface DockerInfo {
  tags: string;
  push: string;
}

export async function GetDockerInfo(
  dockerImage: string,
  version: Version,
  context: Context,
  token: string | null,
): Promise<DockerInfo> {
  // If we have repo info and a token, get releases first
  const payload = context.payload as KnownPayload;
  let releases: OctokitResponse<ReposListReleasesResponseData> | null = null;
  if (payload && token) {
    const octoKit = github.getOctokit(token);
    releases = await octoKit.repos.listReleases({
      owner: context.repo.owner, // payload.repository.owner.name ?? '',
      repo: context.repo.repo, //payload.repository.name,
    });
  }

  const tags = new Array<string>();
  let shouldPush = true;

  // Add the version tag if it is not latest
  if (version.tag !== 'latest') {
    // Without any 'v' prefix
    if (SEMVER_REGEX.test(version.tag) && version.tag.substring(0, 1).toLowerCase() === 'v') {
      tags.push(`${dockerImage}:${version.tag.substring(1)}`);
    } else {
      tags.push(`${dockerImage}:${version.tag}`);
    }
  }

  // For any push we add a sha tag
  if (context.eventName === 'push') {
    tags.push(`${dockerImage}:sha-${context.sha.substring(0, 8)}`);
  }

  // If the version's tag is a SEMVER, we need semver stable tags
  const semVerParts = version.tag.match(SEMVER_REGEX);
  if (semVerParts) {
    // Is this a pre-release?
    if (version.preRelease && version.preRelease.length > 0) {
      // Pre-release, only the full semver
      tags.push(`${dockerImage}:${version.semVerNoMeta}`);
    } else {
      // Not a pre-release, get all stable tags
      tags.push(`${dockerImage}:${version.major}`);
      tags.push(`${dockerImage}:${version.major}.${version.minor}`);
      tags.push(`${dockerImage}:${version.major}.${version.minor}.${version.patch}`);

      // Tagged build gets the 'latest' tag if it is the highest semver tag created
      if (releases) {
        // Look through all the releases for a newer tag
        let newest = true;
        for (const release of releases.data) {
          // Skip pre-releases
          if (release.prerelease) {
            continue;
          }

          if (compareSemvers(version.tag, release.tag_name) < 0) {
            // Found a newer tag that already existed
            newest = false;
            break;
          }
        }

        // If we didn't find a newer tag, add latest
        if (newest) {
          tags.push(`${dockerImage}:latest`);
        }
      }
    }
  }

  // PRs don't get pushed
  if (context.eventName === 'pull_request') {
    shouldPush = false;
  }

  // Remove duplicates tags
  const uniqueTags = [...new Set(tags)];

  // Put together the output
  const dockerInfo: DockerInfo = {
    tags: uniqueTags.join(','),
    push: shouldPush.toString(),
  };

  return dockerInfo;
}
