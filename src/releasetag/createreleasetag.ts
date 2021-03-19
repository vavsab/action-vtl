import {Context} from '@actions/github/lib/context';
import * as core from '@actions/core';
import {GitHubClient} from './githubclient';
import {ReleaseTagVersion} from './releasetagversion';

export class CreateReleaseResult {
  constructor(
    // Not null if push was made in releases branch (usually main) or if someone decided to rerun the latest build. Otherwise set to null.
    public createdReleaseTag: ReleaseTagVersion | null,

    // Represents previous version. Or the latest version if release was not created. Or initial version if there are no any valid releases yet.
    public previousReleaseTag: ReleaseTagVersion,

    // Previous version commit sha. Null if previous version was not created yet (only in case when there are no valid release tags in repo).
    public previousReleaseTagCommitSha: string | null,
  ) {}

  isPrerelease(): boolean {
    return this.createdReleaseTag === null;
  }

  getBaseVersionOverride(): string {
    return (this.createdReleaseTag ?? this.previousReleaseTag).toString();
  }
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

  const res = new CreateReleaseResult(null, baseVersion, null);

  if (!token) {
    core.info('GitHub token is missing. Skipping release creation...');
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
      core.info(
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
