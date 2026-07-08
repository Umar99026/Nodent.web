/** Scroll an element into view inside AppShell's ScrollArea viewport (not window). */
export function scrollWithinAppShell(
  element: HTMLElement | null,
  opts?: { behavior?: ScrollBehavior; offset?: number },
) {
  if (!element) return;

  const behavior = opts?.behavior ?? "instant";
  const offset = opts?.offset ?? 16;
  const viewport = element.closest('[data-slot="scroll-area-viewport"]');

  if (viewport instanceof HTMLElement) {
    const viewportRect = viewport.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    const targetTop =
      elementRect.top - viewportRect.top + viewport.scrollTop - offset;
    viewport.scrollTo({ top: Math.max(0, targetTop), behavior });
    return;
  }

  element.scrollIntoView({ block: "start", behavior });
}
