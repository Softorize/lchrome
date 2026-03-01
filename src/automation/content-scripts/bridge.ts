import type { ContentScriptMessage } from '@/types/messages';

// Content script bridge - injected into web pages
// Handles messages from the background service worker

const refMap = new Map<string, Element>();
let refCounter = 0;

function assignRef(element: Element): string {
  const existing = Array.from(refMap.entries()).find(([, el]) => el === element);
  if (existing) return existing[0];

  const ref = `ref_${++refCounter}`;
  refMap.set(ref, element);
  return ref;
}

function getElement(ref: string): Element | null {
  return refMap.get(ref) ?? null;
}

function clearRefs(): void {
  refMap.clear();
  refCounter = 0;
}

// Listen for messages from background
chrome.runtime.onMessage.addListener((message: ContentScriptMessage, _sender, sendResponse) => {
  handleMessage(message)
    .then(sendResponse)
    .catch((error) => {
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    });
  return true;
});

async function handleMessage(message: ContentScriptMessage): Promise<unknown> {
  switch (message.action) {
    case 'readPage':
      return readPage(message.payload as { depth?: number; filter?: string; refId?: string });

    case 'findElement':
      return findElement(message.payload as { query: string });

    case 'interact':
      return interact(message.payload as {
        action: string;
        coordinate?: [number, number];
        ref?: string;
        text?: string;
        scrollDirection?: string;
        scrollAmount?: number;
        modifiers?: string;
      });

    case 'formInput':
      return formInput(message.payload as { ref: string; value: unknown });

    case 'getText':
      return getText();

    case 'clearRefs':
      clearRefs();
      return { success: true };

    default:
      throw new Error(`Unknown action: ${message.action}`);
  }
}

function readPage(options: { depth?: number; filter?: string; refId?: string }) {
  const maxDepth = options.depth ?? 15;
  const filter = options.filter ?? 'all';
  const startElement = options.refId ? getElement(options.refId) : document.body;

  if (!startElement) {
    return { error: 'Start element not found' };
  }

  const tree = buildAccessibilityTree(startElement, 0, maxDepth, filter === 'interactive');
  return { tree, refCount: refCounter };
}

function buildAccessibilityTree(
  element: Element,
  depth: number,
  maxDepth: number,
  interactiveOnly: boolean,
): unknown {
  if (depth > maxDepth) return null;

  const role = getRole(element);
  const isInteractive = isInteractiveElement(element);

  if (interactiveOnly && !isInteractive && !hasInteractiveDescendant(element)) {
    return null;
  }

  const ref = isInteractive ? assignRef(element) : undefined;
  const node: Record<string, unknown> = {};

  if (ref) node.ref = ref;
  if (role) node.role = role;

  const name = getAccessibleName(element);
  if (name) node.name = name;

  const value = getElementValue(element);
  if (value) node.value = value;

  if (element instanceof HTMLInputElement) {
    if (element.type === 'checkbox' || element.type === 'radio') {
      node.checked = element.checked;
    }
    if (element.disabled) node.disabled = true;
  }

  if (element instanceof HTMLSelectElement) {
    node.value = element.value;
  }

  const children: unknown[] = [];
  for (const child of element.children) {
    const childNode = buildAccessibilityTree(child, depth + 1, maxDepth, interactiveOnly);
    if (childNode) children.push(childNode);
  }

  // Include text nodes
  for (const node2 of element.childNodes) {
    if (node2.nodeType === Node.TEXT_NODE) {
      const text = node2.textContent?.trim();
      if (text) {
        children.push({ text });
      }
    }
  }

  if (children.length > 0) node.children = children;
  if (Object.keys(node).length === 0) return null;

  return node;
}

function getRole(element: Element): string {
  const ariaRole = element.getAttribute('role');
  if (ariaRole) return ariaRole;

  const tag = element.tagName.toLowerCase();
  const roleMap: Record<string, string> = {
    a: 'link',
    button: 'button',
    input: (element as HTMLInputElement).type || 'textbox',
    select: 'combobox',
    textarea: 'textbox',
    img: 'img',
    nav: 'navigation',
    main: 'main',
    header: 'banner',
    footer: 'contentinfo',
    form: 'form',
    table: 'table',
    ul: 'list',
    ol: 'list',
    li: 'listitem',
    h1: 'heading',
    h2: 'heading',
    h3: 'heading',
    h4: 'heading',
    h5: 'heading',
    h6: 'heading',
  };

  return roleMap[tag] ?? tag;
}

function getAccessibleName(element: Element): string {
  return (
    element.getAttribute('aria-label') ??
    element.getAttribute('title') ??
    element.getAttribute('alt') ??
    element.getAttribute('placeholder') ??
    (element.tagName === 'LABEL' ? element.textContent?.trim() : null) ??
    ''
  );
}

function getElementValue(element: Element): string {
  if (element instanceof HTMLInputElement) return element.value;
  if (element instanceof HTMLTextAreaElement) return element.value;
  if (element instanceof HTMLSelectElement) return element.value;
  return '';
}

