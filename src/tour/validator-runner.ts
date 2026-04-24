import type { Lesson, CompileResult, ValidationResult } from './types';

export async function validateLesson(
  lesson: Lesson,
  currentSource: string,
  compileResult: CompileResult | null,
): Promise<ValidationResult> {
  const v = lesson.validator;

  switch (v.type) {
    case 'compile-succeeds': {
      const hasErrors = compileResult?.diagnostics?.some((d) => d.severity === 'error');
      if (!compileResult || hasErrors) {
        return {
          passed: false,
          message: 'Your code has compile errors — fix them first.',
          details: compileResult?.diagnostics
            ?.filter((d) => d.severity === 'error')
            .map((d) => `Line ${d.line ?? '?'}: ${d.message}`)
            .join('\n'),
        };
      }
      return { passed: true, message: 'Code compiles successfully!' };
    }

    case 'contains-pattern': {
      const regex = new RegExp(v.pattern, 'i');
      if (regex.test(currentSource)) {
        return { passed: true, message: 'Pattern found!' };
      }
      return {
        passed: false,
        message: v.description,
        details: `Expected pattern: ${v.pattern}`,
      };
    }

    case 'custom': {
      return v.fn(currentSource, compileResult);
    }
  }
}
