import { serve } from 'inngest/next';

import { functions, inngest } from '@/inngest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
});