function isInteractiveElement(element: Element): boolean {
  const tag = element.tagName.toLowerCase();
  const interactiveTags = ['a', 'button', 'input', 'select', 'textarea'];
  if (interactiveTags.includes(tag)) return true;
  if (element.getAttribute('role') === 'button') return true;
  if (element.getAttribute('tabindex')) return true;
  if (element.getAttribute('onclick')) return true;
  if (element.getAttribute('contenteditable') === 'true') return true;
  return false;
}

function hasInteractiveDescendant(element: Element): boolean {
  return !!element.querySelector('a, button, input, select, textarea, [role="button"], [tabindex], [onclick], [contenteditable="true"]');
}

function findElement(options: { query: string }) {
  const { query } = options;
  const results: unknown[] = [];
  const allElements = document.querySelectorAll('*');

  const queryLower = query.toLowerCase();

  for (const el of allElements) {
    if (!isVisible(el)) continue;

    const text = el.textContent?.trim().toLowerCase() ?? '';
    const ariaLabel = el.getAttribute('aria-label')?.toLowerCase() ?? '';
    const title = el.getAttribute('title')?.toLowerCase() ?? '';
    const placeholder = el.getAttribute('placeholder')?.toLowerCase() ?? '';
    const role = el.getAttribute('role')?.toLowerCase() ?? '';
    const tag = el.tagName.toLowerCase();

    const matches =
      text.includes(queryLower) ||
      ariaLabel.includes(queryLower) ||
      title.includes(queryLower) ||
      placeholder.includes(queryLower) ||
      role.includes(queryLower) ||
      tag.includes(queryLower);

    if (matches) {
      const ref = assignRef(el);
      const rect = el.getBoundingClientRect();
      results.push({
        ref,
        tagName: tag,
        role: getRole(el),
        text: (el.textContent?.trim() ?? '').slice(0, 100),
        ariaLabel: el.getAttribute('aria-label'),
        bounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      });

      if (results.length >= 20) break;
    }
  }

  return { elements: results };
}

function interact(options: {
  action: string;
  coordinate?: [number, number];
  ref?: string;
  text?: string;
  scrollDirection?: string;
  scrollAmount?: number;
  modifiers?: string;
}) {
  const { action, coordinate, ref, text, scrollDirection, scrollAmount } = options;

  let target: Element | null = null;

  if (ref) {
    target = getElement(ref);
  } else if (coordinate) {
    target = document.elementFromPoint(coordinate[0], coordinate[1]);
  }

  switch (action) {
    case 'click':
    case 'left_click': {
      if (target) {
        (target as HTMLElement).click();
      } else if (coordinate) {
        simulateClick(coordinate[0], coordinate[1]);
      }
      return { success: true };
    }

    case 'type': {
      if (target && text) {
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
          target.value = text;
          target.dispatchEvent(new Event('input', { bubbles: true }));
          target.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          (target as HTMLElement).focus();
          document.execCommand('insertText', false, text);
        }
      }
      return { success: true };
    }

    case 'scroll': {
      const dir = scrollDirection ?? 'down';
      const amount = (scrollAmount ?? 3) * 100;
      const scrollTarget = target ?? document.documentElement;

      switch (dir) {
        case 'up':
          scrollTarget.scrollBy(0, -amount);
          break;
        case 'down':
          scrollTarget.scrollBy(0, amount);
          break;
        case 'left':
          scrollTarget.scrollBy(-amount, 0);
          break;
        case 'right':
          scrollTarget.scrollBy(amount, 0);
          break;
      }
      return { success: true };
    }

    case 'hover': {
      if (target || coordinate) {
        const el = target ?? document.elementFromPoint(coordinate![0], coordinate![1]);
        if (el) {
          el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
          el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        }
      }
      return { success: true };
    }

    default:
      return { success: false, error: `Unknown action: ${action}` };
  }
}

function simulateClick(x: number, y: number): void {
  const el = document.elementFromPoint(x, y);
  if (!el) return;

  const events = ['mousedown', 'mouseup', 'click'];
  for (const eventType of events) {
    el.dispatchEvent(
      new MouseEvent(eventType, {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
      }),
    );
  }
}

function formInput(options: { ref: string; value: unknown }) {
  const element = getElement(options.ref);
  if (!element) {
    return { success: false, error: 'Element not found' };
  }

  if (element instanceof HTMLInputElement) {
    const type = element.type;
    if (type === 'checkbox' || type === 'radio') {
      element.checked = Boolean(options.value);
    } else {
      element.value = String(options.value);
    }
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  } else if (element instanceof HTMLSelectElement) {
    element.value = String(options.value);
    element.dispatchEvent(new Event('change', { bubbles: true }));
  } else if (element instanceof HTMLTextAreaElement) {
    element.value = String(options.value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  return { success: true };
}

function getText(): { text: string } {
  // Try to extract main content first
  const article = document.querySelector('article');
  const main = document.querySelector('main');
  const body = document.body;

  const target = article ?? main ?? body;
  const text = target.innerText ?? target.textContent ?? '';
  return { text: text.trim() };
}

function isVisible(element: Element): boolean {
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}
