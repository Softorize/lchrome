// Form handler - sets values in form elements

export function setFormValue(element: Element, value: unknown): { success: boolean; error?: string } {
  if (element instanceof HTMLInputElement) {
    return setInputValue(element, value);
  }

  if (element instanceof HTMLTextAreaElement) {
    element.value = String(value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return { success: true };
  }

  if (element instanceof HTMLSelectElement) {
    return setSelectValue(element, value);
  }

  if (element.getAttribute('contenteditable') === 'true') {
    (element as HTMLElement).innerText = String(value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    return { success: true };
  }

  return { success: false, error: 'Element is not a form input' };
}

function setInputValue(input: HTMLInputElement, value: unknown): { success: boolean; error?: string } {
  switch (input.type) {
    case 'checkbox':
      input.checked = Boolean(value);
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return { success: true };

    case 'radio':
      input.checked = Boolean(value);
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return { success: true };

    case 'file':
      return { success: false, error: 'Cannot set file input value programmatically' };

    case 'range':
    case 'number':
      input.value = String(Number(value));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return { success: true };

    case 'date':
    case 'time':
    case 'datetime-local':
      input.value = String(value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return { success: true };

    default:
      input.value = String(value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return { success: true };
  }
}

function setSelectValue(
  select: HTMLSelectElement,
  value: unknown,
): { success: boolean; error?: string } {
  const strValue = String(value);

  // Try by value first
  const optionByValue = Array.from(select.options).find((o) => o.value === strValue);
  if (optionByValue) {
    select.value = optionByValue.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return { success: true };
  }

  // Try by text
  const optionByText = Array.from(select.options).find(
    (o) => o.text.toLowerCase() === strValue.toLowerCase(),
  );
  if (optionByText) {
    select.value = optionByText.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return { success: true };
  }

  return { success: false, error: `No option matches value: ${strValue}` };
}
