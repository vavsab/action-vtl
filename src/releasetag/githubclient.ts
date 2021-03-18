import * as github from '@actions/github';
import {Octokit} from '@octokit/core';

export class GitHubClient {
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
