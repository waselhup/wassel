import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "../server/_core/oauth";
import authRoutes from "../server/_core/authRoutes";
import { appRouter } from "../server/routers";
import { createContext } from "../server/_core/context";
import cors from "cors";

const app = express();

// Increase JSON limits and handle URL encoding
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Enable CORS if needed for Vercel functions boundary
app.use(cors({ origin: process.env.VITE_FRONTEND_URL || true, credentials: true }));

// Express routing
registerOAuthRoutes(app);
app.use("/api/auth", authRoutes);

// tRPC API
app.use(
    "/api/trpc",
    createExpressMiddleware({
        router: appRouter,
        createContext,
    })
);

export default app;
