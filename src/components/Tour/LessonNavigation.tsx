import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Trophy } from 'lucide-react';
import { getPreviousLesson, getNextLesson } from '../../tour/curriculum';
import { useTourStore } from '../../lib/tour-store';

interface LessonNavigationProps {
  currentLessonId: string;
}

export function LessonNavigation({ currentLessonId }: LessonNavigationProps) {
  const navigate = useNavigate();
  const { isCompleted } = useTourStore();

  const prev = getPreviousLesson(currentLessonId);
  const next = getNextLesson(currentLessonId);
  const completed = isCompleted(currentLessonId);

  return (
    <nav className="lesson-nav-bar">
      {/* Prev */}
      <button
        className="tour-btn-ghost lesson-nav-prev"
        onClick={() => prev && navigate(`/tour/${prev.id}`)}
        disabled={!prev}
      >
        <ChevronLeft size={16} />
        {prev ? prev.title : 'First lesson'}
      </button>

      {/* Next / Done */}
      {completed && next ? (
        <button
          className="tour-btn-primary lesson-nav-next"
          onClick={() => navigate(`/tour/${next.id}`)}
        >
          Next: {next.title}
          <ChevronRight size={16} />
        </button>
      ) : completed && !next ? (
        <div className="lesson-nav-complete">
          <Trophy size={18} />
          <span>Tour complete! 🎉</span>
          <button className="tour-btn-primary" onClick={() => navigate('/')}>
            Open free Playground
          </button>
        </div>
      ) : (
        <button className="tour-btn-ghost lesson-nav-next" disabled>
          Complete objective to continue
          <ChevronRight size={16} />
        </button>
      )}
    </nav>
  );
}
