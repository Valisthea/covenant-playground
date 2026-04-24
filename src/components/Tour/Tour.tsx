import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './Tour.css';
import { Editor } from '../Editor/Editor';
import { TourSidebar } from './TourSidebar';
import { LessonHeader } from './LessonHeader';
import { LessonInstructions } from './LessonInstructions';
import { LessonValidationPanel } from './LessonValidationPanel';
import { LessonNavigation } from './LessonNavigation';
import { useTourStore } from '../../lib/tour-store';
import { useStore } from '../../lib/store';
import { getLesson, getModuleForLesson } from '../../tour/curriculum';

/** Tracks started/completed counts locally — no external service. */
function trackEvent(event: 'started' | 'completed', lessonId: string) {
  try {
    const raw = localStorage.getItem('cov-tour-stats') ?? '{}';
    const stats: Record<string, { started: number; completed: number }> = JSON.parse(raw);
    if (!stats[lessonId]) stats[lessonId] = { started: 0, completed: 0 };
    stats[lessonId][event]++;
    localStorage.setItem('cov-tour-stats', JSON.stringify(stats));
  } catch {
    // silently ignore storage errors
  }
}

export function Tour() {
  const { lessonId: paramId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const { setCurrentLesson, isCompleted, completionMode } = useTourStore();
  const loadSource = useStore((s) => s.loadSource);

  // Default → first lesson
  useEffect(() => {
    if (!paramId) {
      navigate('/tour/M1L1', { replace: true });
    }
  }, [paramId, navigate]);

  const lessonId = paramId ?? 'M1L1';
  const lesson = getLesson(lessonId);
  const module = getModuleForLesson(lessonId);

  // Set current lesson in store + load starter code when lesson changes
  useEffect(() => {
    if (!lesson) return;
    setCurrentLesson(lesson.id);
    // Only load starter if lesson not already completed (preserve user's work)
    if (!isCompleted(lesson.id)) {
      loadSource(lesson.codeStarter);
    }
    trackEvent('started', lesson.id);
  }, [lessonId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mobile gate
  if (typeof window !== 'undefined' && window.innerWidth < 640) {
    return (
      <div className="tour-mobile-gate">
        <h2>Better on desktop</h2>
        <p>
          The Tour of Covenant shows instructions and a live editor side-by-side —
          that needs a wider screen. Please open on a desktop or tablet.
        </p>
        <a href="/" className="tour-btn-primary">
          Browse examples instead
        </a>
      </div>
    );
  }

  if (!lesson || !module) {
    return (
      <div className="tour-not-found">
        <h2>Lesson not found</h2>
        <p>That lesson ID doesn't exist.</p>
        <a href="/tour/M1L1" className="tour-btn-primary">
          Start from the beginning
        </a>
      </div>
    );
  }

  const completed = isCompleted(lessonId);
  const withHelp = completionMode[lessonId] === 'helped';

  return (
    <div className="tour-shell">
      <TourSidebar currentLessonId={lessonId} />

      <div className="tour-main">
        <LessonHeader
          lesson={lesson}
          module={module}
          completed={completed}
          withHelp={withHelp}
        />

        <div className="tour-body">
          {/* Left panel: explanation + hints */}
          <div className="tour-instructions-panel">
            <LessonInstructions lesson={lesson} />
          </div>

          {/* Right panel: Monaco editor + validation */}
          <div className="tour-editor-panel">
            <div className="tour-editor-wrap">
              <Editor />
            </div>
            <LessonValidationPanel lesson={lesson} lessonId={lessonId} />
          </div>
        </div>

        <LessonNavigation currentLessonId={lessonId} />
      </div>
    </div>
  );
}
