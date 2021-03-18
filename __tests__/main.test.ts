import {SemVer, compareSemvers} from '../src/version';
import {GetDockerInfo} from '../src/docker';
import {Context} from '@actions/github/lib/context';

// Some generic good values
const goodBaseVer = [
  '1.2.3',
  '0.1.0-alpha',
  '5.4.3-beta.7',
  '9.6.1-something.bla.bla+something.else-here',
];
const goodMappings: Map<string, string> = new Map([['main', 'edge']]);
const goodPrefix = ['prerelease', '', 'beta'];
const goodRunNo = [23, 17];
const goodSha = 'a8cb3d0eae1f1a064896493f4cf63dafc17bafcf';
const goodRefAndEvent = [
  {event: 'push', ref: 'refs/heads/main'},
  {event: 'pull_request', ref: 'refs/pull/37/merge'},
  {event: 'push', ref: 'refs/heads/my-working-branch'},
  {event: 'push', ref: 'refs/heads/my/branch'},
  {event: 'push', ref: 'refs/heads/dev'},
  {event: 'push tag', ref: 'refs/tags/v1.3.5'},
  {event: 'push tag', ref: 'refs/tags/v2.4.6-beta.2'},
  {event: 'schedule', ref: ''},
];

const goodSha8 = goodSha.substring(0, 8);

