import {GitHubClient} from '../src/releasetag/githubclient';
import {CreateReleaseTag} from '../src/releasetag/createreleasetag';
import {Context} from '@actions/github/lib/context';

function generateContext(): Context {
  let ctx: Context = {
    action: 'mapped/action-vtl',
    eventName: 'push',
    sha: 'a8cb3d0eae1f1a064896493f4cf63dafc17bafcf',
    ref: 'refs/heads/main',
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

jest.mock('../src/releasetag/githubclient', () => {
  return function () {
    return {
      getTags: () => {
        throw new Error('Test error');
      },
      getCommits: () => {
        throw new Error('Test error');
      },
      createTag: () => {
        throw new Error('Test error');
      },
    };
  };
});

test('create first release', async () => {
  const createReleaseTagRes = await CreateReleaseTag(
    generateContext(),
    'test_token',
    'main',
    '2.3.5',
  );
});
