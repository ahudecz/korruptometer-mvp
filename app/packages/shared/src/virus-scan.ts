/**
 * Cloudmersive virus-scan client (T067). Retries up to 5 times with
 * exponential backoff. Returns a structured shape the Inngest intake step
 * branches on; see `docs/virus-scan.md` for the runbook.
 */

import { headObject, createSignedDownloadUrl } from './storage';

export type ScanStatus = 'clean' | 'infected' | 'pending' | 'error';
export type ScanResult = { status: ScanStatus; detail?: string };

const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 1000;

const ENDPOINT = 'https://api.cloudmersive.com/virus/scan/file';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function scanObject(args: {
  bucket: string;
  key: string;
}): Promise<ScanResult> {
  const apiKey = process.env.CLOUDMERSIVE_API_KEY;
  if (!apiKey) {
    // Without a key we treat the result as `pending` rather than `clean` so
    // the intake step never marks an unscanned file as safe.
    return { status: 'pending', detail: 'CLOUDMERSIVE_API_KEY not configured' };
  }
  // The HEAD verifies the object exists; if it's gone the scan is moot.
  const head = await headObject(args);
  if (!head) return { status: 'error', detail: 'object missing' };

  const downloadUrl = await createSignedDownloadUrl({ ...args, ttlSeconds: 60 });

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          Apikey: apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: downloadUrl }),
      });
      if (res.ok) {
        const body = (await res.json()) as {
          CleanResult: boolean;
          FoundViruses?: { VirusName: string }[];
        };
        if (body.CleanResult) return { status: 'clean' };
        const names = (body.FoundViruses ?? []).map((v) => v.VirusName).join(',');
        return { status: 'infected', detail: names || 'unknown signature' };
      }
      if (res.status >= 500 || res.status === 429) {
        // retry with backoff
      } else {
        return { status: 'error', detail: `vendor ${res.status}` };
      }
    } catch (err) {
      // network error — retry with backoff
      if (attempt === MAX_ATTEMPTS - 1) {
        return {
          status: 'error',
          detail: err instanceof Error ? err.message : 'unknown',
        };
      }
    }
    await sleep(BASE_DELAY_MS * 2 ** attempt);
  }
  return { status: 'error', detail: 'exhausted retries' };
}
