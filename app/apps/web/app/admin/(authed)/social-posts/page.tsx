import { desc } from 'drizzle-orm';

import { requireAdmin } from '@/lib/admin/auth';
import { getDb, schema } from '@/lib/db';

import { HiddenToggle } from './hidden-toggle';

export const revalidate = 0;

const HU_MONTHS = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.'];

function fmtDate(d: Date): string {
  return `${d.getFullYear()}. ${HU_MONTHS[d.getMonth()]} ${d.getDate()}.`;
}

export default async function AdminSocialPostsPage() {
  await requireAdmin();
  const db = getDb();

  const posts = await db
    .select({
      id: schema.socialPosts.id,
      authorName: schema.socialPosts.authorName,
      content: schema.socialPosts.content,
      postUrl: schema.socialPosts.postUrl,
      platform: schema.socialPosts.platform,
      createdAt: schema.socialPosts.createdAt,
      hidden: schema.socialPosts.hidden,
    })
    .from(schema.socialPosts)
    .orderBy(desc(schema.socialPosts.createdAt))
    .limit(100);

  const hiddenCount = posts.filter((p) => p.hidden).length;

  return (
    <section className="section">
      <h2 style={{ marginBottom: 4 }}>Social posztok</h2>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 24 }}>
        Legutóbbi 100 poszt · <strong>{hiddenCount}</strong> rejtett
      </p>

      <table className="admin-table" style={{ width: '100%' }}>
        <thead>
          <tr>
            <th>Szerző</th>
            <th>Tartalom</th>
            <th>Dátum</th>
            <th>Elrejtés</th>
          </tr>
        </thead>
        <tbody>
          {posts.map((p) => (
            <tr key={p.id} style={{ background: p.hidden ? '#f5f5f5' : undefined }}>
              <td style={{ fontSize: 13, whiteSpace: 'nowrap', color: p.hidden ? 'var(--muted)' : undefined }}>
                {p.authorName}
              </td>
              <td style={{ fontSize: 13, maxWidth: 400 }}>
                <a
                  href={p.postUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: p.hidden ? 'var(--muted)' : 'var(--ink)' }}
                >
                  {p.content.length > 120 ? p.content.slice(0, 120) + '…' : p.content}
                </a>
              </td>
              <td style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                {fmtDate(new Date(p.createdAt))}
              </td>
              <td>
                <HiddenToggle id={p.id} hidden={p.hidden} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
