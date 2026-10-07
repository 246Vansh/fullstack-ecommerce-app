import "dotenv/config";
import { parseTrustProxy } from "./config/env.js";
import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";

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

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
