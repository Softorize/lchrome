// Element interactor - performs click, type, scroll actions on elements

export function clickAtCoordinate(x: number, y: number, button: 'left' | 'right' = 'left'): void {
  const el = document.elementFromPoint(x, y);
  if (!el) return;

  const mouseButton = button === 'right' ? 2 : 0;

  for (const eventType of ['mousedown', 'mouseup', 'click']) {
    el.dispatchEvent(
      new MouseEvent(eventType, {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        button: mouseButton,
      }),
    );
  }
}

export function doubleClickAtCoordinate(x: number, y: number): void {
  const el = document.elementFromPoint(x, y);
  if (!el) return;

  clickAtCoordinate(x, y);
  clickAtCoordinate(x, y);

  el.dispatchEvent(
    new MouseEvent('dblclick', {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
    }),
  );
}

export function tripleClickAtCoordinate(x: number, y: number): void {
  doubleClickAtCoordinate(x, y);
  clickAtCoordinate(x, y);

  // Select all text in the target element
  const el = document.elementFromPoint(x, y);
  if (el && el instanceof HTMLElement) {
    const selection = window.getSelection();
    if (selection) {
      const range = document.createRange();
      range.selectNodeContents(el);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }
}

export function typeText(target: Element | null, text: string): void {
  if (!target) return;

  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    target.focus();
    target.value = text;
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
  } else if (target instanceof HTMLElement) {
    target.focus();
    document.execCommand('insertText', false, text);
  }
}

export function scrollElement(
  target: Element | null,
  direction: 'up' | 'down' | 'left' | 'right',
  amount = 3,
): void {
  const scrollTarget = target ?? document.documentElement;
  const pixels = amount * 100;

  switch (direction) {
    case 'up':
      scrollTarget.scrollBy({ top: -pixels, behavior: 'smooth' });
      break;
    case 'down':
      scrollTarget.scrollBy({ top: pixels, behavior: 'smooth' });
      break;
    case 'left':
      scrollTarget.scrollBy({ left: -pixels, behavior: 'smooth' });
      break;
    case 'right':
      scrollTarget.scrollBy({ left: pixels, behavior: 'smooth' });
      break;
  }
}

export function hoverElement(target: Element | null, x?: number, y?: number): void {
  const el = target ?? (x !== undefined && y !== undefined ? document.elementFromPoint(x, y) : null);
  if (!el) return;

  el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: x ?? 0, clientY: y ?? 0 }));
  el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, clientX: x ?? 0, clientY: y ?? 0 }));
}

export function dragElement(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): void {
  const startEl = document.elementFromPoint(startX, startY);
  if (!startEl) return;

  startEl.dispatchEvent(
    new MouseEvent('mousedown', { bubbles: true, clientX: startX, clientY: startY }),
  );

  // Simulate drag
  const steps = 10;
  for (let i = 0; i <= steps; i++) {
    const x = startX + ((endX - startX) * i) / steps;
    const y = startY + ((endY - startY) * i) / steps;
    startEl.dispatchEvent(
      new MouseEvent('mousemove', { bubbles: true, clientX: x, clientY: y }),
    );
  }

  const endEl = document.elementFromPoint(endX, endY) ?? startEl;
  endEl.dispatchEvent(
    new MouseEvent('mouseup', { bubbles: true, clientX: endX, clientY: endY }),
  );
}
