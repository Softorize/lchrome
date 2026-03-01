// Page reader - builds accessibility tree from DOM
// This is a standalone module imported by bridge.ts

export interface A11yNode {
  ref?: string;
  role: string;
  name?: string;
  value?: string;
  checked?: boolean;
  disabled?: boolean;
  expanded?: boolean;
  text?: string;
  children?: A11yNode[];
}

export function buildA11yTree(
  root: Element,
  maxDepth = 15,
  maxChars = 50000,
  interactiveOnly = false,
): { tree: A11yNode; charCount: number } {
  let charCount = 0;

  function traverse(element: Element, depth: number): A11yNode | null {
    if (depth > maxDepth || charCount > maxChars) return null;

    const tag = element.tagName.toLowerCase();
    const role = element.getAttribute('role') || tagToRole(tag, element);
    const isInteractive = isInteractiveEl(element);

    if (interactiveOnly && !isInteractive && !hasInteractiveChild(element)) {
      return null;
    }

    const node: A11yNode = { role };

    const name = getAccessibleName(element);
    if (name) {
      node.name = name.slice(0, 200);
      charCount += node.name.length;
    }

    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      if (element.value) {
        node.value = element.value.slice(0, 200);
        charCount += node.value.length;
      }
    }

    if (element instanceof HTMLInputElement) {
      if (element.type === 'checkbox' || element.type === 'radio') {
        node.checked = element.checked;
      }
      if (element.disabled) node.disabled = true;
    }

    const children: A11yNode[] = [];
    for (const child of element.children) {
      if (charCount > maxChars) break;
      const childNode = traverse(child, depth + 1);
      if (childNode) children.push(childNode);
    }

    // Capture text nodes
    for (const child of element.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent?.trim();
        if (text && text.length > 0) {
          const truncated = text.slice(0, 200);
          children.push({ role: 'text', text: truncated });
          charCount += truncated.length;
        }
      }
    }

    if (children.length > 0) node.children = children;

    return node;
  }

  const tree = traverse(root, 0) ?? { role: 'document' };
  return { tree, charCount };
}

function tagToRole(tag: string, el: Element): string {
  const map: Record<string, string> = {
    a: 'link', button: 'button', input: (el as HTMLInputElement).type || 'textbox',
    select: 'combobox', textarea: 'textbox', img: 'img', nav: 'navigation',
    main: 'main', header: 'banner', footer: 'contentinfo', form: 'form',
    table: 'table', ul: 'list', ol: 'list', li: 'listitem',
    h1: 'heading', h2: 'heading', h3: 'heading', h4: 'heading', h5: 'heading', h6: 'heading',
    section: 'region', article: 'article', aside: 'complementary', dialog: 'dialog',
  };
  return map[tag] || tag;
}

function getAccessibleName(el: Element): string {
  return (
    el.getAttribute('aria-label') ||
    el.getAttribute('title') ||
    el.getAttribute('alt') ||
    el.getAttribute('placeholder') ||
    ''
  );
}

function isInteractiveEl(el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  if (['a', 'button', 'input', 'select', 'textarea'].includes(tag)) return true;
  if (el.getAttribute('role') === 'button') return true;
  if (el.getAttribute('tabindex')) return true;
  if (el.getAttribute('contenteditable') === 'true') return true;
  return false;
}

function hasInteractiveChild(el: Element): boolean {
  return !!el.querySelector(
    'a, button, input, select, textarea, [role="button"], [tabindex], [contenteditable="true"]',
  );
}
