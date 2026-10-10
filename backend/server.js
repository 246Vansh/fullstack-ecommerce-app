import "dotenv/config";
import { parseTrustProxy } from "./config/env.js";
import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";

import prisma from "./config/db.js";
import apiRouter from "./routes/index.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";
import { generalLimiter } from "./middleware/rateLimits.js";

const app = express();
const PORT = process.env.PORT || 5000;

// Off unless TRUST_PROXY names the proxies in front of the app; otherwise
// X-Forwarded-For is ignored so clients cannot pick their rate-limit IP.
app.set("trust proxy", parseTrustProxy(process.env.TRUST_PROXY));

app.use(helmet());
app.use(cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
}));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/api", generalLimiter);

app.use("/api", apiRouter);

app.use(notFound);
app.use(errorHandler);

const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// SIGTERM (process managers, containers) and SIGINT (Ctrl+C): stop accepting
// connections, let in-flight requests finish, then close the database pool.
// nodemon restarts the dev server with SIGUSR2, which is left alone.
const SHUTDOWN_TIMEOUT_MS = 10000;
let shuttingDown = false;

function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log(`${signal} received, shutting down`);

    // Requests still running after the timeout are cut off.
    setTimeout(() => {
        console.error("Shutdown timed out, forcing exit");
        process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS).unref();

    server.close(async (err) => {
        await prisma.$disconnect().catch(() => {});
        process.exit(err ? 1 : 0);
    });

    // Keep-alive connections with no request in flight would hold close() open.
    server.closeIdleConnections();
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
