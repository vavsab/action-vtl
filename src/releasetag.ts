import * as github from '@actions/github';
import {Context} from '@actions/github/lib/context';
import * as core from '@actions/core';
import {Octokit} from '@octokit/core';

export interface CreateReleaseResult {
  // Not null if push was made in releases branch (usually main) or if someone decided to rerun the latest build. Otherwise set to null.
  createdReleaseTag: ReleaseTagVersion | null;

  // Represents previous version. Or the latest version if release was not created. Or initial version if there are no any valid releases yet.
  previousReleaseTag: ReleaseTagVersion;

  // Previous version commit sha. Null if previous version was not created yet (only in case when there are no valid release tags in repo).
  previousReleaseTagCommitSha: string | null;
}

export async function CreateReleaseTag(
  context: Context,
  token: string | null,
  releasesBranch: string,
  baseVersionStr: string | null,
): Promise<CreateReleaseResult> {
  const baseVersion = ReleaseTagVersion.parse(baseVersionStr);
  if (baseVersion === null) {
    throw Error(`Failed to parse base version '${baseVersionStr}'`);
  }

  const res: CreateReleaseResult = {
    createdReleaseTag: null,
    previousReleaseTag: baseVersion,
    previousReleaseTagCommitSha: null,
  };

  if (!token) {
    core.info("GitHub token is missing. Skipping release creation...")
    return res;
  }

  const gitHubClient = new GitHubClient(token, context.repo.owner, context.repo.repo);
  const tags = await gitHubClient.getTags();
  const commits = await gitHubClient.getCommits(context.sha);

  // Find the previous tag
  for (const tag of tags) {
    const ver = ReleaseTagVersion.parse(tag.name);

    // Skip releases with invalid format
    if (ver === null) {
      continue;
    }

    // Skip releases that are not related to the current commit.
    // For example this build may run inside of a separate branch that is behind main branch.
    // Or this build may be a rerun of some failed build several commit earlier in main branch.
    if (!commits.find(x => x.sha === tag.commit.sha)) {
      continue;
    }

    if (ver.isGreaterOrEqualTo(res.previousReleaseTag)) {
      res.previousReleaseTag = ver;
      res.previousReleaseTagCommitSha = tag.commit.sha;
    }
  }

  // Do not create release if developer intentionally switched this feature off
  if (!releasesBranch) {
    return res;
  }

  // Do not create releases for tags and pull requests etc. Creation is only allowed for simple commit pushes.
  if (context.eventName !== 'push') {
    return res;
  }

  const branchRegExp = new RegExp(`refs/heads/${releasesBranch}`);

  // Tagging is allowed only for one selected branch (usually main branch)
  if (!branchRegExp.test(context.ref)) {
    return res;
  }

  res.createdReleaseTag = ReleaseTagVersion.parse(res.previousReleaseTag.toString());
  if (res.createdReleaseTag == null) {
    throw Error(`Failed to clone previous version '${res.previousReleaseTag.toString()}'`);
  }

  let releaseComments = '';

  // Do not increment version if there is no any valid release tag yet.
  if (res.previousReleaseTagCommitSha !== null) {
    let incrementMajor = false;
    let incrementMinor = false;
    let incrementPatch = false;
    let reachedLatestReleaseCommit = false;
    const semanticCommitRegExp = /(feat|fix|chore|refactor|style|test|docs)(\(#(\w{0,15})\))?(!)?:\s?(.*)/i;

    // Choose the most significant change among all commits since previous release
    for (const commit of commits) {
      if (commit.sha === res.previousReleaseTagCommitSha) {
        reachedLatestReleaseCommit = true;
        break;
      }

      const message = commit.commit.message;
      const matches = semanticCommitRegExp.exec(message);

      if (message) {
        releaseComments += `\n${message}`;
      }

      if (matches === null) {
        // Always increment patch if developer does not write messages in "semantic commits" manner (https://gist.github.com/joshbuchea/6f47e86d2510bce28f8e7f42ae84c716)
        incrementPatch = true;
        continue;
      }

      // Breaking change rules described here https://www.conventionalcommits.org/en/v1.0.0/
      const breakingChangeSign = matches[4];
      if (breakingChangeSign || message.toUpperCase().includes('BREAKING CHANGE')) {
        incrementMajor = true;
        continue;
      }

      const commitType = matches[1];
      if (commitType === 'feat') {
        incrementMinor = true;
        continue;
      }

      incrementPatch = true;
    }

    if (!reachedLatestReleaseCommit) {
      throw Error(
        `Failed to reach the latest release tag '${res.previousReleaseTag.toString()}' (${
          res.previousReleaseTagCommitSha
        }) inside of the '${releasesBranch}' branch.`,
      );
    }

    if (incrementMajor) {
      res.createdReleaseTag.incrementMajor();
    } else if (incrementMinor) {
      res.createdReleaseTag.incrementMinor();
    } else if (incrementPatch) {
      res.createdReleaseTag.incrementPatch();
    } else {
      core.warning(
        'Did not find any new commit since the latest release tag. Seems that release is already created.',
      );
      return res;
    }
  }

  const nextTagName = res.createdReleaseTag.toString();
  gitHubClient.createTag(nextTagName, releaseComments, context.sha);
  core.info(`Created a tag '${nextTagName}'`);

  return res;
}

class GitHubClient {
  private octokit: Octokit;

  constructor(token: string, private owner: string, private repo: string) {
    this.octokit = github.getOctokit(token);
  }

  async getTags(): Promise<
    {
      name: string;
      commit: {
        sha: string;
      };
    }[]
  > {
    const res = await this.octokit.request('GET /repos/{owner}/{repo}/tags', {
      owner: this.owner,
      repo: this.repo,
      per_page: 100, // There might be some custom tags. Take the maximum amount of items to avoid searching for the valid latest release through several pages
    });

    return res.data;
  }

  async getCommits(
    startFromSha: string,
  ): Promise<
    {
      sha: string;
      commit: {
        message: string;
      };
    }[]
  > {
    const res = await this.octokit.request('GET /repos/{owner}/{repo}/commits', {
      owner: this.owner,
      repo: this.repo,
      sha: startFromSha,
      per_page: 100, // Do not search for the latest release commit forever
    });

    return res.data;
  }

  async createTag(tagName: string, comments: string, commitSha: string): Promise<void> {
    await this.octokit.request('POST /repos/{owner}/{repo}/git/tags', {
      owner: this.owner,
      repo: this.repo,
      tag: tagName,
      message: comments,
      object: commitSha,
      type: 'commit',
    });

    await this.octokit.request('POST /repos/{owner}/{repo}/git/refs', {
      owner: this.owner,
      repo: this.repo,
      ref: `refs/tags/${tagName}`,
      sha: commitSha,
    });
  }
}

export class ReleaseTagVersion {
  private static regexp = /v?(\d+).(\d+).(\d+)/;

  constructor(private major: number, private minor: number, private patch: number) {}

  getMajor(): number {
    return this.major;
  }

  getMinor(): number {
    return this.minor;
  }

  getPatch(): number {
    return this.patch;
  }

  toString(): string {
    return `v${this.major}.${this.minor}.${this.patch}`;
  }

  isGreaterOrEqualTo(ver: ReleaseTagVersion): boolean {
    if (this.major !== ver.major) {
      return this.major > ver.major;
    }

    if (this.minor !== ver.minor) {
      return this.minor > ver.minor;
    }

    if (this.patch !== ver.patch) {
      return this.patch > ver.patch;
    }

    return true;
  }

  incrementMajor(): void {
    this.major++;
    this.minor = 0;
    this.patch = 0;
  }

  incrementMinor(): void {
    this.minor++;
    this.patch = 0;
  }

  incrementPatch(): void {
    this.patch++;
  }

  static parse(val: string | undefined | null): ReleaseTagVersion | null {
    if (val === undefined || val === null) {
      return null;
    }

    const res = ReleaseTagVersion.regexp.exec(val);
    if (res === null) {
      return null;
    }

    return new ReleaseTagVersion(parseInt(res[1]), parseInt(res[2]), parseInt(res[3]));
  }
}
