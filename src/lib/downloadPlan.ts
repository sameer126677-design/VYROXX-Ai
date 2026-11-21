/**
 * Downloads the scene plan currently shown in the preview as a pretty-printed JSON file.
 * Pure client-side: no network call, no tokens, no user ids (the plan object only).
 */
export function slugifyForFilename(input: string, fallback = 'vyroxx'): string {
  const slug = String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || fallback;
}

export function downloadScenePlanJson(plan: unknown, titleHint?: string): void {
  const name = `${slugifyForFilename(titleHint ?? '')}-plan.json`;
  const json = JSON.stringify(plan, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
