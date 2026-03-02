import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import authRoutes from "./authRoutes";
import linkedinAuthRoutes from "./linkedinAuth";
import inviteRoutes from "./inviteRoutes";
import extensionRoutes from "./extensionRoutes";
import { appRouter } from "../routers";
import { createContext } from "./context";
import cors from "cors";

// We import node fetch here implicitly if needed or use specific middleware setup
const app = express();

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Handle CORS for Vercel
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', process.env.VITE_FRONTEND_URL || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization');
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});

registerOAuthRoutes(app);
app.use("/api/auth", authRoutes);
app.use("/api/auth/linkedin", linkedinAuthRoutes);
app.use("/api/invites", inviteRoutes);
app.use("/api/clients", inviteRoutes);
app.use("/api/ext", extensionRoutes);

// Health check endpoint
app.get("/api/health", (_req: any, res: any) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.use(
    "/api/trpc",
    createExpressMiddleware({
        router: appRouter,
        createContext,
    })
);

export default app;
