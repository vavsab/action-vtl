import { SemVer } from '../src/semver'
import * as process from 'process'
import * as cp from 'child_process'
import * as path from 'path'

// Some generic good values
const goodBaseVer = ["1.2.3", "0.1.0-alpha", "5.4.3-beta.7", "9.6.1-something.bla.bla+something.else-here"];
const goodMappings: Map<string, string> = new Map([["main", "latest"]]);
const goodPrefix = ["prerelease", "", "beta"];
const goodRunNo = ["23", "17"]
const goodSha = "a8cb3d0eae1f1a064896493f4cf63dafc17bafcf";
const goodRef = ["refs/heads/main", "refs/pull/37/merge", "refs/heads/my-working-branch"];
const goodTaggedRef = ["refs/tags/v1.3.5", "refs/tags/v2.4.6-beta.2"];

const goodSha8 = goodSha.substring(0, 8);


test('invalid semver', async () => {
  const inputs = ["1a.2.3", "1.2.3.4"]
  for(const input of inputs) {
    const expected = `base-version of "${input}" is not a valid SEMVER`;
    await expect(SemVer(input, goodMappings, goodPrefix[0], goodRunNo[0], goodSha, goodRef[0])).rejects.toThrow(expected)
  }
})

test('no ref', async () => {
  const inputs = [""]
  for(const input of inputs) {
    const expected = `GITHUB_REF is not set`;
    await expect(SemVer(goodBaseVer[0], goodMappings, goodPrefix[0], goodRunNo[0], goodSha, input)).rejects.toThrow(expected)
  }
})

test('bad tag semver', async () => {
  const inputs = ["refs/tags/1.3.5v", "refs/tags/a1.3.5", "refs/tags/V1.3.5.7", "refs/tags/v2.4a.6"];
  for(const input of inputs) {
    const expected = `Tag of "${input.split('/').pop()}" is not a valid SEMVER`;
    await expect(SemVer(goodBaseVer[0], goodMappings, goodPrefix[0], goodRunNo[0], goodSha, input)).rejects.toThrow(expected)
  }
})

test('push on mapped branch', async () => {
  await expect(SemVer(goodBaseVer[0], goodMappings, goodPrefix[0], goodRunNo[0], goodSha, goodRef[0])).resolves.toMatchObject({
    major: 1,
    minor: 2,
    patch: 3,
    preRelease: goodPrefix[0] + "." + goodRunNo[0],
    build: expect.stringContaining(goodSha8),
    tag: "latest",
    semVer: expect.stringMatching(new RegExp(goodBaseVer[0] + "-" + goodPrefix[0] + "." + goodRunNo[0] + "\+.*\." + goodSha8))
  });
})

test('push on unmapped branch', async () => {
  await expect(SemVer(goodBaseVer[3], goodMappings, goodPrefix[1], goodRunNo[1], goodSha, goodRef[2])).resolves.toMatchObject({
    major: 9,
    minor: 6,
    patch: 1,
    preRelease: goodRunNo[1],
    build: expect.stringContaining(goodSha8),
    tag: goodRef[2].split('/').pop(),
    semVer: expect.stringMatching(new RegExp("9.6.1-" + goodRunNo[1] + "\+.*\." + goodSha8))
  });
})

test('tag 1', async () => {
  await expect(SemVer(goodBaseVer[0], goodMappings, goodPrefix[1], goodRunNo[0], goodSha, goodTaggedRef[0])).resolves.toMatchObject({
    major: 1,
    minor: 3,
    patch: 5,
    preRelease: "",
    build: expect.stringContaining(goodSha8),
    tag: goodTaggedRef[0].split('/').pop(),
    semVer: expect.stringMatching(new RegExp("1.3.5\+.*\." + goodSha8))
  });
})

test('tag 2', async () => {
  await expect(SemVer(goodBaseVer[2], goodMappings, goodPrefix[0], goodRunNo[1], goodSha, goodTaggedRef[1])).resolves.toMatchObject({
    major: 2,
    minor: 4,
    patch: 6,
    preRelease: "beta.2",
    build: expect.stringContaining(goodSha8),
    tag: goodTaggedRef[1].split('/').pop(),
    semVer: expect.stringMatching(new RegExp("2.4.6-beta.2\+.*\." + goodSha8))
  });
})

test('pr', async () => {
  await expect(SemVer(goodBaseVer[1], goodMappings, goodPrefix[2], goodRunNo[1], goodSha, goodRef[1])).resolves.toMatchObject({
    major: 0,
    minor: 1,
    patch: 0,
    preRelease: goodPrefix[2] + "." + goodRunNo[1],
    build: expect.stringContaining(goodSha8),
    tag: "merge",
    semVer: expect.stringMatching(new RegExp("0.1.0-" + goodPrefix[2] + "." + goodRunNo[1] + "\+.*\." + goodSha8))
  });
})


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