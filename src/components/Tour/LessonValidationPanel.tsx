import { useState, useCallback } from 'react';
import { Check, X, Loader, BookOpen } from 'lucide-react';
import type { Lesson, ValidationResult } from '../../tour/types';
import { validateLesson } from '../../tour/validator-runner';
import { useStore } from '../../lib/store';
import { useTourStore } from '../../lib/tour-store';

interface LessonValidationPanelProps {
  lesson: Lesson;
  lessonId: string;
}

export function LessonValidationPanel({ lesson, lessonId }: LessonValidationPanelProps) {
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [solutionLoaded, setSolutionLoaded] = useState(false);

  const currentSource = useStore((s) => s.source);
  const loadSource = useStore((s) => s.loadSource);
  const compile = useStore((s) => s.compile);
  const { markCompleted } = useTourStore();

  const handleCheck = useCallback(async () => {
    setIsChecking(true);
    try {
      // Ensure latest compile result is fresh
      await compile();
      const latest = useStore.getState().compileResult;
      const vr = await validateLesson(lesson, currentSource, latest);
      setResult(vr);
      if (vr.passed) {
        markCompleted(lessonId, solutionLoaded ? 'helped' : 'clean');
      }
    } catch (err) {
      setResult({ passed: false, message: 'Validation error — try again.', details: String(err) });
    } finally {
      setIsChecking(false);
    }
  }, [lesson, currentSource, compile, lessonId, markCompleted, solutionLoaded]);

  const handleShowSolution = useCallback(() => {
    loadSource(lesson.codeSolution);
    setSolutionLoaded(true);
    setResult(null);
  }, [lesson.codeSolution, loadSource]);

  return (
    <div className="lesson-validation-panel">
      <div className="lesson-validation-header">
        <span className="lesson-validation-label">Check your answer</span>
        <div className="lesson-validation-actions">
          <button
            className="tour-btn-ghost tour-btn-sm"
            onClick={handleShowSolution}
            title="Load the reference solution into the editor"
          >
            <BookOpen size={13} />
            Solution
          </button>
          <button
            className="tour-btn-primary tour-btn-sm"
            onClick={handleCheck}
            disabled={isChecking}
          >
            {isChecking ? <Loader size={13} className="tour-spin" /> : <Check size={13} />}
            {isChecking ? 'Checking…' : 'Check Answer'}
          </button>
        </div>
      </div>

      {result && (
        <div className={`lesson-validation-result ${result.passed ? 'passed' : 'failed'}`}>
          <div className="lesson-validation-msg">
            {result.passed ? <Check size={16} /> : <X size={16} />}
            <span>{result.message}</span>
          </div>
          {result.details && (
            <pre className="lesson-validation-details">{result.details}</pre>
          )}
        </div>
      )}

      {solutionLoaded && !result && (
        <p className="lesson-solution-notice">
          Solution loaded. Click <strong>Check Answer</strong> to mark as complete.
        </p>
      )}
    </div>
  );
}
