/**
 * Budgets as code.
 *
 * Performance and accessibility decay quietly: a banner, an app embed, an
 * extra font, and a store that passed last quarter now fails. These are the
 * numbers this framework treats as non-negotiable, and the reason attached to
 * each one — so a failure in CI explains itself instead of being waived.
 */

export interface Budget {
  id: string;
  label: string;
  target: number;
  /** "max" for ceilings, "min" for floors. */
  direction: "max" | "min";
  unit: string;
  because: string;
}

export const BUDGETS: Budget[] = [
  { id: "lcp", label: "Largest Contentful Paint", target: 2000, direction: "max", unit: "ms", because: "product images are the LCP element on most product pages; slow LCP is lost revenue" },
  { id: "inp", label: "Interaction to Next Paint", target: 200, direction: "max", unit: "ms", because: "filters and add-to-cart must feel instant on a mid-range phone" },
  { id: "cls", label: "Cumulative Layout Shift", target: 0.05, direction: "max", unit: "", because: "a basket that jumps under a thumb causes mis-taps and abandonments" },
  { id: "jsKb", label: "JavaScript shipped", target: 120, direction: "max", unit: "kB", because: "every app embed loads before the first paint" },
  { id: "imageKb", label: "Largest image", target: 200, direction: "max", unit: "kB", because: "oversized hero and product images are the usual cause of a slow shop" },
  { id: "requests", label: "Requests on first load", target: 40, direction: "max", unit: "", because: "third-party reviews, chat and loyalty widgets each add one" },
  { id: "contrast", label: "Text contrast ratio", target: 4.5, direction: "min", unit: ":1", because: "WCAG 2.2 AA, and the most common failure in retail checkout" },
  { id: "targetSize", label: "Smallest tap target", target: 24, direction: "min", unit: "px", because: "WCAG 2.2 AA minimum; thumbs are not mice" },
];

export type Metrics = Record<string, number>;

export interface BudgetFailure {
  budget: Budget;
  actual: number;
  because: string;
}

/** Unknown metrics are reported rather than assumed to pass. */
export function checkBudgets(metrics: Metrics): { failures: BudgetFailure[]; missing: Budget[] } {
  const failures: BudgetFailure[] = [];
  const missing: Budget[] = [];
  for (const budget of BUDGETS) {
    const actual = metrics[budget.id];
    if (actual === undefined) {
      missing.push(budget);
      continue;
    }
    const over = budget.direction === "max" ? actual > budget.target : actual < budget.target;
    if (over) failures.push({ budget, actual, because: budget.because });
  }
  return { failures, missing };
}

/** A one-line verdict for a pull request comment or a dashboard tile. */
export function verdict(metrics: Metrics): string {
  const { failures, missing } = checkBudgets(metrics);
  if (missing.length) return `Not measured: ${missing.map((budget) => budget.label).join(", ")}.`;
  if (!failures.length) return "Within budget on every measure.";
  return failures
    .map(({ budget, actual }) => `${budget.label} ${actual}${budget.unit} (target ${budget.target}${budget.unit})`)
    .join("; ");
}

/**
 * The accessibility checks that automated tooling reliably catches, listed so
 * a build can fail on them rather than discovering them in a complaint.
 */
export interface A11yFinding {
  where: string;
  problem: string;
  wcag: string;
}

export function auditMarkup(elements: {
  buttons: { label: string; sizePx: number }[];
  images: { src: string; alt: string }[];
  inputs: { name: string; label: string; errorDescribed: boolean }[];
}): A11yFinding[] {
  const findings: A11yFinding[] = [];
  for (const button of elements.buttons) {
    if (!button.label.trim()) findings.push({ where: "button", problem: "button has no accessible name", wcag: "4.1.2" });
    if (button.sizePx < 24) findings.push({ where: `button "${button.label}"`, problem: `${button.sizePx}px tap target`, wcag: "2.5.8" });
  }
  for (const image of elements.images) {
    const decorative = image.alt === "" && /(spacer|divider|bg)/i.test(image.src);
    if (!image.alt.trim() && !decorative) {
      findings.push({ where: image.src, problem: "image has no alt text", wcag: "1.1.1" });
    }
  }
  for (const input of elements.inputs) {
    if (!input.label.trim()) findings.push({ where: input.name, problem: "input has no label", wcag: "3.3.2" });
    if (!input.errorDescribed) findings.push({ where: input.name, problem: "validation error is visual only", wcag: "3.3.1" });
  }
  return findings;
}
