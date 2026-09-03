import { notFound } from 'next/navigation';

import { getDb } from '@/lib/db';
import { getQuizWithQuestions } from '@/lib/quiz-queries';
import { QuizPlayer } from '../_components/quiz-player';

export const dynamic = 'force-dynamic';

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { slug } = await params;
  const quiz = await getQuizWithQuestions(getDb(), slug);
  if (!quiz) return {};
  const title = quiz.title;
  const description = quiz.intro;
  return {
    title: { absolute: title },
    description,
    // FONTOS: az openGraph/twitter mezők NEM öröklődnek automatikusan a
    // sima title/description-ből — l. a szavazás [slug]/page.tsx azonos
    // jegyzetét (2026-08-31-i bugfix ugyanerre a mintára).
    openGraph: { title, description },
    twitter: { title, description },
  };
}

export default async function KvizPage({ params }: { params: Params }) {
  const { slug } = await params;
  const quiz = await getQuizWithQuestions(getDb(), slug);

  if (!quiz) {
    notFound();
  }

  return (
    <QuizPlayer
      title={quiz.title}
      intro={quiz.intro}
      tiers={quiz.tiers}
      coverImageUrl={quiz.coverImageUrl}
      coverImageCaption={quiz.coverImageCaption}
      outroVideoId={quiz.outroVideoId}
      outroVideoIntro={quiz.outroVideoIntro}
      questions={quiz.questions}
    />
  );
}
