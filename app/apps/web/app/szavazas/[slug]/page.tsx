import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';

import { getDb } from '@/lib/db';
import { getOwnSelections, getPollWithResults, voteExists } from '@/lib/poll-queries';
import { PollQuestion } from '../_components/poll-question';
import { VoteFormClient } from '../_components/vote-form-client';

export const dynamic = 'force-dynamic';

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { slug } = await params;
  const poll = await getPollWithResults(getDb(), slug);
  if (!poll) return {};
  const title = `Szavazás — ${poll.question.questionText}`;
  const description = `${poll.question.questionText} Szavazz te is a Kegyencjárat közösségi szavazásán!`;
  return {
    // A gyökér layout.tsx title-template-je ('%s — Kegyencjárat') simán rá-
    // fűződne erre is — { absolute } kikapcsolja, mint a többi aloldalnál
    // (hirek, podcastok stb.).
    title: { absolute: title },
    description,
    // FONTOS: az openGraph/twitter mezők NEM öröklődnek automatikusan a
    // sima title/description-ből — a gyökér layout.tsx saját, generikus
    // openGraph.title/description-jét használnák megosztáskor (Viber,
    // Messenger stb. előnézet-kártyája), ha itt külön nem adjuk meg. Az
    // og:image-et magát a szomszédos opengraph-image.tsx fájl-konvenció
    // adja, poll-specifikusan — ez a szöveges rész hozzá.
    openGraph: { title, description },
    twitter: { title, description },
  };
}

export default async function SzavazasPage({ params }: { params: Params }) {
  const { slug } = await params;
  const poll = await getPollWithResults(getDb(), slug);

  if (!poll) {
    notFound();
  }

  const jar = await cookies();
  const cookieName = `poll_${poll.question.slug}_voted`;
  const rawVotedCookie = jar.get(cookieName)?.value ?? null;
  // A süti "árva" lehet, ha a mögötte lévő PollVote sort időközben törölték
  // (pl. adminisztratív adat-visszaállításnál) — ilyenkor ne ragadjon örökre
  // "már szavaztál" állapotban a böngésző. (A `cookies()` írása Server
  // Component-ből nem engedélyezett, ezért nem próbáljuk itt törölni a
  // sütit — elég figyelmen kívül hagyni; egy új szavazat úgyis felülírja.)
  const votedCookie =
    rawVotedCookie && (await voteExists(getDb(), rawVotedCookie)) ? rawVotedCookie : null;
  const ownSelectionIds = votedCookie ? await getOwnSelections(getDb(), votedCookie) : [];

  return (
    <>
      <PollQuestion
        text={poll.question.questionText}
        minSelect={poll.question.minSelect}
        maxSelect={poll.question.maxSelect}
      />
      <VoteFormClient
        questionSlug={poll.question.slug}
        minSelect={poll.question.minSelect}
        maxSelect={poll.question.maxSelect}
        status={poll.question.status}
        options={poll.options.map((o) => ({
          id: o.id,
          title: o.title,
          shortDescription: o.shortDescription,
          longDescription: o.longDescription,
          amountHuf: o.amountHuf === null ? null : o.amountHuf.toString(),
          amountLabel: o.amountLabel,
          sourceUrl: o.sourceUrl,
          sourceOutlet: o.sourceOutlet,
          isAreaNotCase: o.isAreaNotCase,
          touchesEuFunds: o.touchesEuFunds,
          alreadyReported: o.alreadyReported,
          votes: o.votes,
          sharePct: o.sharePct,
        }))}
        totalVotes={poll.totalVotes}
        alreadyVoted={!!votedCookie}
        ownSelectionIds={ownSelectionIds}
      />
    </>
  );
}
