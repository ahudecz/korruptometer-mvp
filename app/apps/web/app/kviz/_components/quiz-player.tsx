'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

import { ShareButton } from '../../szavazas/_components/share-button';
import type { QuizQuestionData, QuizTier } from '@/lib/quiz-queries';

type Phase = 'intro' | 'question' | 'result';

function tierFor(tiers: QuizTier[], score: number): QuizTier | null {
  return tiers.find((t) => score >= t.minScore && score <= t.maxScore) ?? null;
}

function QuizVideo({ videoId, intro }: { videoId: string; intro?: string | null }) {
  return (
    <div className="quiz-video">
      {intro && <p className="quiz-video-intro">{intro}</p>}
      <div className="quiz-video-wrap">
        <iframe
          src={`https://www.youtube.com/embed/${videoId}`}
          title="Kapcsolódó videó"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  );
}

/**
 * A teljes kvíz-játékmenet — a player.hu kvíz-mintáját követi (l.
 * specs/012-quiz-system/research.md): egy kérdés egy képernyőn, válaszra
 * kattintva azonnali szín-visszajelzés (helyes = zöld, hibás választás =
 * piros + a helyes válasz külön kiemelve), "Következő kérdés" gombbal
 * továbblépve, a végén pontszám + kategória-cím + megosztás.
 *
 * Teljesen kliens-oldali állapot — nincs DB-írás, nincs "már kitöltötted"
 * korlátozás (ellentétben a szavazással), bárki bármennyiszer újrajátszhatja.
 */
export function QuizPlayer({
  title,
  intro,
  tiers,
  outroVideoId,
  outroVideoIntro,
  questions,
}: {
  title: string;
  intro: string;
  tiers: QuizTier[];
  outroVideoId: string | null;
  outroVideoIntro: string | null;
  questions: QuizQuestionData[];
}) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const topRef = useRef<HTMLDivElement>(null);

  const shareUrl = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';
  const current = questions[index];
  const total = questions.length;

  const resultTier = useMemo(() => tierFor(tiers, score), [tiers, score]);

  // Kérdésváltásnál (és intro→kérdés, kérdés→eredmény átmenetnél) ugorjunk
  // a nézet TETEJÉRE — user report, 2026-09-03: "Következő kérdés" után a
  // lap lent maradt, az új kérdés címe görgetés nélkül nem látszott.
  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [phase, index]);

  function handleStart() {
    setPhase('question');
  }

  function handleAnswer(optionIndex: number) {
    if (selected !== null || !current) return;
    setSelected(optionIndex);
    if (optionIndex === current.correctIndex) setScore((s) => s + 1);
  }

  function handleNext() {
    setSelected(null);
    if (index + 1 < total) {
      setIndex((i) => i + 1);
    } else {
      setPhase('result');
    }
  }

  function handleRestart() {
    setIndex(0);
    setSelected(null);
    setScore(0);
    setPhase('intro');
  }

  if (phase === 'intro') {
    return (
      <div ref={topRef} className="quiz-intro">
        <h1 className="quiz-intro-title">{title}</h1>
        <p className="quiz-intro-text">{intro}</p>
        <p className="quiz-intro-meta">{total} kérdés · kb. {Math.max(1, Math.round(total * 0.3))} perc</p>
        <button type="button" className="quiz-start-btn" onClick={handleStart}>
          Kezdés →
        </button>
        <ShareButton url={shareUrl} title={title} text={`Kipróbálnád? ${title}`} label="Kvíz megosztása" className="poll-share-button" />
      </div>
    );
  }

  if (phase === 'question' && current) {
    const isCorrectPick = selected === current.correctIndex;
    // Ha van külön "hibás válasz esetén" szöveg, akkor "explanation" a
    // helyes-válasz-utáni, "explanationWrong" a hibás-válasz-utáni szöveg.
    // Ha nincs, "explanation" mindkét esetben ugyanaz.
    const feedbackText = selected !== null
      ? (!isCorrectPick && current.explanationWrong ? current.explanationWrong : current.explanation)
      : null;

    return (
      <div ref={topRef} className="quiz-question-view">
        <div className="quiz-progress">
          <div className="quiz-progress-track">
            <div className="quiz-progress-bar" style={{ width: `${((index + 1) / total) * 100}%` }} />
          </div>
          <span className="quiz-progress-label">{index + 1}. / {total} kérdés</span>
        </div>

        <h2 className="quiz-question-text">{current.questionText}</h2>

        {current.imageUrl && (
          <figure className="quiz-question-image">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={current.imageUrl} alt="" />
            {current.imageCaption && <figcaption>{current.imageCaption}</figcaption>}
          </figure>
        )}

        <div className="quiz-options">
          {current.options.map((option, i) => {
            const isSelected = selected === i;
            const isCorrect = i === current.correctIndex;
            const showState = selected !== null;
            let stateClass = '';
            if (showState && isCorrect) stateClass = ' quiz-option--correct';
            else if (showState && isSelected && !isCorrect) stateClass = ' quiz-option--wrong';
            return (
              <button
                key={i}
                type="button"
                className={`quiz-option${stateClass}`}
                onClick={() => handleAnswer(i)}
                disabled={selected !== null}
              >
                {option}
              </button>
            );
          })}
        </div>

        {selected !== null && (
          <div className="quiz-feedback">
            <p className={isCorrectPick ? 'quiz-feedback-verdict quiz-feedback-verdict--correct' : 'quiz-feedback-verdict quiz-feedback-verdict--wrong'}>
              {isCorrectPick ? 'Helyes válasz!' : 'Nem talált.'}
            </p>
            {feedbackText && <p className="quiz-feedback-explanation">{feedbackText}</p>}
            {current.linkUrl && (
              <a href={current.linkUrl} target="_blank" rel="noopener noreferrer" className="poll-result-row-link quiz-feedback-link">
                {current.linkLabel ?? 'Forrás elolvasása'} →
              </a>
            )}
            {current.videoId && <QuizVideo videoId={current.videoId} intro={current.videoIntro} />}
            <button type="button" className="quiz-next-btn" onClick={handleNext}>
              {index + 1 < total ? 'Következő kérdés →' : 'Eredmény megnézése →'}
            </button>
          </div>
        )}
      </div>
    );
  }

  // phase === 'result'
  return (
    <div ref={topRef} className="quiz-result">
      <div className="quiz-result-main">
        <span className="quiz-result-score">{score} / {total}</span>
        {resultTier && (
          <>
            <h2 className="quiz-result-title">{resultTier.title}</h2>
            {resultTier.description && <p className="quiz-result-desc">{resultTier.description}</p>}
          </>
        )}
        <div className="quiz-result-actions">
          <button type="button" className="quiz-start-btn" onClick={handleRestart}>
            Újrajátszom
          </button>
        </div>
        <div className="quiz-result-share">
          <ShareButton
            url={shareUrl}
            title={title}
            text={`${score}/${total} pontot értem el a(z) "${title}" kvízen${resultTier ? ` — ${resultTier.title}` : ''}. Próbáld ki te is!`}
            label="Eredményem megosztása"
            className="poll-share-button poll-share-button--picks"
          />
          <ShareButton url={shareUrl} title={title} text={`Kipróbálnád? ${title}`} label="Kvíz megosztása" className="poll-share-button" />
        </div>
        <Link href="/szavazas" className="poll-vote-cta quiz-result-poll-cta">
          Szavazok is →
        </Link>
      </div>

      {outroVideoId && (
        <div className="quiz-result-video-col">
          <QuizVideo videoId={outroVideoId} intro={outroVideoIntro} />
        </div>
      )}
    </div>
  );
}
