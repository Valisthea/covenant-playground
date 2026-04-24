import { CheckCircle } from 'lucide-react';
import type { Lesson, Module } from '../../tour/types';

interface LessonHeaderProps {
  lesson: Lesson;
  module: Module;
  completed: boolean;
  withHelp: boolean;
}

const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

export function LessonHeader({ lesson, module, completed, withHelp }: LessonHeaderProps) {
  return (
    <header className="lesson-header">
      <div className="lesson-breadcrumb">
        <span className="lesson-module-label" style={{ color: module.color }}>
          {module.title}
        </span>
        <span className="lesson-breadcrumb-sep">›</span>
        <span>Lesson {lesson.order} of 5</span>

        {completed && (
          <span className={`lesson-completed-badge ${withHelp ? 'helped' : 'clean'}`}>
            <CheckCircle size={13} />
            {withHelp ? 'Completed (with hint)' : 'Completed'}
          </span>
        )}
      </div>

      <h1 className="lesson-title">{lesson.title}</h1>
      <p className="lesson-description">{lesson.description}</p>

      <div className="lesson-meta">
        <span className={`lesson-difficulty lesson-difficulty--${lesson.difficulty}`}>
          {DIFFICULTY_LABELS[lesson.difficulty]}
        </span>
        <span className="lesson-time">≈ {lesson.estimatedMinutes} min</span>
        <span className="lesson-id">{lesson.id}</span>
      </div>
    </header>
  );
}
