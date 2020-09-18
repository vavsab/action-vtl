<p align="center">
  <a href="https://github.com/mapped/action-semver/actions"><img alt="action-semver status" src="https://github.com/mapped/action-semver/workflows/build-test/badge.svg"></a>
</p>

# GitHub Action for Consistent SEMVERs

## Usage:
```yml
  - uses: mapped/action-semver@v0.1.0
    with:
      baseVersion: '1.2.3'
```

### Options
 - **baseVersion** - The base version of this repo. This value must be manually updated when the base version is incremented.
 - **branchMappings** - Used for mapping untagged branches to tag names. Mappings are one per line, each as `branch:target_name`.
   - Optional, default = `main:latest`
 - **prereleasePrefix** - The <pre-release> prefix on an untagged SEMVER.
   - Optional, default = `prerelease`
 - **versionFile** - The filename where the full SEMVER and commit SHA should be written.
   - Optional, default `VERSION`

## Capabilities
This GitHub Action creates consistent SEMVER and tag environment variables with a few simple rules:
 1. If the Action was triggered by the creation of a tag, the tag's SEMVER is used
 2. If the Action was triggered by a push, the SEMVER passed to this action is augmented with a pre-release and build number, and the tag is either the branch name or a mapped value _(for example `main` can be mapped to `latest`)
 3. If the Action was triggered by a PR, the SEMVER passed to this action is augmented with a pre-release and build number, and the tag is set to `merge`

## 1. Release Tag Created
With the following input:
  - Action run# 23
  - Action YML:
    ```yml
      - uses: mapped/action-semver
        with:
          baseVersion: '1.2.3'
          branchMappings: |
            main:latest
          prereleasePrefix: 'prerelease'
          versionFile: 'VERSION'
    ```
  - Last commit in the tag: `a8cb3d0eae1f1a064896493f4cf63dafc17bafcf`
  - `v3.4.5-alpha.1` **release tag is created**

This action will produce the following environment variables:
```bash
VERSION_TAG=v3.4.5-alpha.1
SEMVER=3.4.5-alpha.1+20200918T041126920Z.a8cb3d0e
SEMVER_MAJOR=3
SEMVER_MINOR=4
SEMVER_PATCH=5
SEMVER_PRERELEASE=alpha.1
SEMVER_BUILD=20200918T041126920Z.a8cb3d0e
```

and create a `VERSION` file with the contents:
```
3.4.5-alpha.1+20200918T041126920Z.a8cb3d0e
```

_Note that the `20200918T041126920Z` portions are UTC datetime strings representing the time the action was run._

## 2a. Push to a Mapped Branch
With the following input:
  - Action run# 23
  - Action YML:
    ```yml
      - uses: mapped/action-semver
        with:
          baseVersion: '1.2.3'
          branchMappings: |
            main:latest
          prereleasePrefix: 'prerelease'
          versionFile: 'VERSION'
    ```
  - **Push to `main` branch** with a commit hash of `a8cb3d0eae1f1a064896493f4cf63dafc17bafcf`

This action will produce the following environment variables:
```bash
VERSION_TAG=latest
SEMVER=1.2.3-prerelease.23+20200918T041126920Z.a8cb3d0e
SEMVER_MAJOR=1
SEMVER_MINOR=2
SEMVER_PATCH=3
SEMVER_PRERELEASE=prerelease.23
SEMVER_BUILD=20200918T041126920Z.a8cb3d0e
```

and create a `VERSION` file with the contents:
```
1.2.3-prerelease.23+20200918T041126920Z.a8cb3d0e
```

## 2b. Push to an Unmapped Branch
With the following input:
  - Action run# 23
  - Action YML:
    ```yml
      - uses: mapped/action-semver
        with:
          baseVersion: '1.2.3'
          branchMappings: |
            main:latest
          prereleasePrefix: 'prerelease'
          versionFile: 'VERSION'
    ```
  - **Push to `my-feature-work` branch** with a commit hash of `a8cb3d0eae1f1a064896493f4cf63dafc17bafcf`

This action will produce the following environment variables:
```bash
VERSION_TAG=my-feature-work
SEMVER=1.2.3-prerelease.23+20200918T041126920Z.a8cb3d0e
SEMVER_MAJOR=1
SEMVER_MINOR=2
SEMVER_PATCH=3
SEMVER_PRERELEASE=prerelease.23
SEMVER_BUILD=20200918T041126920Z.a8cb3d0e
```

and create a `VERSION` file with the contents:
```
1.2.3-prerelease.23+20200918T041126920Z.a8cb3d0e
```

## 3. Pull Request
With the following input:
  - Action run# 23
  - Action YML:
    ```yml
      - uses: mapped/action-semver
        with:
          baseVersion: '1.2.3'
          branchMappings: |
            main:latest
          prereleasePrefix: 'prerelease'
          versionFile: 'VERSION'
    ```
  - **Pull Request** with a head commit hash of `a8cb3d0eae1f1a064896493f4cf63dafc17bafcf`

This action will produce the following environment variables:
```yml
VERSION_TAG=merge
SEMVER=1.2.3-prerelease.23+20200918T041126920Z.a8cb3d0e
SEMVER_MAJOR=1
SEMVER_MINOR=2
SEMVER_PATCH=3
SEMVER_PRERELEASE=prerelease.23
SEMVER_BUILD=20200918T041126920Z.a8cb3d0e
```

and create a `VERSION` file with the contents:
```
1.2.3-prerelease.23+20200918T041126920Z.a8cb3d0e
```

## Building / Testing / Contributing

Install the dependencies  
```bash
$ npm install
```

Build the typescript and package it for distribution
```bash
$ npm run build && npm run package
```

Run the tests :heavy_check_mark:  
```bash
$ npm test

 PASS  __tests__/main.test.ts
  √ invalid semver (19ms)
  √ no ref
  √ push on mapped branch (1ms)
  √ push on unmapped branch (1ms)
  √ tag 1
  √ tag 2
  √ pr (1ms)

Test Suites: 1 passed, 1 total
Snapshots:   0 total
Time:        2.439s, estimated 3s
Ran all test suites.
...
```

