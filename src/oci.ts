import {Context} from '@actions/github/lib/context';
import {EventPayloads} from '@octokit/webhooks';
import {Version} from './version';

// Payload types we use
// TODO: Schedule?
export type KnownPayload =
  | EventPayloads.WebhookPayloadPush
  | EventPayloads.WebhookPayloadPullRequest;

interface License {
  key: string;
  name: string;
  spdx_id: string;
  url: string;
  node_id: string;
}

export interface OCI {
  title: string;
  description: string;
  url: string;
  source: string;
  version: string;
  created: string;
  revision: string;
  licenses: string;
  labels: string;
}

export async function GetOCI(version: Version, context: Context): Promise<OCI> {
  const payload = context.payload as KnownPayload;

  // Get the correct SPDX license ID
  let spdxId = '';
  if (payload.repository && payload.repository.license) {
    const license = (payload.repository.license as unknown) as License;
    if (license != null) {
      spdxId = license.spdx_id;
    } else {
      spdxId = 'UNLICENSED';
    }
  }

  // Map the version and context to OCI properties
  const oci: OCI = {
    title: payload.repository.name,
    description: payload.repository.description ?? '',
    url: payload.repository.html_url,
    source: payload.repository.clone_url,
    version: version.semVer,
    created: version.created,
    revision: context.sha,
    licenses: spdxId,
    labels: '',
  };

  // Add the OCI labels, per: https://github.com/opencontainers/image-spec/blob/master/annotations.md
  const labels = new Array<string>();
  labels.push(`org.opencontainers.image.title=${payload.repository.name}`);
  labels.push(`org.opencontainers.image.description=${payload.repository.description ?? ''}`);
  labels.push(`org.opencontainers.image.url=${payload.repository.html_url}`);
  labels.push(`org.opencontainers.image.source=${payload.repository.clone_url}`);
  labels.push(`org.opencontainers.image.version=${version.semVer}`);
  labels.push(`org.opencontainers.image.created=${version.created}`);
  labels.push(`org.opencontainers.image.revision=${context.sha}`);
  labels.push(`org.opencontainers.image.licenses=${spdxId}`);

  // Put the labels together, dropping any that don't have values
  oci.labels = labels
    .filter(label => {
      const parts = label.split('=');
      if (parts.length < 2 || parts[1].trim().length === 0) {
        return false;
      }

      return true;
    })
    .join('\n');

  return oci;
}
