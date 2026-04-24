import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Eye, Target } from 'lucide-react';
import type { Lesson } from '../../tour/types';

interface LessonInstructionsProps {
  lesson: Lesson;
}

export function LessonInstructions({ lesson }: LessonInstructionsProps) {
  const [hintsShown, setHintsShown] = useState(0);

  return (
    <div className="lesson-instructions">
      {/* Markdown explanation */}
      <div className="lesson-explanation">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{lesson.explanation}</ReactMarkdown>
      </div>

      {/* Objective box */}
      <div className="lesson-objective">
        <div className="lesson-objective-title">
          <Target size={15} />
          Your objective
        </div>
        <p>{lesson.objective}</p>
      </div>

      {/* Progressive hints */}
      <div className="lesson-hints">
        <div className="lesson-hints-title">
          <Eye size={15} />
          Hints ({hintsShown}/{lesson.hints.length} revealed)
        </div>

        {hintsShown === 0 ? (
          <button className="tour-btn-ghost" onClick={() => setHintsShown(1)}>
            Show first hint
          </button>
        ) : (
          <>
            <ol className="lesson-hints-list">
              {lesson.hints.slice(0, hintsShown).map((hint, i) => (
                <li key={i}>{hint}</li>
              ))}
            </ol>
            {hintsShown < lesson.hints.length && (
              <button className="tour-btn-ghost" onClick={() => setHintsShown((n) => n + 1)}>
                Show hint {hintsShown + 1}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
