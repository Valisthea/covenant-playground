// Tour of Covenant — data model

export type ModuleId = 'M1' | 'M2' | 'M3' | 'M4';
export type LessonId = string; // "M1L1", "M1L2", ..., "M4L5"

export interface Module {
  id: ModuleId;
  title: string;
  description: string;
  color: string; // CSS color for module identification
  lessons: Lesson[];
}

export interface Lesson {
  id: LessonId;
  moduleId: ModuleId;
  order: number; // 1-5 within module
  title: string;
  description: string;
  estimatedMinutes: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';

  // Content
  explanation: string; // Markdown, 2-4 paragraphs
  codeStarter: string; // .cov source code provided to the editor
  codeSolution: string; // Expected final state (for show-solution button)

  // Learning objective
  objective: string; // "Modify X to make Y"
  hints: string[]; // Progressive hints (reveal one at a time)

  // Validation
  validator: LessonValidator;

  // Navigation
  next: LessonId | null;
}

export type LessonValidator =
  | { type: 'compile-succeeds' }
  | { type: 'contains-pattern'; pattern: string; description: string }
  | { type: 'custom'; fn: (source: string, compileResult: CompileResult | null) => ValidationResult };

export interface CompileResult {
  ok: boolean;
  diagnostics: Array<{ severity: 'error' | 'warning' | 'info'; message: string; line?: number }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface ValidationResult {
  passed: boolean;
  message: string;
  details?: string;
}

export interface TourProgress {
  currentLessonId: LessonId;
  completedLessonIds: LessonId[];
  /** "completed-clean" or "completed-with-help" per lesson */
  completionMode: Record<LessonId, 'clean' | 'helped'>;
  startedAt: string; // ISO datetime
  lastActiveAt: string;
}
