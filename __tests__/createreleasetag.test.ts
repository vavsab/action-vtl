import {CreateReleaseTag} from '../src/releasetag/createreleasetag';
import {Context} from '@actions/github/lib/context';
import {CommitInfo, TagInfo} from '../src/releasetag/githubclient';

function generateContext(branch = 'main'): Context {
  let ctx: Context = {
    action: 'mapped/action-vtl',
    eventName: 'push',
    sha: 'a8cb3d0eae1f1a064896493f4cf63dafc17bafcf',
    ref: `refs/heads/${branch}`,
    workflow: 'build-test',
    actor: 'somedeveloper',
    job: 'somejob',
    runNumber: 17,
    runId: 262999999,
    repo: {
      owner: 'mapped',
      repo: 'action-vtl',
    },
    issue: {
      repo: 'action-vtl',
      number: 310,
      owner: 'somesubmitter',
    },
    payload: {
      repository: {
        name: 'action-vtl',
        owner: {
          login: 'mapped',
        },
      },
    },
  };

  return ctx;
}

let tags = [{name: 'v1.2.3', sha: 'a8cb3d0eae1f1a064896493f4cf63dafc17bafcf'}];

let commits = [
  {message: 'fix: Fix exception during startup', sha: 'a8cb3d0eae1f1a064896493f4cf63dafc17bafcf'},
];

const createTagMock = jest.fn();

jest.mock('../src/releasetag/githubclient', () => {
  return {
    GitHubClient: function () {
      return {
        async getTags(): Promise<TagInfo[]> {
          return tags.map(x => {
            return {
              name: x.name,
              commit: {
                sha: x.sha,
              },
            };
          });
        },
        async getCommits(): Promise<CommitInfo[]> {
          return commits.map(x => {
            return {
              commit: {
                message: x.message,
              },
              sha: x.sha,
            };
          });
        },
        createTag: createTagMock,
      };
    },
  };
});

test('create first release', async () => {
  const baseVer = '2.1.0';

  tags = [];

  commits = [
    {
      message: 'feat: Initial commit',
      sha: 'a8cb3d0eae1f1a064896493f4cf63dafc17bafcf',
    },
  ];

  const res = await CreateReleaseTag(generateContext(), 'token', 'main', baseVer);

  expect(res.createdReleaseTag?.toString()).toBe('v2.1.0');
  expect(res.previousReleaseTag.toString()).toBe('v2.1.0');
  expect(res.getBaseVersionOverride()).toBe('v2.1.0');
  expect(res.isPrerelease()).toBeFalsy();
  expect(createTagMock.mock.calls.length).toBe(1);
  expect(createTagMock.mock.calls[0][0]).toBe('v2.1.0');
});

test('create patch release', async () => {
  const baseVer = '1.0.0';

  tags = [{name: 'v3.5.9', sha: '0869c0d9638268ffbd1e03974ab0cdd07070c010'}];

  commits = [
    {
      message: 'fix: Color glitch',
      sha: 'a8cb3d0eae1f1a064896493f4cf63dafc17bafcf',
    },
    {
      message: 'feat: Previous release commit',
      sha: '0869c0d9638268ffbd1e03974ab0cdd07070c010',
    },
  ];

  const res = await CreateReleaseTag(generateContext(), 'token', 'main', baseVer);

  expect(res.createdReleaseTag?.toString()).toBe('v3.5.10');
  expect(res.previousReleaseTag.toString()).toBe('v3.5.9');
  expect(res.getBaseVersionOverride()).toBe('v3.5.10');
  expect(res.isPrerelease()).toBeFalsy();
  expect(createTagMock.mock.calls.length).toBe(1);
  expect(createTagMock.mock.calls[0][0]).toBe('v3.5.10');
});

