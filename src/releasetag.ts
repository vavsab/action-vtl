import * as github from '@actions/github';
import {Context} from '@actions/github/lib/context';
import * as core from '@actions/core';

export async function CreateReleaseTag(
  context: Context,
  token: string | null,
  releasesBranch: string,
  initialReleaseTag: string | null,
): Promise<string | null> {
  const branchRegExp = new RegExp(`refs/heads/${releasesBranch}`);

  // Tagging is allowed only for main branch
  if (!branchRegExp.test(context.ref)) {
    return null;
  }

  if (!token) {
    return null;
  }

  const octokit = github.getOctokit(token);

  const tags = await octokit.request('GET /repos/{owner}/{repo}/tags', {
    owner: context.repo.owner,
    repo: context.repo.repo,
    per_page: 100, // There might be some custom tags. Take the maximum amount of items to avoid searching for the valid latest release through several pages
  });

  let latestVersion: Version | null = null;
  let latestVersionCommit: string | null = null;

  for (const tag of tags.data) {
    const ver = Version.parse(tag.name);
    if (ver === null) {
      continue;
    }

    if (latestVersion === null || ver.isGreaterThan(latestVersion)) {
      latestVersion = ver;
      latestVersionCommit = tag.commit.sha;
    }
  }

  if (latestVersion === null && initialReleaseTag) {
    core.info(`Could not find any valid release tag. Trying to use initial tag from config...`);
    latestVersion = Version.parse(initialReleaseTag);
  }

  if (latestVersion === null) {
    core.info(
      `Could not find any valid release tag. Initial tag parameter is not set or invalid. Setting version to v1.0.0`,
    );
    latestVersion = new Version(1, 0, 0);
  }

  const nextVersion = Version.parse(latestVersion.toString());
  if (nextVersion == null) {
    throw Error('Failed to parse latest version');
  }

  let incrementMajor = false;
  let incrementMinor = false;
  let incrementPatch = false;
  let reachedLatestReleaseCommit = false;

  let releaseComments = '';

  // Do not increment version if there is no any valid release tag yet.
  if (latestVersionCommit !== null) {
    const commits = await octokit.request('GET /repos/{owner}/{repo}/commits', {
      owner: context.repo.owner,
      repo: context.repo.repo,
      sha: releasesBranch,
      per_page: 100, // Do not search for the latest release commit forever
    });

    const semanticCommitRegExp = /(feat|fix|chore|refactor|style|test|docs|BREAKING.?CHANGE)(\(#(\w{0,15})\))?:\s?(.*)/i;

    // Choose the most significant change among all commits since previous release
    for (const commit of commits.data) {
      if (commit.sha === latestVersionCommit) {
        reachedLatestReleaseCommit = true;
        break;
      }

      const matches = semanticCommitRegExp.exec(commit.commit.message);

      if (commit.commit.message) {
        releaseComments += `\n${commit.commit.message}`;
      }

      if (matches === null) {
        // Always increment patch if developer does not write messages in "semantic commits" manner (https://gist.github.com/joshbuchea/6f47e86d2510bce28f8e7f42ae84c716)
        incrementPatch = true;
        continue;
      }

      const commitType = matches[1].toLowerCase();
      if (commitType.startsWith('breaking')) {
        incrementMajor = true;
        continue;
      }

      if (commitType === 'feat') {
        incrementMinor = true;
        continue;
      }

      incrementPatch = true;
    }

    if (!reachedLatestReleaseCommit) {
      core.warning(
        `Failed to reach the latest release tag '${latestVersion.toString()}' (${latestVersionCommit}) inside of the '${releasesBranch}' branch. Skipped tag creation.`,
      );
      return null;
    }

    if (incrementMajor) {
      nextVersion.incrementMajor();
    } else if (incrementMinor) {
      nextVersion.incrementMinor();
    } else if (incrementPatch) {
      nextVersion.incrementPatch();
    } else {
      core.warning(
        'Did not find any new commits since the latest release tag. Skipped release creation.',
      );
      return null;
    }
  }

  const nextTagName = nextVersion.toString();

  await octokit.request('POST /repos/{owner}/{repo}/git/tags', {
    owner: context.repo.owner,
    repo: context.repo.repo,
    tag: nextTagName,
    message: releaseComments,
    object: context.sha,
    type: 'commit',
  });

  await octokit.request('POST /repos/{owner}/{repo}/git/refs', {
    owner: context.repo.owner,
    repo: context.repo.repo,
    ref: nextTagName,
    sha: context.sha,
  });

  core.info(`Created a tag '${nextTagName}'`);

  return nextTagName;
}

class Version {
  private static regexp = /v(\d+).(\d+).(\d+)/;

  constructor(private major: number, private minor: number, private patch: number) {}

  toString(): string {
    return `v${this.major}.${this.minor}.${this.patch}`;
  }

  // TODO: Cover with tests
  isGreaterThan(ver: Version): boolean {
    if (this.major !== ver.major) {
      return this.major > ver.major;
    }

    if (this.minor !== ver.minor) {
      return this.minor > ver.minor;
    }

    if (this.patch !== ver.patch) {
      return this.patch > ver.patch;
    }

    return false;
  }

  // TODO: Cover with tests
  incrementMajor(): void {
    this.major++;
    this.minor = 0;
    this.patch = 0;
  }

  // TODO: Cover with tests
  incrementMinor(): void {
    this.minor++;
    this.patch = 0;
  }

  // TODO: Cover with tests
  incrementPatch(): void {
    this.patch++;
  }

  // TODO: Cover with tests
  static parse(val: string | undefined): Version | null {
    if (val === undefined) {
      return null;
    }

    const res = Version.regexp.exec(val);
    if (res === null) {
      return null;
    }

    return new Version(parseInt(res[1]), parseInt(res[2]), parseInt(res[3]));
  }
}
