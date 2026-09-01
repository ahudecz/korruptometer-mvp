import 'server-only';
import { asc, count, countDistinct, desc, eq } from 'drizzle-orm';

import { getDb, schema } from './db';
import { computeSharePct } from './poll-results';

type Db = ReturnType<typeof getDb>;

export type PollOptionResult = {
  id: string;
  title: string;
  shortDescription: string;
  longDescription: string | null;
  amountHuf: bigint | null;
  amountLabel: string | null;
  sourceUrl: string;
  sourceOutlet: string;
  isAreaNotCase: boolean;
  touchesEuFunds: boolean;
  alreadyReported: boolean;
  votes: number;
  sharePct: number;
};

export type PollWithResults = {
  question: {
    id: string;
    slug: string;
    questionText: string;
    minSelect: number;
    maxSelect: number;
    status: 'open' | 'closed';
  };
  totalVotes: number;
  options: PollOptionResult[];
};

/**
 * Kérdés + opciók + élő eredmény-összesítés egy hívásban (GET /api/poll —
 * lásd contracts/poll-api.md). Az eredmény-nézet a `votes` szerint csökkenő
 * sorrendet várja (FR-008); a szavazó-nézet a `displayOrder` szerintit — a
 * kliens dönti el ugyanabból a payloadból, ezért itt displayOrder szerint
 * rendezve adjuk vissza, a share-számítás pedig mindkét nézethez elég.
 */
export async function getPollWithResults(
  db: Db,
  slug: string,
): Promise<PollWithResults | null> {
  const [question] = await db
    .select()
    .from(schema.pollQuestions)
    .where(eq(schema.pollQuestions.slug, slug))
    .limit(1);
  if (!question) return null;

  const voteCounts = await db
    .select({
      optionId: schema.pollVoteSelections.pollOptionId,
      votes: countDistinct(schema.pollVoteSelections.pollVoteId),
    })
    .from(schema.pollVoteSelections)
    .innerJoin(
      schema.pollOptions,
      eq(schema.pollOptions.id, schema.pollVoteSelections.pollOptionId),
    )
    .where(eq(schema.pollOptions.pollQuestionId, question.id))
    .groupBy(schema.pollVoteSelections.pollOptionId);

  const votesByOption = new Map(voteCounts.map((v) => [v.optionId, v.votes]));

  const totalVotesRows = await db
    .select({ totalVotes: count(schema.pollVotes.id) })
    .from(schema.pollVotes)
    .where(eq(schema.pollVotes.pollQuestionId, question.id));
  const totalVotes = totalVotesRows[0]?.totalVotes ?? 0;

  const rawOptions = await db
    .select()
    .from(schema.pollOptions)
    .where(eq(schema.pollOptions.pollQuestionId, question.id))
    .orderBy(asc(schema.pollOptions.displayOrder));

  const options: PollOptionResult[] = rawOptions.map((o) => {
    const votes = votesByOption.get(o.id) ?? 0;
    const sharePct = computeSharePct(votes, totalVotes);
    return {
      id: o.id,
      title: o.title,
      shortDescription: o.shortDescription,
      longDescription: o.longDescription,
      amountHuf: o.amountHuf,
      amountLabel: o.amountLabel,
      sourceUrl: o.sourceUrl,
      sourceOutlet: o.sourceOutlet,
      isAreaNotCase: o.isAreaNotCase,
      touchesEuFunds: o.touchesEuFunds,
      alreadyReported: o.alreadyReported,
      votes,
      sharePct,
    };
  });

  return {
    question: {
      id: question.id,
      slug: question.slug,
      questionText: question.questionText,
      minSelect: question.minSelect,
      maxSelect: question.maxSelect,
      status: question.status,
    },
    totalVotes,
    options,
  };
}

export { sortByVotesDesc } from './poll-results';

/**
 * A saját, most leadott (vagy korábban leadott) szavazat kiválasztott
 * opció-azonosítói — az eredmény-nézet kiemeléséhez (US2, T022).
 */
export async function getOwnSelections(db: Db, voteId: string): Promise<string[]> {
  const rows = await db
    .select({ optionId: schema.pollVoteSelections.pollOptionId })
    .from(schema.pollVoteSelections)
    .where(eq(schema.pollVoteSelections.pollVoteId, voteId));
  return rows.map((r) => r.optionId);
}

/**
 * Szavazat tranzakciós beszúrása — 1 PollVote sor + N PollVoteSelection sor.
 * A hívó felelőssége az 1-5 tartomány, a honeypot, a rate-limit és a
 * Turnstile ellenőrzése ELŐTTE (lásd contracts/poll-api.md validációs
 * sorrendje) — ez a függvény már csak a garantáltan érvényes beszúrást végzi.
 */
export async function insertVote(
  db: Db,
  pollQuestionId: string,
  optionIds: string[],
): Promise<string> {
  return db.transaction(async (tx) => {
    const [vote] = await tx
      .insert(schema.pollVotes)
      .values({ pollQuestionId })
      .returning({ id: schema.pollVotes.id });
    await tx.insert(schema.pollVoteSelections).values(
      optionIds.map((pollOptionId) => ({ pollVoteId: vote!.id, pollOptionId })),
    );
    return vote!.id;
  });
}

export type PollListItem = {
  slug: string;
  questionText: string;
  status: 'open' | 'closed';
  totalVotes: number;
  createdAt: Date;
};

/**
 * Az összes szavazás (jelenlegi + korábbi) listája a "Szólj bele" szekció
 * oldalsávjához — friss elöl.
 */
export async function listPolls(db: Db): Promise<PollListItem[]> {
  const questions = await db
    .select()
    .from(schema.pollQuestions)
    .orderBy(desc(schema.pollQuestions.createdAt));

  const counts = await db
    .select({
      pollQuestionId: schema.pollVotes.pollQuestionId,
      total: count(schema.pollVotes.id),
    })
    .from(schema.pollVotes)
    .groupBy(schema.pollVotes.pollQuestionId);
  const countsByQuestion = new Map(counts.map((c) => [c.pollQuestionId, c.total]));

  return questions.map((q) => ({
    slug: q.slug,
    questionText: q.questionText,
    status: q.status,
    totalVotes: countsByQuestion.get(q.id) ?? 0,
    createdAt: q.createdAt,
  }));
}

/** Létezik-e még a PollVote sor (a cookie-ban hordozott id érvényes-e). */
export async function voteExists(db: Db, voteId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: schema.pollVotes.id })
    .from(schema.pollVotes)
    .where(eq(schema.pollVotes.id, voteId))
    .limit(1);
  return !!row;
}
