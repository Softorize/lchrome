export const TOOL_NAMES = {
  SCREENSHOT: 'screenshot',
  READ_PAGE: 'read_page',
  COMPUTER: 'computer',
  NAVIGATE: 'navigate',
  FORM_INPUT: 'form_input',
  FIND: 'find',
  JAVASCRIPT: 'javascript',
  GET_PAGE_TEXT: 'get_page_text',
  CONSOLE_MONITOR: 'console_monitor',
  NETWORK_MONITOR: 'network_monitor',
  GIF_RECORDER: 'gif_recorder',
  TAB_MANAGEMENT: 'tab_management',
} as const;

export const TOOL_CATEGORIES = {
  inspection: [TOOL_NAMES.SCREENSHOT, TOOL_NAMES.READ_PAGE, TOOL_NAMES.GET_PAGE_TEXT, TOOL_NAMES.FIND],
  interaction: [TOOL_NAMES.COMPUTER, TOOL_NAMES.NAVIGATE, TOOL_NAMES.FORM_INPUT, TOOL_NAMES.JAVASCRIPT],
  monitoring: [TOOL_NAMES.CONSOLE_MONITOR, TOOL_NAMES.NETWORK_MONITOR],
  recording: [TOOL_NAMES.GIF_RECORDER],
  management: [TOOL_NAMES.TAB_MANAGEMENT],
} as const;