test('create minor release', async () => {
  const baseVer = '1.0.0';

  tags = [{name: 'v3.5.9', sha: '0869c0d9638268ffbd1e03974ab0cdd07070c010'}];

  commits = [
    {
      message: 'feat: Add new browsing panel',
      sha: 'a8cb3d0eae1f1a064896493f4cf63dafc17bafcf',
    },
    {
      message: 'feat!: Previous release commit',
      sha: '0869c0d9638268ffbd1e03974ab0cdd07070c010',
    },
  ];

  const res = await CreateReleaseTag(generateContext(), 'token', 'main', baseVer);

  expect(res.createdReleaseTag?.toString()).toBe('v3.6.0');
  expect(res.previousReleaseTag.toString()).toBe('v3.5.9');
  expect(res.getBaseVersionOverride()).toBe('v3.6.0');
  expect(res.isPrerelease()).toBeFalsy();
  expect(createTagMock.mock.calls.length).toBe(1);
  expect(createTagMock.mock.calls[0][0]).toBe('v3.6.0');
});

test('create major release', async () => {
  const baseVer = '1.0.0';

  tags = [{name: 'v3.5.9', sha: '0869c0d9638268ffbd1e03974ab0cdd07070c010'}];

  commits = [
    {
      message: 'feat(#taskid)!: Add new browsing panel',
      sha: 'a8cb3d0eae1f1a064896493f4cf63dafc17bafcf',
    },
    {
      message: 'fix: Remove startup error',
      sha: '626efe378fc93eabf78a99b8ff1d70bb7dcc68a3',
    },
    {
      message: 'fix: Previous release commit',
      sha: '0869c0d9638268ffbd1e03974ab0cdd07070c010',
    },
  ];

  const res = await CreateReleaseTag(generateContext(), 'token', 'main', baseVer);

  expect(res.createdReleaseTag?.toString()).toBe('v4.0.0');
  expect(res.previousReleaseTag.toString()).toBe('v3.5.9');
  expect(res.getBaseVersionOverride()).toBe('v4.0.0');
  expect(res.isPrerelease()).toBeFalsy();
  expect(createTagMock.mock.calls.length).toBe(1);
  expect(createTagMock.mock.calls[0][0]).toBe('v4.0.0');
});

test('rerun for already created release', async () => {
  const baseVer = '1.0.0';

  tags = [{name: 'v3.5.9', sha: 'a8cb3d0eae1f1a064896493f4cf63dafc17bafcf'}];

  commits = [
    {
      message: 'feat(#taskid)!: New but already processed release commit',
      sha: 'a8cb3d0eae1f1a064896493f4cf63dafc17bafcf',
    },
    {
      message: 'fix: Remove startup error',
      sha: '626efe378fc93eabf78a99b8ff1d70bb7dcc68a3',
    },
    {
      message: 'fix: Previous release commit',
      sha: '0869c0d9638268ffbd1e03974ab0cdd07070c010',
    },
  ];

  const res = await CreateReleaseTag(generateContext(), 'token', 'main', baseVer);

  expect(res.createdReleaseTag?.toString()).toBe('v3.5.9');
  expect(res.previousReleaseTag.toString()).toBe('v3.5.9');
  expect(res.getBaseVersionOverride()).toBe('v3.5.9');
  expect(res.isPrerelease()).toBeFalsy();
  expect(createTagMock.mock.calls.length).toBe(0);
});

test('commits in other branch', async () => {
  const baseVer = '1.0.0';

  tags = [{name: 'v3.5.9', sha: '0869c0d9638268ffbd1e03974ab0cdd07070c010'}];

  commits = [
    {
      message: 'feat(#taskid)!: Add new browsing panel',
      sha: 'a8cb3d0eae1f1a064896493f4cf63dafc17bafcf',
    },
    {
      message: 'fix: Previous release commit',
      sha: '0869c0d9638268ffbd1e03974ab0cdd07070c010',
    },
  ];

  const res = await CreateReleaseTag(
    generateContext('feature/add-tittle'),
    'token',
    'main',
    baseVer,
  );

  expect(res.createdReleaseTag).toBeNull();
  expect(res.previousReleaseTag.toString()).toBe('v3.5.9');
  expect(res.getBaseVersionOverride()).toBe('v3.5.9');
  expect(res.isPrerelease()).toBeTruthy();
  expect(createTagMock.mock.calls.length).toBe(0);
});
