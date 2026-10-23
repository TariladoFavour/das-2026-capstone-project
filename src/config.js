// Server configuration.
// Port is configured via PORT environment variable, defaulting to 3000.

const rawPort = process.env.PORT;
export const PORT = rawPort === undefined || rawPort === '' ? 3000 : Number(rawPort);

if (!Number.isInteger(PORT) || PORT < 0 || PORT > 65535) {
  throw new RangeError('PORT must be an integer between 0 and 65535');
}
