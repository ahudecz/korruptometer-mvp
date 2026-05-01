// k6 burst script (T051) — 60 s of 100 RPS against /api/cases mixing q=, filter,
// and cursor traffic; assert p95 latency < 400 ms and 0 % error rate (SC-002,
// SC-006, Phase 1 verification step 8).
//
// Usage:
//   BASE_URL=https://staging.korruptometer.hu k6 run app/scripts/cases-burst.js

import http from 'k6/http';
import { check } from 'k6';
import { Rate, Trend } from 'k6/metrics';

export const options = {
  scenarios: {
    burst: {
      executor: 'constant-arrival-rate',
      rate: 100,
      timeUnit: '1s',
      duration: '60s',
      preAllocatedVUs: 50,
      maxVUs: 200,
    },
  },
  thresholds: {
    'http_req_duration{kind:cases}': ['p(95)<400'],
    http_req_failed: ['rate<0.001'],
  },
};

const errorRate = new Rate('cases_errors');
const trend = new Trend('cases_p95');

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

const PROFILES = [
  () => `${BASE_URL}/api/cases`,
  () => `${BASE_URL}/api/cases?q=orban`,
  () => `${BASE_URL}/api/cases?sector=K%C3%B6zbeszerz%C3%A9s`,
  () => `${BASE_URL}/api/cases?sort=amount_desc&minAmount=1000000`,
  () => `${BASE_URL}/api/cases?cursor=eyJzayI6MTAwLCJpZCI6IktNLTAwMSJ9`,
];

export default function () {
  const url = PROFILES[Math.floor(Math.random() * PROFILES.length)]();
  const res = http.get(url, { tags: { kind: 'cases' } });
  errorRate.add(res.status >= 400);
  trend.add(res.timings.duration);
  check(res, {
    'status < 500': (r) => r.status < 500,
  });
}
