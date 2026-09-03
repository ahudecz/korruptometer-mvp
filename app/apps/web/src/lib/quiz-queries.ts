import 'server-only';
import { asc, desc, eq } from 'drizzle-orm';

import { getDb, schema } from './db';

type Db = ReturnType<typeof getDb>;

export type QuizTier = {
  minScore: number;
  maxScore: number;
  title: string;
  description?: string;
};

export type QuizQuestionData = {
  id: string;
  questionText: string;
  options: string[];
  correctIndex: number;
  explanation: string | null;
  explanationWrong: string | null;
  imageUrl: string | null;
  imageCaption: string | null;
  linkUrl: string | null;
  linkLabel: string | null;
  videoId: string | null;
  videoIntro: string | null;
};

export type QuizWithQuestions = {
  id: string;
  slug: string;
  title: string;
  intro: string;
  tiers: QuizTier[];
  coverImageUrl: string | null;
  coverImageCaption: string | null;
  outroVideoId: string | null;
  outroVideoIntro: string | null;
  questions: QuizQuestionData[];
};

/**
 * Kvíz + kérdései egy hívásban — a helyes válasz indexe és a magyarázat is
 * a payload része (szándékosan, ellentétben a szavazással: itt nincs
 * "csalás" kockázat, a kvíz kliens-oldalon fut végig, l. quickstart.md
 * elképzelt vitáját erről — a player.hu-s referencia-minta is így működik).
 */
export async function getQuizWithQuestions(
  db: Db,
  slug: string,
): Promise<QuizWithQuestions | null> {
  const [quiz] = await db.select().from(schema.quizzes).where(eq(schema.quizzes.slug, slug)).limit(1);
  if (!quiz) return null;

  const rawQuestions = await db
    .select()
    .from(schema.quizQuestions)
    .where(eq(schema.quizQuestions.quizId, quiz.id))
    .orderBy(asc(schema.quizQuestions.displayOrder));

  return {
    id: quiz.id,
    slug: quiz.slug,
    title: quiz.title,
    intro: quiz.intro,
    tiers: quiz.tiers as QuizTier[],
    coverImageUrl: quiz.coverImageUrl,
    coverImageCaption: quiz.coverImageCaption,
    outroVideoId: quiz.outroVideoId,
    outroVideoIntro: quiz.outroVideoIntro,
    questions: rawQuestions.map((q) => ({
      id: q.id,
      questionText: q.questionText,
      options: q.options as string[],
      correctIndex: q.correctIndex,
      explanation: q.explanation,
      explanationWrong: q.explanationWrong,
      imageUrl: q.imageUrl,
      imageCaption: q.imageCaption,
      linkUrl: q.linkUrl,
      linkLabel: q.linkLabel,
      videoId: q.videoId,
      videoIntro: q.videoIntro,
    })),
  };
}

export type QuizListItem = {
  slug: string;
  title: string;
  questionCount: number;
  createdAt: Date;
};

/** Az összes kvíz listája a `/kviz` index-oldalhoz — friss elöl. */
export async function listQuizzes(db: Db): Promise<QuizListItem[]> {
  const quizList = await db.select().from(schema.quizzes).orderBy(desc(schema.quizzes.createdAt));

  const questionCounts = await db
    .select({ quizId: schema.quizQuestions.quizId })
    .from(schema.quizQuestions);
  const countByQuiz = new Map<string, number>();
  for (const row of questionCounts) {
    countByQuiz.set(row.quizId, (countByQuiz.get(row.quizId) ?? 0) + 1);
  }

  return quizList.map((q) => ({
    slug: q.slug,
    title: q.title,
    questionCount: countByQuiz.get(q.id) ?? 0,
    createdAt: q.createdAt,
  }));
}