function generateContext(runNoIdx: number, refIdx: number): Context {
  let ctx: Context = {
    action: 'mapped/action-vtl',
    eventName: goodRefAndEvent[refIdx].event,
    sha: goodSha,
    ref: goodRefAndEvent[refIdx].ref,
    workflow: 'build-test',
    actor: 'somedeveloper',
    job: 'somejob',
    runNumber: goodRunNo[runNoIdx],
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

test('invalid semver', async () => {
  const inputs = ['1a.2.3', '1.2.3.4'];
  for (const input of inputs) {
    const expected = `base-version of "${input}" is not a valid SEMVER`;
    await expect(
      SemVer(input, true, goodMappings, goodPrefix[0], generateContext(0, 0)),
    ).rejects.toThrow(expected);
  }
});

test('bad tag semver', async () => {
  const inputs = [
    'refs/tags/1.3.5v',
    'refs/tags/a1.3.5',
    'refs/tags/V1.3.5.7',
    'refs/tags/v2.4a.6',
  ];
  for (const input of inputs) {
    let ctx = generateContext(0, 5);
    ctx.ref = input;
    const expected = `Tag of "${input.split('/').pop()}" is not a valid SEMVER`;
    await expect(SemVer(goodBaseVer[0], true, goodMappings, goodPrefix[0], ctx)).rejects.toThrow(
      expected,
    );
  }
});

test('push on mapped branch', async () => {
  let expSemVerNoMeta = goodBaseVer[0] + '-' + goodPrefix[0] + '.' + goodRunNo[0];
  await expect(
    SemVer(goodBaseVer[0], true, goodMappings, goodPrefix[0], generateContext(0, 0)),
  ).resolves.toMatchObject({
    major: 1,
    minor: 2,
    patch: 3,
    preRelease: goodPrefix[0] + '.' + goodRunNo[0],
    metadata: expect.stringContaining(goodSha8),
    buildNumber: goodRunNo[0].toString(),
    tag: 'edge',
    semVer: expect.stringMatching(new RegExp(expSemVerNoMeta + '\\+.*\\.sha-' + goodSha8)),
    semVerNoMeta: expSemVerNoMeta,
  });
});

test('push on unmapped branch', async () => {
  let expSemVerNoMeta = '9.6.1-' + goodRunNo[1];
  await expect(
    SemVer(goodBaseVer[3], true, goodMappings, goodPrefix[1], generateContext(1, 2)),
  ).resolves.toMatchObject({
    major: 9,
    minor: 6,
    patch: 1,
    preRelease: '' + goodRunNo[1],
    metadata: expect.stringContaining(goodSha8),
    buildNumber: goodRunNo[1].toString(),
    tag: goodRefAndEvent[2].ref.split('/').pop(),
    semVer: expect.stringMatching(new RegExp(expSemVerNoMeta + '\\+.*\\.sha-' + goodSha8)),
    semVerNoMeta: expSemVerNoMeta,
  });
});

test('tag 1', async () => {
  let expSemVerNoMeta = '1.3.5';
  await expect(
    SemVer(goodBaseVer[0], true, goodMappings, goodPrefix[1], generateContext(0, 5)),
  ).resolves.toMatchObject({
    major: 1,
    minor: 3,
    patch: 5,
    preRelease: '',
    metadata: expect.stringContaining(goodSha8),
    buildNumber: goodRunNo[0].toString(),
    tag: goodRefAndEvent[5].ref.split('/').pop(),
    semVer: expect.stringMatching(new RegExp(expSemVerNoMeta + '\\+.*\\.sha-' + goodSha8)),
    semVerNoMeta: expSemVerNoMeta,
  });
});

test('tag 2', async () => {
  let expSemVerNoMeta = '2.4.6-beta.2';
  await expect(
    SemVer(goodBaseVer[2], true, goodMappings, goodPrefix[0], generateContext(1, 6)),
  ).resolves.toMatchObject({
    major: 2,
    minor: 4,
    patch: 6,
    preRelease: 'beta.2',
    metadata: expect.stringContaining(goodSha8),
    buildNumber: goodRunNo[1].toString(),
    tag: goodRefAndEvent[6].ref.split('/').pop(),
    semVer: expect.stringMatching(new RegExp(expSemVerNoMeta + '\\+.*\\.sha-' + goodSha8)),
    semVerNoMeta: expSemVerNoMeta,
  });
});

test('pr', async () => {
  let expSemVerNoMeta = '0.1.0-' + goodPrefix[2] + '.' + goodRunNo[1];
  await expect(
    SemVer(goodBaseVer[1], true, goodMappings, goodPrefix[2], generateContext(1, 1)),
  ).resolves.toMatchObject({
    major: 0,
    minor: 1,
    patch: 0,
    preRelease: goodPrefix[2] + '.' + goodRunNo[1],
    metadata: expect.stringContaining(goodSha8),
    buildNumber: goodRunNo[1].toString(),
    tag: 'pr-37',
    semVer: expect.stringMatching(new RegExp(expSemVerNoMeta + '\\+.*\\.sha-' + goodSha8)),
    semVerNoMeta: expSemVerNoMeta,
  });
});

test('compareSemvers basic', async () => {
  expect(compareSemvers('0.0.1', '0.0.1')).toEqual(0);
  expect(compareSemvers('v0.1.0', 'v0.1.0')).toEqual(0);
  expect(compareSemvers('v0.1.0', 'v0.1.1')).toEqual(-1);
  expect(compareSemvers('0.1.0', '0.1.0')).toEqual(0);
  expect(compareSemvers('0.1.0', '0.1.1')).toEqual(-1);
  expect(compareSemvers('0.1.1', '0.2.0')).toEqual(-1);
  expect(compareSemvers('2.0.0', '2.0.0')).toEqual(0);
  expect(compareSemvers('1.0.0', '0.2.0')).toEqual(1);
  expect(compareSemvers('1.0.0', '2.2.2')).toEqual(-1);
  expect(compareSemvers('v3.1.1', 'v2.2.2')).toEqual(1);
  expect(compareSemvers('v3.1.1', '3.1.1')).toEqual(0);
});

test('compareSemvers with pre-release specifiers', async () => {
  expect(compareSemvers('v1.0.0-alpha.1', 'v1.0.0-alpha.1')).toEqual(0);
  expect(compareSemvers('v1.0.0-alpha', 'v1.0.0-alpha.1')).toEqual(-1);
  expect(compareSemvers('1.0.0-alpha', '1.0.0-alpha')).toEqual(0);
  expect(compareSemvers('1.0.0-alpha', '1.0.0-alpha.1')).toEqual(-1);
  expect(compareSemvers('1.0.0-alpha.1', '1.0.0-alpha.beta')).toEqual(-1);
  expect(compareSemvers('1.0.0-beta', '1.0.0-beta.2')).toEqual(-1);
  expect(compareSemvers('1.0.0-beta.2', '1.0.0-beta.11')).toEqual(-1);
  expect(compareSemvers('1.0.0-beta.2.3', '1.0.0-beta.2')).toEqual(1);
  expect(compareSemvers('1.0.0-beta.2', '1.0.0-beta.2.3')).toEqual(-1);
  expect(compareSemvers('1.0.0-beta.11', '1.0.0-rc.1')).toEqual(-1);
  expect(compareSemvers('1.0.0-rc.1', '1.0.0-alpha')).toEqual(1);
  expect(compareSemvers('v1.0.0-rc.1', 'v1.0.0-alpha')).toEqual(1);
  expect(compareSemvers('v1.0.0-rc.1', '1.0.0-rc.1')).toEqual(0);
});

test('compareSemvers with metadata', async () => {
  expect(compareSemvers('v0.1.0+some-meta-data', 'v0.1.1+some-other-data')).toEqual(-1);
  expect(compareSemvers('v0.2.0+some-meta-data', 'v0.1.0+some-other-data')).toEqual(1);
  expect(compareSemvers('v1.2.3+some-meta-data', 'v1.2.3+some-other-data')).toEqual(0);
});

test('compareSemvers with pre-release and metadata', async () => {
  expect(compareSemvers('1.0.0-alpha+some-meta-data', '1.0.0-alpha+some-other-data')).toEqual(0);
  expect(compareSemvers('1.0.0-alpha+some-meta-data', '1.0.0-alpha.1+some-other-data')).toEqual(-1);
  expect(
    compareSemvers('1.0.0-alpha.1+some-meta-data', '1.0.0-alpha.beta+some-other-data'),
  ).toEqual(-1);
  expect(compareSemvers('1.0.0-alpha.1.2+some-meta-data', '1.0.0-alpha.1+some-other-data')).toEqual(
    1,
  );
});

test('docker info - push', async () => {
  let ctx = generateContext(1, 0);
  let verInfo = await SemVer(goodBaseVer[1], true, goodMappings, goodPrefix[2], ctx);
  await expect(GetDockerInfo('test/container', verInfo, ctx, '')).resolves.toMatchObject({
    tags: ['test/container:edge', 'test/container:sha-' + goodSha8].join(','),
    push: 'true',
  });
});

test('docker info - tag', async () => {
  let ctx = generateContext(1, 5);
  let verInfo = await SemVer(goodBaseVer[1], true, goodMappings, goodPrefix[2], ctx);
  await expect(GetDockerInfo('test/container', verInfo, ctx, '')).resolves.toMatchObject({
    tags: ['test/container:1.3.5', 'test/container:1', 'test/container:1.3'].join(','),
    push: 'true',
  });
});

test('docker info - pr', async () => {
  let ctx = generateContext(1, 1);
  let verInfo = await SemVer(goodBaseVer[1], true, goodMappings, goodPrefix[2], ctx);
  await expect(GetDockerInfo('test/container', verInfo, ctx, '')).resolves.toMatchObject({
    tags: 'test/container:pr-37',
    push: 'false',
  });
});

// Try to call the action how GitHub would
/*
test('test runs', () => {
  process.env['INPUT_BASEVERSION'] = '1.2.3'
  const ip = path.join(__dirname, '..', 'lib', 'main.js')
  const options: cp.ExecSyncOptions = {
    env: process.env
  }
  console.log(cp.execSync(`node ${ip}`, options).toString())
})
*/
