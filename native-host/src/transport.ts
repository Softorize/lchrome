/**
 * Chrome Native Messaging stdio transport.
 *
 * Chrome's Native Messaging protocol frames each message as:
 *   [4-byte little-endian uint32 length][JSON payload of that length]
 *
 * This module provides helpers to read and write messages in that format
 * over process.stdin / process.stdout.
 */

/** Maximum message size allowed by Chrome Native Messaging (1 MB). */
const MAX_MESSAGE_SIZE = 1024 * 1024;

/**
 * Continuously reads length-prefixed JSON messages from stdin and invokes
 * the callback for each complete message.
 *
 * Handles partial reads / buffering automatically.
 */
export function readMessages(callback: (message: unknown) => void): void {
  let buffer = Buffer.alloc(0);

  process.stdin.on('data', (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);

    // Process as many complete messages as available in the buffer
    while (buffer.length >= 4) {
      const messageLength = buffer.readUInt32LE(0);

      if (messageLength > MAX_MESSAGE_SIZE) {
        writeError(`Message too large: ${messageLength} bytes (max ${MAX_MESSAGE_SIZE})`);
        // Skip this malformed message by clearing the buffer
        buffer = Buffer.alloc(0);
        return;
      }

      // Wait for the full message to arrive
      if (buffer.length < 4 + messageLength) {
        return;
      }

      const jsonBytes = buffer.subarray(4, 4 + messageLength);
      buffer = buffer.subarray(4 + messageLength);

      try {
        const message = JSON.parse(jsonBytes.toString('utf-8'));
        callback(message);
      } catch {
        writeError('Failed to parse JSON message from stdin');
      }
    }
  });

  process.stdin.on('end', () => {
    process.exit(0);
  });
}

/**
 * Writes a JSON message to stdout using the Native Messaging length-prefix
 * framing protocol.
 */
export function writeMessage(message: unknown): void {
  const json = JSON.stringify(message);
  const payload = Buffer.from(json, 'utf-8');

  if (payload.length > MAX_MESSAGE_SIZE) {
    writeError(`Outgoing message too large: ${payload.length} bytes`);
    return;
  }

  const header = Buffer.alloc(4);
  header.writeUInt32LE(payload.length, 0);

  // Write header and payload atomically via a single write to avoid
  // interleaving issues with concurrent messages.
  const frame = Buffer.concat([header, payload]);
  process.stdout.write(frame);
}

/**
 * Convenience: write a JSON-RPC error response to stdout and also log to
 * stderr for debugging.
 */
function writeError(message: string): void {
  process.stderr.write(`[omnichrome-native] ERROR: ${message}\n`);
}

/**
 * Write a log message to stderr (does not interfere with the stdout
 * message protocol).
 */
export function log(message: string): void {
  process.stderr.write(`[omnichrome-native] ${message}\n`);
}
