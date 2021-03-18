import * as core from '@actions/core';
import * as github from '@actions/github';
import {SemVer} from './version';
import {GetOCI} from './oci';
import {GetDockerInfo} from './docker';
import {CreateReleaseTag} from './releasetag/createreleasetag';
import fs from 'fs';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isObject(obj: any): boolean {
  return obj === Object(obj);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function logAndOutputObject(key: string, value: any): void {
  if (value == null) {
    return;
  }

  if (isObject(value)) {
    // Object
    if (Array.isArray(value)) {
      throw new Error('Array types are not supported');
    }
    // Recurse for each property
    for (const [objKey, objValue] of Object.entries(value)) {
      logAndOutputObject(`${key}_${objKey}`, objValue);
    }
  } else {
    // Primitive type
    // TODO: Would be nice to output 'steps.<action_id>.outputs.<key>=<value', but context doesn't seem to give us the action id
    const strValue = value.toString();
    core.info(`${key}=${strValue}`);
    core.setOutput(key, strValue);
  }
}

async function run(): Promise<void> {
  try {
    // Log the full context
    // NOTE: Debug output can be enabled by setting the secret ACTIONS_STEP_DEBUG=true
    core.debug(JSON.stringify(github.context));

    // Get the base version
    const baseVer = core.getInput('baseVersion', {required: true});

    // Get the branch mappings
    const branchMappings = new Map<string, string>();
    const mappingsLines = core.getInput('branchMappings').split('\n');
    for (const mapping of mappingsLines) {
      const mappingParts = mapping.trim().split(':');
      branchMappings.set(mappingParts[0].toLowerCase(), mappingParts[1]);
    }

    // Get the pre-release prefix
    const preReleasePrefix = core.getInput('prereleasePrefix') ?? '';

    // Get the docker image name prefix
    const dockerImage = core.getInput('dockerImage') ?? '';

    // Get the github token
    const gitHubToken = core.getInput('gitHubToken') ?? '';

    // Get releases branch
    const releasesBranch = core.getInput('releasesBranch')?.trim() ?? '';

    // Create a release tag
    const createReleaseTagRes = await CreateReleaseTag(
      github.context,
      gitHubToken,
      releasesBranch,
      baseVer,
    );

    // Process the input
    const verInfo = await SemVer(
      createReleaseTagRes.getBaseVersionOverride(),
      createReleaseTagRes.isPrerelease(),
      branchMappings,
      preReleasePrefix,
      github.context,
    );

    const ociInfo = await GetOCI(verInfo, github.context);

    // Log and push the values back to the workflow runner
    logAndOutputObject('release_tag', createReleaseTagRes.createdReleaseTag?.toString());
    logAndOutputObject('release_previousTag', createReleaseTagRes.previousReleaseTag.toString());
    logAndOutputObject('ver', verInfo);
    logAndOutputObject('oci', ociInfo);

    // Add docker tags
    if (dockerImage != null && dockerImage.length > 0) {
      const dockerInfo = await GetDockerInfo(dockerImage, verInfo, github.context, gitHubToken);
      logAndOutputObject('docker', dockerInfo);
    }

    // Write out the version file
    const verFile = core.getInput('versionFile');
    fs.writeFile(verFile, verInfo.semVer, {encoding: 'utf8'}, function (err) {
      if (err) {
        throw err;
      }

      core.info(`Wrote semver to ${verFile}`);
    });
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
