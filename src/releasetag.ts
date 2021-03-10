import * as github from '@actions/github';
import {Context} from '@actions/github/lib/context';
import * as core from '@actions/core';

export async function CreateReleaseTag(
    context: Context,
    token: string | null
) {
    if (token) {
        const octokit = github.getOctokit(token);
        const mainBranch = "main"

        // TODO: This will only return first 30 results. Use pagination to search among releases.
        const tags = await octokit.request('GET /repos/{owner}/{repo}/tags', {
            owner: context.repo.owner,
            repo: context.repo.repo,
        });

        core.info(`Tags: ${JSON.stringify(tags)}`);

        // await octokit.request('POST /repos/{owner}/{repo}/releases', {
        //     owner: context.repo.owner,
        //     repo: context.repo.repo,
        //     tag_name: tag
        // })

        const commits = await octokit.request('GET /repos/{owner}/{repo}/commits', {
            owner: context.repo.owner,
            repo: context.repo.repo,
            sha: mainBranch
        });

        core.info(`Commits: ${JSON.stringify(commits)}`);

        core.info(`Context: ${JSON.stringify(context)}`);
        const tag = 'v1.0.0';
        core.info(`Created tag '${tag}'`);
    }
}