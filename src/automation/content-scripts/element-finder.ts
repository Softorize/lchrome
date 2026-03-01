// Element finder - searches DOM elements by natural language query

export interface FoundElement {
  ref: string;
  tagName: string;
  role: string;
  text: string;
  ariaLabel?: string;
  bounds: { x: number; y: number; width: number; height: number };
}

export function findElements(query: string, maxResults = 20): FoundElement[] {
  const results: FoundElement[] = [];
  const queryLower = query.toLowerCase();
  const allElements = document.querySelectorAll('*');

  for (const el of allElements) {
    if (results.length >= maxResults) break;
    if (!isVisible(el)) continue;

    const score = matchScore(el, queryLower);
    if (score > 0) {
      const rect = el.getBoundingClientRect();
      results.push({
        ref: '', // Will be assigned by bridge
        tagName: el.tagName.toLowerCase(),
        role: el.getAttribute('role') || el.tagName.toLowerCase(),
        text: (el.textContent?.trim() || '').slice(0, 100),
        ariaLabel: el.getAttribute('aria-label') || undefined,
        bounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      });
    }
  }

  return results;
}

function matchScore(el: Element, query: string): number {
  let score = 0;
  const tag = el.tagName.toLowerCase();
  const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
  const title = (el.getAttribute('title') || '').toLowerCase();
  const placeholder = (el.getAttribute('placeholder') || '').toLowerCase();
  const text = (el.textContent?.trim() || '').toLowerCase();
  const role = (el.getAttribute('role') || '').toLowerCase();

  // Direct matches
  if (ariaLabel.includes(query)) score += 10;
  if (title.includes(query)) score += 8;
  if (placeholder.includes(query)) score += 7;
  if (role.includes(query)) score += 6;
  if (tag.includes(query)) score += 5;

  // Text content match (lower priority since it can be inherited)
  if (text.includes(query) && text.length < 200) score += 3;

  // Role-based queries
  const roleQueries: Record<string, string[]> = {
    'search': ['input[type="search"]', '[role="search"]', '[aria-label*="search"]'],
    'login': ['[type="submit"]', 'button', '[role="button"]'],
    'button': ['button', '[role="button"]', 'input[type="button"]'],
    'link': ['a', '[role="link"]'],
    'input': ['input', 'textarea', '[contenteditable]'],
    'menu': ['nav', '[role="menu"]', '[role="navigation"]'],
  };

  for (const [keyword, selectors] of Object.entries(roleQueries)) {
    if (query.includes(keyword)) {
      for (const selector of selectors) {
        if (el.matches(selector)) {
          score += 5;
          break;
        }
      }
    }
  }

  return score;
}

function isVisible(el: Element): boolean {
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}
