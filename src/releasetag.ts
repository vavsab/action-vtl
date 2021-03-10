import * as github from '@actions/github';
import {Context} from '@actions/github/lib/context';
import * as core from '@actions/core';

export async function CreateReleaseTag(
    context: Context,
    token: string | null,
) {
    // TODO: Move into vars
    const mainBranch = "main"
    const initialTag: string | null = "v1.0.0"

    const branchRegExp = new RegExp(`refs/heads/${mainBranch}`)

    // Tagging is allowed only for main branch
    if (!branchRegExp.test(context.ref)) {
        return;
    }
    
    if (!token) {
        return;
    }
    
    const octokit = github.getOctokit(token);

    // TODO: This will only return first 30 results. Use pagination to search among all releases.
    const tags = await octokit.request('GET /repos/{owner}/{repo}/tags', {
        owner: context.repo.owner,
        repo: context.repo.repo,
    });

    // TODO: Remove
    core.info(`Tags: ${JSON.stringify(tags)}`);

    let latestVersion: Version | null = null;
    let latestVersionCommit: string | null = null;

    tags.data.forEach(tag => {
        const ver = Version.parse(tag.name);
        if (ver == null) {
            return;
        }

        if (latestVersion == null || ver.isGreaterThan(latestVersion)) {
            latestVersion = ver;
            latestVersionCommit = tag.commit.sha;
        }
    });

    // TODO: Remove 
    if (latestVersion != null) {
        core.info(`latestVersion: ${latestVersion!.toString()}, latestVersionCommit: ${latestVersionCommit!.toString()}`);
    }

    if (latestVersion == null && initialTag) {
        core.info(`Could not find any valid release tag. Trying to use initial tag from config...`);
        latestVersion = Version.parse(initialTag);
    }

    if (latestVersion == null) {
        core.info(`Could not find any valid release tag. Initial tag parameter is not set or invalid. Setting version to v1.0.0`);
        latestVersion = Version.parse("v1.0.0");
    }

    const nextVersion = Version.parse(latestVersion!.toString());

    // TODO: Increment according to semantic commits
    nextVersion?.incrementPatch();
    
    var nextTagName = nextVersion!.toString();

    await octokit.request('POST /repos/{owner}/{repo}/releases', {
        owner: context.repo.owner,
        repo: context.repo.repo,
        tag_name: nextTagName
    })

    core.info(`Created a release with tag '${nextTagName}'`);

    const commits = await octokit.request('GET /repos/{owner}/{repo}/commits', {
        owner: context.repo.owner,
        repo: context.repo.repo,
        sha: mainBranch
    });

    // TODO: Remove
    core.info(`Commits: ${JSON.stringify(commits)}`);

    // TODO: Remove
    core.info(`Context: ${JSON.stringify(context)}`);
}

class Version {
    private static regexp = /v(\d+).(\d+).(\d+)/;

    constructor(private major: number, private minor: number, private patch: number) {
    }

    toString(): string {
        return `v${this.major}.${this.minor}.${this.patch}`;
    }

    // TODO: Cover with tests
    isGreaterThan(ver: Version): boolean {
        if (this.major != ver.major) {
            return this.major > ver.major;
        }

        if (this.minor != ver.minor) {
            return this.minor > ver.minor;
        }

        if (this.patch != ver.patch) {
            return this.patch > ver.patch;
        }

        return false;
    }

    // TODO: Cover with tests
    incrementMajor() {
        this.major++;
    }

    // TODO: Cover with tests
    incrementMinor() {
        this.minor++;
    }

    // TODO: Cover with tests
    incrementPatch() {
        this.patch++;
    }

    // TODO: Cover with tests
    static parse(val: string): Version | null {
        const res = Version.regexp.exec(val);
        if (res == null) {
            return null;
        }

        return new Version(parseInt(res.groups![0]), parseInt(res.groups![1]), parseInt(res.groups![2]))
    }
}

