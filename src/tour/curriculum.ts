import type { Module, Lesson } from './types';
import { M1_basics } from './lessons/M1_basics';
import { M2_privacy } from './lessons/M2_privacy';
import { M3_advanced } from './lessons/M3_advanced';

export const CURRICULUM: Module[] = [
  {
    id: 'M1',
    title: 'Basics',
    description: 'Core syntax and contract structure',
    color: '#7C3AED',
    lessons: M1_basics,
  },
  {
    id: 'M2',
    title: 'Privacy',
    description: 'FHE · ZK proofs · Post-quantum · Amnesia',
    color: '#A78BFA',
    lessons: M2_privacy,
  },
  {
    id: 'M3',
    title: 'Advanced',
    description: 'Bridges · Aggregates · Optimizations · Deploy',
    color: '#4C1D95',
    lessons: M3_advanced,
  },
];

/** Total lesson count across all modules */
export const TOTAL_LESSONS = CURRICULUM.reduce((n, m) => n + m.lessons.length, 0);

export function getLesson(lessonId: string): Lesson | null {
  for (const module of CURRICULUM) {
    const lesson = module.lessons.find((l) => l.id === lessonId);
    if (lesson) return lesson;
  }
  return null;
}

export function getModuleForLesson(lessonId: string): Module | null {
  for (const module of CURRICULUM) {
    if (module.lessons.some((l) => l.id === lessonId)) return module;
  }
  return null;
}

export function getAllLessons(): Lesson[] {
  return CURRICULUM.flatMap((m) => m.lessons);
}

export function getNextLesson(currentId: string): Lesson | null {
  const current = getLesson(currentId);
  if (!current?.next) return null;
  return getLesson(current.next);
}

export function getPreviousLesson(currentId: string): Lesson | null {
  const all = getAllLessons();
  const idx = all.findIndex((l) => l.id === currentId);
  return idx > 0 ? all[idx - 1] : null;
}
