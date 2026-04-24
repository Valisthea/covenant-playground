import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { TOTAL_LESSONS, getAllLessons } from '../tour/curriculum';
import type { LessonId } from '../tour/types';

interface TourState {
  currentLessonId: LessonId;
  completedLessonIds: LessonId[];
  completionMode: Record<LessonId, 'clean' | 'helped'>;
  startedAt: string;
  lastActiveAt: string;

  // Actions
  setCurrentLesson: (lessonId: LessonId) => void;
  markCompleted: (lessonId: LessonId, mode?: 'clean' | 'helped') => void;
  resetProgress: () => void;

  // Derived
  isCompleted: (lessonId: LessonId) => boolean;
  progressPercent: () => number;
  isUnlocked: (lessonId: LessonId) => boolean;
}

export const useTourStore = create<TourState>()(
  persist(
    (set, get) => ({
      currentLessonId: 'M1L1',
      completedLessonIds: [],
      completionMode: {},
      startedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),

      setCurrentLesson: (lessonId) =>
        set({ currentLessonId: lessonId, lastActiveAt: new Date().toISOString() }),

      markCompleted: (lessonId, mode = 'clean') => {
        const { completedLessonIds, completionMode } = get();
        if (completedLessonIds.includes(lessonId)) {
          // Update mode if now cleaner
          if (mode === 'clean' && completionMode[lessonId] !== 'clean') {
            set({ completionMode: { ...completionMode, [lessonId]: 'clean' } });
          }
          return;
        }
        set({
          completedLessonIds: [...completedLessonIds, lessonId],
          completionMode: { ...completionMode, [lessonId]: mode },
          lastActiveAt: new Date().toISOString(),
        });
      },

      resetProgress: () =>
        set({
          currentLessonId: 'M1L1',
          completedLessonIds: [],
          completionMode: {},
          startedAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
        }),

      isCompleted: (lessonId) => get().completedLessonIds.includes(lessonId),

      progressPercent: () =>
        Math.round((get().completedLessonIds.length / TOTAL_LESSONS) * 100),

      isUnlocked: (lessonId) => {
        if (lessonId === 'M1L1') return true;
        const { completedLessonIds } = get();
        const all = getAllLessons();
        const idx = all.findIndex((l) => l.id === lessonId);
        if (idx <= 0) return true;
        return completedLessonIds.includes(all[idx - 1].id);
      },
    }),
    { name: 'covenant-tour-progress' },
  ),
);

// Helper for non-hook contexts (e.g. analytics)
export const getTourState = () => useTourStore.getState();
