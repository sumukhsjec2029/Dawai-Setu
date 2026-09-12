import app from "./app";
import { logger } from "./lib/logger";
import { ensureSeedData } from "./lib/seed";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Only seed database if DATABASE_URL is provided and valid
if (process.env.DATABASE_URL) {
  try {
    await ensureSeedData();
  } catch (error) {
    logger.warn({ err: error }, "Database not available, running in mock mode");
  }
} else {
  logger.info("DATABASE_URL not set, running in mock mode");
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
