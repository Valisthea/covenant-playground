import { NavLink } from 'react-router-dom';
import { CheckCircle, Lock, Circle, ChevronRight } from 'lucide-react';
import { CURRICULUM, TOTAL_LESSONS } from '../../tour/curriculum';
import { useTourStore } from '../../lib/tour-store';

interface TourSidebarProps {
  currentLessonId: string;
}

export function TourSidebar({ currentLessonId }: TourSidebarProps) {
  const { completedLessonIds, progressPercent, isUnlocked, resetProgress } = useTourStore();
  const pct = progressPercent();
  const done = completedLessonIds.length;

  return (
    <aside className="tour-sidebar">
      {/* Header */}
      <div className="tour-sidebar-header">
        <a href="/" className="tour-home-link">
          <span className="tour-home-logo">COVENANT</span>
          <span className="tour-home-badge">TOUR</span>
        </a>
        <div className="tour-progress-wrap">
          <div className="tour-progress-bar">
            <div className="tour-progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="tour-progress-text">
            {done} / {TOTAL_LESSONS} lessons
          </span>
        </div>
      </div>

      {/* Module + lesson list */}
      <nav className="tour-nav">
        {CURRICULUM.map((module) => (
          <div key={module.id} className="tour-module-section">
            <h3 className="tour-module-title" style={{ color: module.color }}>
              {module.title}
            </h3>
            <p className="tour-module-desc">{module.description}</p>

            <ul className="tour-lesson-list">
              {module.lessons.map((lesson) => {
                const completed = completedLessonIds.includes(lesson.id);
                const active = lesson.id === currentLessonId;
                const unlocked = isUnlocked(lesson.id);

                return (
                  <li key={lesson.id}>
                    {unlocked ? (
                      <NavLink
                        to={`/tour/${lesson.id}`}
                        className={[
                          'tour-lesson-link',
                          active ? 'active' : '',
                          completed ? 'completed' : '',
                        ].join(' ')}
                      >
                        <span className="tour-lesson-icon">
                          {completed ? (
                            <CheckCircle size={14} />
                          ) : active ? (
                            <ChevronRight size={14} />
                          ) : (
                            <Circle size={14} />
                          )}
                        </span>
                        <span className="tour-lesson-name">{lesson.title}</span>
                        <span className="tour-lesson-time">{lesson.estimatedMinutes}m</span>
                      </NavLink>
                    ) : (
                      <div className="tour-lesson-locked">
                        <span className="tour-lesson-icon">
                          <Lock size={14} />
                        </span>
                        <span className="tour-lesson-name">{lesson.title}</span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="tour-sidebar-footer">
        <a href="/" className="tour-playground-link">
          Open free Playground →
        </a>
        {done > 0 && (
          <button
            className="tour-reset-btn"
            onClick={() => {
              if (window.confirm('Reset all tour progress? This cannot be undone.')) {
                resetProgress();
              }
            }}
          >
            Reset progress
          </button>
        )}
      </div>
    </aside>
  );
}
