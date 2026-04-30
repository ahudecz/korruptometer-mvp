import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });

import { seedScraperRuns } from './scrapers';

seedScraperRuns().catch((err) => {
  console.error(err);
  process.exit(1);
});
