import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// CORS - restrict to specific origins in production
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["http://localhost:5173", "http://localhost:3000"];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Global error handler middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err, message: err.message, stack: err.stack }, "Unhandled error");

  // Handle Zod validation errors
  if (err.name === "ZodError") {
    return res.status(400).json({
      error: "Invalid request parameters",
      details: err.message,
    });
  }

  // Default error response
  const status = (err as any).status || 500;
  const message =
    status === 500
      ? "An unexpected error occurred. Please try again later."
      : err.message || "An error occurred";

  return res.status(status).json({ error: message });
});

export default app;
