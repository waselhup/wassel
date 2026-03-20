import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import authRoutes from "./authRoutes";
import linkedinAuthRoutes from "./linkedinAuth";
import linkedinOAuthRoutes from "./linkedinOAuthRoutes";
import inviteRoutes from "./inviteRoutes";
import extensionRoutes from "./extensionRoutes";
import clientRoutes from "./clientRoutes";
import sequenceRoutes from "./sequenceRoutes";
import adminRoutes from "./adminRoutes";
import activityRoutes from "./activityRoutes";
import aiRoutes from "./aiRoutes";
import postRoutes from "./postRoutes";
import stripeRoutes from "./stripeRoutes";
import { appRouter } from "../routers";
import { createContext, expressAuthMiddleware, requireRole } from "./context";

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

// LinkedIn OAuth routes (public — OAuth flow starts unauthenticated)
app.use("/api/linkedin", linkedinOAuthRoutes);

// Admin routes: JWT + super_admin role required
app.use("/api/invites", expressAuthMiddleware, requireRole('super_admin'), inviteRoutes);
app.use("/api/clients", expressAuthMiddleware, requireRole('super_admin'), inviteRoutes);
app.use("/api/admin/clients", expressAuthMiddleware, requireRole('super_admin'), clientRoutes);
app.use("/api/admin", expressAuthMiddleware, requireRole('super_admin'), adminRoutes);

// Extension routes: JWT required (any authenticated user)
app.use("/api/ext", expressAuthMiddleware, extensionRoutes);

// Sequence engine routes: JWT required (any authenticated user)
app.use("/api/sequence", expressAuthMiddleware, sequenceRoutes);

// Activity log routes: JWT required (any authenticated user)
app.use("/api/activity-log", expressAuthMiddleware, activityRoutes);

// AI message writer: JWT required
app.use("/api/ai", expressAuthMiddleware, aiRoutes);

// Posts routes: JWT required
app.use("/api/posts", expressAuthMiddleware, postRoutes);

// Stripe: webhook has NO auth (raw body needed), other routes need auth
app.use("/api/stripe", stripeRoutes);

// User profile routes: self-auth via JWT in Authorization header
import userRoutes from "./userRoutes";
app.use("/api/user", userRoutes);

// Health check endpoint
app.get("/api/health", (_req: any, res: any) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
});

// LinkedIn diagnostic — no auth required
app.get("/api/linkedin-test", (_req: any, res: any) => {
    res.json({
        linkedinRoutes: 'ACTIVE ✅',
        clientId: process.env.LINKEDIN_CLIENT_ID ? 'SET ✅' : 'MISSING ❌',
        secret: process.env.LINKEDIN_CLIENT_SECRET ? 'SET ✅' : 'MISSING ❌',
        redirectUri: process.env.LINKEDIN_REDIRECT_URI || 'MISSING ❌',
        timestamp: new Date().toISOString(),
    });
});

app.use(
    "/api/trpc",
    createExpressMiddleware({
        router: appRouter,
        createContext,
    })
);

export default app;
