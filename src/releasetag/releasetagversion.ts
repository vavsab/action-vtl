export class ReleaseTagVersion {
  private static regexp = /v?(\d+).(\d+).(\d+)/;

  constructor(private major: number, private minor: number, private patch: number) {}

  getMajor(): number {
    return this.major;
  }

  getMinor(): number {
    return this.minor;
  }

  getPatch(): number {
    return this.patch;
  }

  toString(): string {
    return `v${this.major}.${this.minor}.${this.patch}`;
  }

  isGreaterOrEqualTo(ver: ReleaseTagVersion): boolean {
    if (this.major !== ver.major) {
      return this.major > ver.major;
    }

    if (this.minor !== ver.minor) {
      return this.minor > ver.minor;
    }

    if (this.patch !== ver.patch) {
      return this.patch > ver.patch;
    }

    return true;
  }

  incrementMajor(): void {
    this.major++;
    this.minor = 0;
    this.patch = 0;
  }

  incrementMinor(): void {
    this.minor++;
    this.patch = 0;
  }

  incrementPatch(): void {
    this.patch++;
  }

  static parse(val: string | undefined | null): ReleaseTagVersion | null {
    if (val === undefined || val === null) {
      return null;
    }

    const res = ReleaseTagVersion.regexp.exec(val);
    if (res === null) {
      return null;
    }

    return new ReleaseTagVersion(parseInt(res[1]), parseInt(res[2]), parseInt(res[3]));
  }
}
