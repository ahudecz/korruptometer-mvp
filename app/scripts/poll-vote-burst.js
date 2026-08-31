// k6 roham-szkript (T030, US4) — 10 000 gyors, egymást követő POST /api/poll/vote
// hívás, Turnstile-token NÉLKÜL, azonos forrás-IP-ről (maga a k6-futtatás gépe).
// Elvárt eredmény: 0 db sikeres (201) szavazat kerül be — a honeypot üres,
// nincs "már szavaztál" cookie a legtöbb hívásnál, de a Turnstile-ellenőrzésen
// és/vagy az IP-alapú napi küszöbön (alapértelmezés 75/nap) mindegyik elakad,
// jóval a 10 000. kérés előtt. Lásd contracts/poll-api.md.
//
// Usage:
//   BASE_URL=http://localhost:3000 k6 run app/scripts/poll-vote-burst.js

import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';

export const options = {
  scenarios: {
    roham: {
      executor: 'shared-iterations',
      vus: 100,
      iterations: 10000,
      maxDuration: '120s',
    },
  },
  thresholds: {
    // A lényeg: SOHA ne legyen sikeres (201) beküldés Turnstile-token nélkül.
    poll_vote_success: ['count==0'],
  },
};

const successCount = new Counter('poll_vote_success');

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const QUESTION_SLUG = __ENV.POLL_SLUG || 'nvvh-elso-5-ugye';
// Bármilyen 2 opció-id megteszi a szimulációhoz — a valós id-k nélkül is a
// validáció korábbi lépésén (Turnstile/rate-limit) elakad a kérés.
const FAKE_OPTION_IDS = ['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002'];

export default function () {
  const res = http.post(
    `${BASE_URL}/api/poll/vote`,
    JSON.stringify({
      questionSlug: QUESTION_SLUG,
      optionIds: FAKE_OPTION_IDS,
      turnstileToken: '', // szándékosan nincs valódi token
      honeypot: '',
    }),
    { headers: { 'Content-Type': 'application/json' }, tags: { kind: 'poll-vote-burst' } },
  );

  if (res.status === 201) successCount.add(1);

  check(res, {
    'never 201 without a real Turnstile token': (r) => r.status !== 201,
    'never a server error (5xx)': (r) => r.status < 500,
  });
}
