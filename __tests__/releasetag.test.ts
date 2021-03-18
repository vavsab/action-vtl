import {ReleaseTagVersion as Ver} from '../src/releasetag/releasetagversion';

test('increment version', async () => {
  const ver = new Ver(3, 9, 1);

  ver.incrementPatch();
  expect(ver.toString()).toEqual('v3.9.2');

  ver.incrementMinor();
  expect(ver.toString()).toEqual('v3.10.0');

  ver.incrementMajor();
  expect(ver.toString()).toEqual('v4.0.0');
});

test('parse version', async () => {
  const ver = Ver.parse('v3.8.4');
  if (ver == null) {
    throw 'ver is null';
  }

  expect(ver.getMajor()).toEqual(3);
  expect(ver.getMinor()).toEqual(8);
  expect(ver.getPatch()).toEqual(4);

  const verNoPrefix = Ver.parse('3.8.4');
  if (verNoPrefix == null) {
    throw 'verNoPrefix is null';
  }

  expect(verNoPrefix.getMajor()).toEqual(3);
  expect(verNoPrefix.getMinor()).toEqual(8);
  expect(verNoPrefix.getPatch()).toEqual(4);

  expect(Ver.parse(null)).toBeNull();
  expect(Ver.parse('1.2.a')).toBeNull();
  expect(Ver.parse('invalid')).toBeNull();
});

test('compare versions', async () => {
  expect(Ver.parse('v3.8.4')?.isGreaterOrEqualTo(Ver.parse('v4.0.0')!)).toBeFalsy();
  expect(Ver.parse('v3.8.4')?.isGreaterOrEqualTo(Ver.parse('v3.9.0')!)).toBeFalsy();
  expect(Ver.parse('v3.8.4')?.isGreaterOrEqualTo(Ver.parse('v3.8.5')!)).toBeFalsy();

  expect(Ver.parse('v3.8.4')?.isGreaterOrEqualTo(Ver.parse('v3.8.4')!)).toBeTruthy();

  expect(Ver.parse('v3.8.5')?.isGreaterOrEqualTo(Ver.parse('v3.8.4')!)).toBeTruthy();
  expect(Ver.parse('v3.9.4')?.isGreaterOrEqualTo(Ver.parse('v3.8.99')!)).toBeTruthy();
  expect(Ver.parse('v4.8.4')?.isGreaterOrEqualTo(Ver.parse('v3.99.99')!)).toBeTruthy();
});
