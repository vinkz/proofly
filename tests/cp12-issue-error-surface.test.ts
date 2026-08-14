import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Issuing a CP12 could fail with nothing on screen: the button stopped and no
 * message explained why. The toast was pushed, but it is pinned to the top of
 * the viewport and cleared itself after four seconds, while the issue button
 * sits at the bottom of a long single page — and two paths returned silently.
 *
 * These pin the surface, not the wording: an error has to persist, and it has
 * to appear beside the control that failed.
 *
 * The component is 4k lines of React that these tests do not render — vitest
 * runs on the node environment with no DOM — so they assert against source,
 * the same way the other wizard tests do.
 */
const wizard = readFileSync(
  'src/app/(wizard)/wizard/create/[certificateType]/_components/certificate-wizard.tsx',
  'utf8',
);
const useToast = readFileSync('src/components/ui/use-toast.ts', 'utf8');

/** Extract handleGenerate — the issue path, up to its closing finally. */
function handleGenerateSource() {
  const start = wizard.indexOf('const handleGenerate = () => {');
  expect(start).toBeGreaterThan(-1);
  const end = wizard.indexOf('setIsGeneratingPdf(false);', start);
  expect(end).toBeGreaterThan(start);
  return wizard.slice(start, end);
}

describe('error toasts persist', () => {
  it('does not schedule a dismissal for the error variant', () => {
    expect(useToast).toMatch(/if \(toast\.variant === 'error'\) return;/);
  });

  it('still clears every other variant on the timer', () => {
    expect(useToast).toMatch(/setTimeout\(/);
    expect(useToast).toMatch(/4000/);
    // The early return has to come before the timer, or errors get cleared too.
    expect(useToast.indexOf("variant === 'error'")).toBeLessThan(useToast.indexOf('setTimeout('));
  });
});

describe('the issue button reports its own failure', () => {
  it('holds the reason in state and clears it when a new attempt starts', () => {
    expect(wizard).toMatch(/const \[issueError, setIssueError\] = useState<string \| null>\(null\)/);
    expect(handleGenerateSource()).toMatch(/setIssueError\(null\)/);
  });

  it('renders the reason beside the button rather than only in a toast', () => {
    expect(wizard).toMatch(/data-testid="cp12-issue-error"/);
    expect(wizard).toMatch(/role="alert"/);
    expect(wizard).toMatch(/\{issueError\}/);
  });

  it('records a reason on the thrown-error path', () => {
    expect(handleGenerateSource()).toMatch(/catch \(error\) \{\s*setIssueError\(/);
  });

  it('no longer returns silently when the server sends back no certificate', () => {
    const source = handleGenerateSource();
    // Previously `if (!('jobId' in result)) return;` — a dead stop with no message.
    expect(source).not.toMatch(/if \(!\('jobId' in result\)\) return;/);
    expect(source).toMatch(/if \(!\('jobId' in result\)\) \{/);
    expect(source).toMatch(/did not return a certificate/);
  });
});

describe('unreachable checklist guard', () => {
  it('is gone, because the button is disabled under exactly that condition', () => {
    expect(handleGenerateSource()).not.toMatch(/Complete required items first/);
  });

  it('and the button still carries the disabled condition that replaced it', () => {
    expect(wizard).toMatch(/disabled=\{isBusy \|\| checklist\.blockingMissing > 0\}/);
  });
});
