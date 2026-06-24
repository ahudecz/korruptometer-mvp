import 'dotenv/config';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL nincs beállítva');

async function main() {
  const sql = postgres(url!);

  await sql`
    create table if not exists "SocialPost" (
      id uuid primary key default gen_random_uuid(),
      "authorName"  text not null,
      "authorHandle" text,
      platform      text not null default 'facebook',
      "postUrl"     text not null,
      content       text not null,
      "postedAt"    timestamptz,
      "createdAt"   timestamptz not null default now()
    )
  `;

  await sql`
    create index if not exists "SocialPost_postedAt_idx" on "SocialPost" ("postedAt" desc)
  `;

  console.log('SocialPost tábla sikeresen létrehozva!');
  await sql.end();
}

main();
