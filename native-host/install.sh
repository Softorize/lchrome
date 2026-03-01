#!/usr/bin/env bash
#
# OmniChrome Native Messaging Host installer.
#
# Registers the native messaging host manifest so that Chrome can locate and
# launch the native host when the extension calls
# chrome.runtime.connectNative('com.omnichrome.native').
#
# Usage:
#   ./install.sh [--extension-id <EXTENSION_ID>]
#
# If --extension-id is not provided, a wildcard origin is NOT used; instead
# the script will print an error. You must supply the real extension ID
# found at chrome://extensions.

set -euo pipefail

# ---- Defaults ----

HOST_NAME="com.omnichrome.native"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOST_EXEC="${SCRIPT_DIR}/dist/main.js"
EXTENSION_ID=""

# ---- Parse arguments ----

while [[ $# -gt 0 ]]; do
  case "$1" in
    --extension-id)
      EXTENSION_ID="$2"
      shift 2
      ;;
    --extension-id=*)
      EXTENSION_ID="${1#*=}"
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [--extension-id <EXTENSION_ID>]"
      echo ""
      echo "Installs the OmniChrome native messaging host manifest."
      echo ""
      echo "Options:"
      echo "  --extension-id ID   Chrome extension ID (from chrome://extensions)"
      echo "  -h, --help          Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Run '$0 --help' for usage."
      exit 1
      ;;
  esac
done

if [[ -z "$EXTENSION_ID" ]]; then
  echo "Error: --extension-id is required."
  echo ""
  echo "You can find the extension ID by:"
  echo "  1. Open chrome://extensions"
  echo "  2. Enable Developer mode"
  echo "  3. Find OmniChrome and copy its ID"
  echo ""
  echo "Usage: $0 --extension-id <EXTENSION_ID>"
  exit 1
fi

# ---- Determine manifest directory ----

case "$(uname -s)" in
  Darwin)
    MANIFEST_DIR="${HOME}/Library/Application Support/Google/Chrome/NativeMessagingHosts"
    ;;
  Linux)
    MANIFEST_DIR="${HOME}/.config/google-chrome/NativeMessagingHosts"
    ;;
  *)
    echo "Unsupported platform: $(uname -s)"
    echo "This script supports macOS and Linux only."
    exit 1
    ;;
esac

# ---- Build if needed ----

if [[ ! -f "$HOST_EXEC" ]]; then
  echo "Built artifacts not found. Building native host..."
  (cd "$SCRIPT_DIR" && npm install && npm run build)
fi

# ---- Create wrapper script ----
#
# Chrome launches native hosts directly; it does not use a shell.  We need
# a wrapper that invokes Node.js with the compiled JS entry point.

WRAPPER="${SCRIPT_DIR}/omnichrome-native-host"

cat > "$WRAPPER" << WRAPPER_EOF
#!/usr/bin/env bash
# Auto-generated wrapper for OmniChrome native messaging host.
# Do not edit -- re-run install.sh to regenerate.
exec node "${HOST_EXEC}" "\$@"
WRAPPER_EOF

chmod +x "$WRAPPER"
echo "Created wrapper script: ${WRAPPER}"

# ---- Write manifest ----

mkdir -p "$MANIFEST_DIR"

MANIFEST_PATH="${MANIFEST_DIR}/${HOST_NAME}.json"

cat > "$MANIFEST_PATH" << MANIFEST_EOF
{
  "name": "${HOST_NAME}",
  "description": "OmniChrome browser automation native messaging host",
  "path": "${WRAPPER}",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://${EXTENSION_ID}/"
  ]
}
MANIFEST_EOF

echo "Installed native messaging host manifest:"
echo "  ${MANIFEST_PATH}"
echo ""
echo "Manifest contents:"
cat "$MANIFEST_PATH"
echo ""
echo ""
echo "Installation complete!"
echo "  Host name:    ${HOST_NAME}"
echo "  Extension ID: ${EXTENSION_ID}"
echo "  Host path:    ${WRAPPER}"
echo ""
echo "Restart Chrome for the changes to take effect."
