import * as github from '@actions/github';
import {Context} from '@actions/github/lib/context';
import * as core from '@actions/core';

export async function CreateReleaseTag(
    context: Context,
    token: string | null
) {
    if (token) {
        const octokit = github.getOctokit(token);
        const tag = 'v1.0.0';

        await octokit.request('POST /repos/{owner}/{repo}/releases', {
            owner: context.repo.owner,
            repo: context.repo.repo,
            tag_name: tag
        })

        core.info(`Created tag '${tag}'`)
    }
}