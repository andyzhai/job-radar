// Observed in Indeed Canada's signed-in desktop search UI, 2026-11-01.
export const indeedSelectors = {
  title: "a.jcs-JobTitle[data-jk]",
  card: ".cardOutline",
  company: '[data-testid="company-name"]',
  location: '[data-testid="text-location"]',
  salary: '[data-testid*="salary-snippet-container"]',
  attributes: '[data-testid*="attribute_snippet_testid"]',
  sortDate: 'a[href*="sort=date"]',
  next: '[data-testid="pagination-page-next"]',
  currentPage: '[data-testid="pagination-page-current"]',
  description: ".simple-job-description-html",
  detailTitle: '[data-testid="vj-job-title"]',
  detailSummary: '[data-testid="structured-job-summary"]',
  apply: '[data-testid="viewjob-apply"]',
} as const;
