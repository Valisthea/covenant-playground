import { useState, useCallback } from 'react';
import { Check, X, Loader, BookOpen, RotateCcw, AlertTriangle, AlertCircle, Info } from 'lucide-react';
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
  // Live compile diagnostics — auto-updates after each debounced compile.
  const diagnostics = useStore((s) => s.diagnostics);
  const isCompiling = useStore((s) => s.isCompiling);
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

  const handleReset = useCallback(() => {
    // Wipe the editor back to the lesson's starter code so the learner
    // can take another run at it. Clears any prior pass/fail banner and
    // un-flags the "solution shown" state so a clean attempt counts as
    // such on the next Check.
    if (currentSource !== lesson.codeStarter) {
      const ok = window.confirm('Reset the editor to the original starter code? Your current edits will be lost.');
      if (!ok) return;
    }
    loadSource(lesson.codeStarter);
    setSolutionLoaded(false);
    setResult(null);
  }, [lesson.codeStarter, loadSource, currentSource]);

  const errorCount = diagnostics.filter((d) => d.severity === 'error').length;
  const warningCount = diagnostics.filter((d) => d.severity === 'warning').length;
  const infoCount = diagnostics.filter((d) => d.severity === 'info').length;

  return (
    <div className="lesson-validation-panel">
      <div className="lesson-validation-header">
        <span className="lesson-validation-label">Check your answer</span>
        <div className="lesson-validation-actions">
          <button
            className="tour-btn-ghost tour-btn-sm"
            onClick={handleReset}
            title="Reset the editor back to the starter code for this lesson"
          >
            <RotateCcw size={13} />
            Reset
          </button>
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

      {/* Live compiler diagnostics — visible the moment the debounced
          compile finishes, so learners don't have to hover Monaco markers
          to see what the compiler is complaining about. */}
      {diagnostics.length > 0 && (
        <div className="lesson-diagnostics">
          <div className="lesson-diagnostics-header">
            <span className="lesson-diagnostics-title">Compiler output</span>
            <div className="lesson-diagnostics-counts">
              {errorCount > 0 && (
                <span className="lesson-diag-count lesson-diag-count--error">
                  <AlertCircle size={11} /> {errorCount}
                </span>
              )}
              {warningCount > 0 && (
                <span className="lesson-diag-count lesson-diag-count--warn">
                  <AlertTriangle size={11} /> {warningCount}
                </span>
              )}
              {infoCount > 0 && (
                <span className="lesson-diag-count lesson-diag-count--info">
                  <Info size={11} /> {infoCount}
                </span>
              )}
            </div>
          </div>
          <ul className="lesson-diagnostics-list">
            {diagnostics.slice(0, 8).map((d, i) => (
              <li key={i} className={`lesson-diag lesson-diag--${d.severity}`}>
                <span className="lesson-diag-icon">
                  {d.severity === 'error' ? (
                    <AlertCircle size={12} />
                  ) : d.severity === 'warning' ? (
                    <AlertTriangle size={12} />
                  ) : (
                    <Info size={12} />
                  )}
                </span>
                <span className="lesson-diag-loc">L{d.line}:{d.column}</span>
                {d.code && <span className="lesson-diag-code">{d.code}</span>}
                <span className="lesson-diag-msg">{d.message}</span>
              </li>
            ))}
            {diagnostics.length > 8 && (
              <li className="lesson-diag lesson-diag--more">
                +{diagnostics.length - 8} more — hover the markers in the editor for details.
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Quiet "all good" hint when the file compiles clean and no
          validation banner is up yet. */}
      {diagnostics.length === 0 && !isCompiling && !result && currentSource.trim().length > 0 && (
        <p className="lesson-diagnostics-clean">
          <Check size={12} /> No compiler errors or warnings.
        </p>
      )}

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
