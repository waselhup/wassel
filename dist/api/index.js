var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// server/_core/vercel.ts
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
  statusCode;
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? ""
};

// server/_core/sdk.ts
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  client;
  decodeState(state) {
    const redirectUri = atob(state);
    return redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    const user = {
      id: session.openId,
      openId: session.openId,
      name: session.name,
      email: null,
      role: "user"
    };
    return user;
  }
};
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app2) {
  app2.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/_core/authRoutes.ts
import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
var router = Router();
function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
router.post("/magic-link", async (req, res) => {
  const supabase3 = getSupabase();
  try {
    const { email } = req.body;
    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0645\u0637\u0644\u0648\u0628" });
    }
    const origin = req.get("origin") || process.env.VITE_FRONTEND_URL || process.env.APP_URL || "https://wassel-alpha.vercel.app";
    const redirectUrl = `${origin}/auth/callback`;
    const { error } = await supabase3.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectUrl
      }
    });
    if (error) {
      console.error("Magic link error:", error);
      const errMsg = (error.message || "").toLowerCase();
      if (errMsg.includes("rate") || errMsg.includes("exceeded") || errMsg.includes("too many") || error.status === 429) {
        return res.status(429).json({
          error: "\u062A\u0645 \u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 \u0644\u0639\u062F\u062F \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0627\u062A. \u0627\u0644\u0631\u062C\u0627\u0621 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 \u062F\u0642\u064A\u0642\u0629 \u0642\u0628\u0644 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649.",
          rateLimited: true
        });
      }
      return res.status(400).json({ error: error.message || "\u0641\u0634\u0644 \u0625\u0631\u0633\u0627\u0644 \u0631\u0627\u0628\u0637 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644" });
    }
    res.json({ success: true, message: "\u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u0631\u0627\u0628\u0637 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644" });
  } catch (error) {
    console.error("Magic link endpoint error:", error);
    res.status(500).json({ error: "\u062D\u062F\u062B \u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645" });
  }
});
router.post("/verify-otp", async (req, res) => {
  const supabase3 = getSupabase();
  try {
    const { email, token, type = "magiclink" } = req.body;
    if (!email || !token) {
      return res.status(400).json({ error: "\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0648\u0627\u0644\u0631\u0645\u0632 \u0645\u0637\u0644\u0648\u0628\u0627\u0646" });
    }
    const { data, error } = await supabase3.auth.verifyOtp({
      email,
      token,
      type: type === "magiclink" ? "magiclink" : "email"
    });
    if (error) {
      console.error("OTP verification error:", error);
      return res.status(400).json({ error: error.message || "\u0641\u0634\u0644 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u0631\u0645\u0632" });
    }
    if (!data.session) {
      return res.status(400).json({ error: "\u0641\u0634\u0644 \u0625\u0646\u0634\u0627\u0621 \u062C\u0644\u0633\u0629" });
    }
    res.json({
      success: true,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        user: {
          id: data.user?.id,
          email: data.user?.email
        }
      }
    });
  } catch (error) {
    console.error("OTP verification endpoint error:", error);
    res.status(500).json({ error: "\u062D\u062F\u062B \u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645" });
  }
});
router.post("/extension-token", async (req, res) => {
  const supabase3 = getSupabase();
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const jwt2 = authHeader.replace("Bearer ", "");
    const { data: { user: authUser }, error: authError } = await supabase3.auth.getUser(jwt2);
    if (authError || !authUser) {
      return res.status(401).json({ error: "Invalid or expired session" });
    }
    const { data: profile } = await supabase3.from("profiles").select("role").eq("id", authUser.id).single();
    const role = profile?.role || "client_user";
    const { data: membership } = await supabase3.from("team_members").select("team_id").eq("user_id", authUser.id).limit(1).single();
    const teamId = membership?.team_id || null;
    const { target_client_id } = req.body || {};
    if (target_client_id && role !== "super_admin") {
      return res.status(403).json({ error: "Only admins can use operate-as-client mode" });
    }
    const crypto3 = __require("crypto");
    const expiresAt = Math.floor(Date.now() / 1e3) + 3600;
    const payload = {
      userId: authUser.id,
      email: authUser.email,
      role,
      teamId,
      targetClientId: target_client_id || null,
      exp: expiresAt,
      iss: "wassel-ext"
    };
    const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || "wassel-ext-secret";
    const signature = crypto3.createHmac("sha256", secret).update(payloadBase64).digest("base64url");
    const extensionToken = `${payloadBase64}.${signature}`;
    console.log(`[Auth] EXTENSION_TOKEN_OK user=${authUser.id.substring(0, 8)}... role=${role} target_client=${target_client_id || "none"}`);
    res.json({
      token: extensionToken,
      expiresAt: new Date(expiresAt * 1e3).toISOString(),
      userId: authUser.id,
      email: authUser.email,
      role,
      teamId,
      targetClientId: target_client_id || null
    });
  } catch (error) {
    console.error("[Auth] Extension token error:", error.message || error);
    res.status(500).json({ error: "Server error" });
  }
});
var authRoutes_default = router;

// server/_core/linkedinAuth.ts
import { Router as Router2 } from "express";
import { randomBytes as randomBytes2 } from "crypto";

// server/supabase.ts
import { createClient as createClient2 } from "@supabase/supabase-js";
var supabaseUrl = process.env.SUPABASE_URL || "https://placeholder.supabase.co";
var supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-key";
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn("[Supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY \u2014 using placeholders");
}
var supabase = createClient2(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// server/_core/encryption.ts
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
var ALGORITHM = "aes-256-gcm";
var IV_LENGTH = 16;
var TAG_LENGTH = 16;
function getKey() {
  let key = process.env.ENCRYPTION_KEY || "";
  key = key.trim();
  if (!key || key.length !== 64) {
    throw new Error(`ENCRYPTION_KEY must be a 64-char hex string (32 bytes). Got length=${key.length}`);
  }
  return Buffer.from(key, "hex");
}
function encrypt(plaintext) {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, "utf8");
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const tag = cipher.getAuthTag();
  const result = Buffer.concat([iv, encrypted, tag]);
  return result.toString("base64");
}
function decrypt(encoded) {
  const key = getKey();
  const buffer = Buffer.from(encoded, "base64");
  const iv = buffer.subarray(0, IV_LENGTH);
  const tag = buffer.subarray(buffer.length - TAG_LENGTH);
  const ciphertext = buffer.subarray(IV_LENGTH, buffer.length - TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(ciphertext);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString("utf8");
}

// server/_core/linkedinAuth.ts
var router2 = Router2();
var LINKEDIN_AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
var LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
var LINKEDIN_USERINFO_URL = "https://api.linkedin.com/v2/userinfo";
var SCOPES = "openid profile email";
var STATE_TTL_MINUTES = 10;
(function validateConfigOnStartup() {
  try {
    const cid = (process.env.LINKEDIN_CLIENT_ID || "").trim();
    const cs = (process.env.LINKEDIN_CLIENT_SECRET || "").trim();
    const ru = (process.env.LINKEDIN_REDIRECT_URI || "").trim();
    const ek = (process.env.ENCRYPTION_KEY || "").trim();
    console.log(`[LinkedIn OAuth] CONFIG_CHECK client_id_len=${cid.length} client_id_tail=${cid.slice(-3)} secret_len=${cs.length} redirect_uri=${ru || "(default)"} encryption_key_len=${ek.length} scopes=${SCOPES}`);
    if (!cid || cid.length < 10) console.error("[LinkedIn OAuth] WARNING: LINKEDIN_CLIENT_ID looks invalid");
    if (!cs || cs.length < 10) console.error("[LinkedIn OAuth] WARNING: LINKEDIN_CLIENT_SECRET looks invalid");
    if (ek.length !== 64) console.error(`[LinkedIn OAuth] WARNING: ENCRYPTION_KEY length=${ek.length} (expected 64)`);
  } catch (e) {
    console.error("[LinkedIn OAuth] CONFIG_CHECK_FAIL", e);
  }
})();
function sanitizeEnv(val) {
  if (!val) return "";
  let s = val.trim();
  if (s.startsWith('"') && s.endsWith('"') || s.startsWith("'") && s.endsWith("'")) {
    s = s.slice(1, -1).trim();
  }
  return s;
}
function getConfig() {
  const clientId = sanitizeEnv(process.env.LINKEDIN_CLIENT_ID);
  const clientSecret = sanitizeEnv(process.env.LINKEDIN_CLIENT_SECRET);
  const redirectUri = sanitizeEnv(process.env.LINKEDIN_REDIRECT_URI) || "https://wassel-alpha.vercel.app/api/auth/linkedin/callback";
  const appUrl = sanitizeEnv(process.env.APP_URL) || "https://wassel-alpha.vercel.app";
  if (!clientId || clientId.includes(" ")) {
    throw new Error(`Missing/invalid LINKEDIN_CLIENT_ID env var (len=${clientId.length})`);
  }
  if (!clientSecret || clientSecret.includes(" ")) {
    throw new Error(`Missing/invalid LINKEDIN_CLIENT_SECRET env var (len=${clientSecret.length})`);
  }
  return { clientId, clientSecret, redirectUri, appUrl };
}
function getAppUrl() {
  return sanitizeEnv(process.env.APP_URL) || "https://wassel-alpha.vercel.app";
}
router2.get("/start", async (req, res) => {
  try {
    const inviteToken = req.query.invite;
    if (!inviteToken) {
      return res.status(400).json({ error: "invite parameter required" });
    }
    const { data: invite, error: inviteError } = await supabase.from("client_invites").select("id, client_id, expires_at, used_at").eq("token", inviteToken).single();
    if (inviteError || !invite) {
      return res.status(404).json({ error: "Invalid invite token" });
    }
    if (invite.used_at) {
      return res.status(400).json({ error: "Invite already used" });
    }
    if (new Date(invite.expires_at) < /* @__PURE__ */ new Date()) {
      return res.status(400).json({ error: "Invite expired" });
    }
    const state = randomBytes2(32).toString("hex");
    const expiresAt = new Date(Date.now() + STATE_TTL_MINUTES * 60 * 1e3).toISOString();
    const { error: insertError } = await supabase.from("oauth_states").insert({
      state,
      invite_token: inviteToken,
      client_id: invite.client_id,
      expires_at: expiresAt
      // used_at stays null until callback processes it
    });
    if (insertError) {
      console.error(`[LinkedIn OAuth] STATE_INSERT_FAIL error=`, insertError);
      return res.status(500).json({ error: "Failed to create OAuth state" });
    }
    let config;
    try {
      config = getConfig();
    } catch (envErr) {
      console.error("[LinkedIn OAuth] ENV_ERROR:", envErr.message);
      return res.status(500).json({ error: envErr.message });
    }
    const stateTail = state.slice(-4);
    const clientIdMasked = "*".repeat(Math.max(0, config.clientId.length - 3)) + config.clientId.slice(-3);
    console.log(`[LinkedIn OAuth] START state_tail=${stateTail} client_id=${clientIdMasked} redirect_uri=${config.redirectUri} scope=${SCOPES}`);
    const authUrl = `${LINKEDIN_AUTH_URL}?response_type=code&client_id=${encodeURIComponent(config.clientId)}&redirect_uri=${encodeURIComponent(config.redirectUri)}&state=${encodeURIComponent(state)}&scope=${encodeURIComponent(SCOPES)}`;
    res.cookie("wassel_oauth_state", state, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: STATE_TTL_MINUTES * 60 * 1e3
    });
    return res.redirect(302, authUrl);
  } catch (error) {
    console.error("[LinkedIn OAuth] Start error:", error);
    return res.status(500).json({ error: "Failed to start LinkedIn OAuth" });
  }
});
router2.get("/debug", (_req, res) => {
  const rawId = process.env.LINKEDIN_CLIENT_ID || "";
  const rawSecret = process.env.LINKEDIN_CLIENT_SECRET || "";
  const clientId = sanitizeEnv(process.env.LINKEDIN_CLIENT_ID);
  const redirectUri = sanitizeEnv(process.env.LINKEDIN_REDIRECT_URI) || "https://wassel-alpha.vercel.app/api/auth/linkedin/callback";
  res.json({
    client_id_raw_len: rawId.length,
    client_id_raw_first3: rawId.substring(0, 3),
    client_id_raw_last3: rawId.slice(-3),
    client_id_raw_charCodes_first5: Array.from(rawId.substring(0, 5)).map((c) => c.charCodeAt(0)),
    client_id_sanitized: clientId ? `${clientId.substring(0, 3)}..${clientId.slice(-3)}` : "EMPTY",
    client_id_sanitized_len: clientId.length,
    client_secret_present: rawSecret.length > 0,
    client_secret_len: rawSecret.length,
    redirect_uri: redirectUri,
    scopes: SCOPES,
    auth_url: LINKEDIN_AUTH_URL
  });
});
router2.get("/callback", async (req, res) => {
  const appUrl = getAppUrl();
  try {
    const code = req.query.code;
    const state = req.query.state;
    const errorParam = req.query.error;
    if (errorParam) {
      console.log(`[LinkedIn OAuth] CALLBACK_DENIED reason=${errorParam}`);
      return res.redirect(302, `${appUrl}/oauth/error?reason=denied`);
    }
    if (!code || !state) {
      console.log(`[LinkedIn OAuth] CALLBACK_MISSING code=${!!code} state=${!!state}`);
      return res.redirect(302, `${appUrl}/oauth/error?reason=missing_params`);
    }
    const stateTail = state.slice(-4);
    console.log(`[LinkedIn OAuth] CALLBACK_START state_tail=${stateTail} state_len=${state.length}`);
    const { data: stateRows, error: stateQueryError } = await supabase.from("oauth_states").select("id, invite_token, client_id, expires_at").eq("state", state).limit(1);
    if (stateQueryError) {
      console.error(`[LinkedIn OAuth] STATE_QUERY_ERROR state_tail=${stateTail} error=`, JSON.stringify(stateQueryError));
      return res.redirect(302, `${appUrl}/oauth/error?reason=state_query_error`);
    }
    const oauthState = stateRows?.[0];
    if (!oauthState) {
      console.error(`[LinkedIn OAuth] STATE_NOT_FOUND state_tail=${stateTail} state_len=${state.length} (state already used or never created)`);
      return res.redirect(302, `${appUrl}/oauth/error?reason=invalid_state`);
    }
    console.log(`[LinkedIn OAuth] STATE_FOUND id=${oauthState.id} expires_at=${oauthState.expires_at}`);
    const inviteSuffix = oauthState.invite_token ? `&invite=${oauthState.invite_token}` : "";
    if (new Date(oauthState.expires_at) < /* @__PURE__ */ new Date()) {
      console.log(`[LinkedIn OAuth] STATE_EXPIRED state_tail=${stateTail} expires=${oauthState.expires_at}`);
      await supabase.from("oauth_states").delete().eq("id", oauthState.id);
      return res.redirect(302, `${appUrl}/oauth/error?reason=state_expired${inviteSuffix}`);
    }
    const { error: deleteError } = await supabase.from("oauth_states").delete().eq("id", oauthState.id);
    if (deleteError) {
      console.error(`[LinkedIn OAuth] STATE_DELETE_FAIL state_tail=${stateTail}`, deleteError);
      return res.redirect(302, `${appUrl}/oauth/error?reason=state_claim_failed${inviteSuffix}`);
    }
    console.log(`[LinkedIn OAuth] STATE_CLAIMED state_tail=${stateTail}`);
    let config;
    try {
      config = getConfig();
    } catch (envErr) {
      console.error("[LinkedIn OAuth] ENV_ERROR in callback:", envErr.message);
      return res.redirect(302, `${appUrl}/oauth/error?reason=server_config_error${inviteSuffix}`);
    }
    console.log(`[LinkedIn OAuth] TOKEN_EXCHANGE state_tail=${stateTail}`);
    const tokenResponse = await fetch(LINKEDIN_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: config.redirectUri,
        client_id: config.clientId,
        client_secret: config.clientSecret
      }).toString()
    });
    if (!tokenResponse.ok) {
      const errBody = await tokenResponse.text();
      console.error(`[LinkedIn OAuth] TOKEN_EXCHANGE_FAIL status=${tokenResponse.status} body=${errBody.substring(0, 200)}`);
      return res.redirect(302, `${appUrl}/oauth/error?reason=token_exchange_failed${inviteSuffix}`);
    }
    const tokenData = await tokenResponse.json();
    console.log(`[LinkedIn OAuth] TOKEN_OK state_tail=${stateTail} scope=${tokenData.scope}`);
    const userInfoResponse = await fetch(LINKEDIN_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    let linkedinProfile = { sub: "", name: "", email: "" };
    if (userInfoResponse.ok) {
      const userInfo = await userInfoResponse.json();
      linkedinProfile = {
        sub: userInfo.sub || "",
        name: userInfo.name || `${userInfo.given_name || ""} ${userInfo.family_name || ""}`.trim(),
        email: userInfo.email || ""
      };
      console.log(`[LinkedIn OAuth] PROFILE_OK name=${linkedinProfile.name} email_present=${!!linkedinProfile.email}`);
    } else {
      console.log(`[LinkedIn OAuth] PROFILE_FAIL status=${userInfoResponse.status}`);
    }
    let encryptedAccessToken;
    let encryptedRefreshToken = null;
    try {
      encryptedAccessToken = encrypt(tokenData.access_token);
      encryptedRefreshToken = tokenData.refresh_token ? encrypt(tokenData.refresh_token) : null;
      console.log(`[LinkedIn OAuth] ENCRYPT_OK state_tail=${stateTail}`);
    } catch (encryptErr) {
      console.error(`[LinkedIn OAuth] ENCRYPT_FAIL state_tail=${stateTail} error=${encryptErr.message}`);
      encryptedAccessToken = Buffer.from(tokenData.access_token).toString("base64");
      encryptedRefreshToken = tokenData.refresh_token ? Buffer.from(tokenData.refresh_token).toString("base64") : null;
      console.log(`[LinkedIn OAuth] ENCRYPT_FALLBACK_B64 state_tail=${stateTail}`);
    }
    const tokenExpiresAt = tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1e3).toISOString() : null;
    try {
      const { error: upsertError } = await supabase.from("linkedin_connections").upsert(
        {
          client_id: oauthState.client_id,
          linkedin_member_id: linkedinProfile.sub,
          linkedin_name: linkedinProfile.name,
          linkedin_email: linkedinProfile.email,
          access_token: encryptedAccessToken,
          refresh_token: encryptedRefreshToken,
          token_expires_at: tokenExpiresAt,
          scopes: tokenData.scope || SCOPES
        },
        { onConflict: "client_id" }
      );
      if (upsertError) {
        console.error(`[LinkedIn OAuth] CONNECTION_UPSERT_FAIL state_tail=${stateTail}`, JSON.stringify(upsertError));
        return res.redirect(302, `${appUrl}/oauth/error?reason=db_store_failed${inviteSuffix}`);
      }
      console.log(`[LinkedIn OAuth] CONNECTION_STORED state_tail=${stateTail} client_id=${oauthState.client_id}`);
    } catch (dbErr) {
      console.error(`[LinkedIn OAuth] CONNECTION_STORE_ERROR state_tail=${stateTail} error=${dbErr.message}`);
      return res.redirect(302, `${appUrl}/oauth/error?reason=db_store_failed`);
    }
    try {
      await supabase.from("client_invites").update({ used_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("token", oauthState.invite_token);
      console.log(`[LinkedIn OAuth] INVITE_MARKED_USED state_tail=${stateTail}`);
    } catch (e) {
      console.error(`[LinkedIn OAuth] INVITE_UPDATE_FAIL (non-fatal) error=${e.message}`);
    }
    try {
      await supabase.from("clients").update({ status: "connected", updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", oauthState.client_id);
      console.log(`[LinkedIn OAuth] CLIENT_CONNECTED state_tail=${stateTail}`);
    } catch (e) {
      console.error(`[LinkedIn OAuth] CLIENT_UPDATE_FAIL (non-fatal) error=${e.message}`);
    }
    console.log(`[LinkedIn OAuth] CALLBACK_SUCCESS client_id=${oauthState.client_id} state_tail=${stateTail}`);
    return res.redirect(302, `${appUrl}/connected?ok=1&client=${oauthState.client_id}`);
  } catch (error) {
    console.error(`[LinkedIn OAuth] CALLBACK_FATAL error=${error.message}`, error.stack?.substring(0, 300));
    return res.redirect(302, `${appUrl}/oauth/error?reason=callback_failed`);
  }
});
router2.get("/debug/state/:stateId", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ") || authHeader.replace("Bearer ", "") !== (process.env.ADMIN_KEY || "").trim()) {
    return res.status(401).json({ error: "Admin key required" });
  }
  const stateId = req.params.stateId;
  const { data, error } = await supabase.from("oauth_states").select("id, state, invite_token, client_id, expires_at, created_at").or(`id.eq.${stateId},state.eq.${stateId}`).limit(1);
  if (error) return res.json({ error: error.message });
  if (!data || data.length === 0) return res.json({ found: false });
  const row = data[0];
  res.json({
    found: true,
    id: row.id,
    state_tail: row.state?.slice(-4),
    state_len: row.state?.length,
    invite_token_tail: row.invite_token?.slice(-4),
    client_id: row.client_id,
    expires_at: row.expires_at,
    created_at: row.created_at,
    expired: new Date(row.expires_at) < /* @__PURE__ */ new Date()
  });
});
var linkedinAuth_default = router2;

// server/_core/linkedinOAuthRoutes.ts
import { Router as Router3 } from "express";
import { createClient as createClient3 } from "@supabase/supabase-js";
import crypto2 from "crypto";
var router3 = Router3();
function getSupabase2() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) throw new Error("Missing Supabase env vars (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  return createClient3(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
function getConfig2() {
  return {
    LINKEDIN_CLIENT_ID: process.env.LINKEDIN_CLIENT_ID || "",
    LINKEDIN_CLIENT_SECRET: process.env.LINKEDIN_CLIENT_SECRET || "",
    LINKEDIN_REDIRECT_URI: process.env.LINKEDIN_REDIRECT_URI || "https://wassel-alpha.vercel.app/api/linkedin/callback",
    DASHBOARD_URL: process.env.DASHBOARD_ORIGIN || "https://wassel-alpha.vercel.app"
  };
}
function getUserId(req) {
  return req.userId || req.user?.id || null;
}
router3.get("/connect", (req, res) => {
  const { LINKEDIN_CLIENT_ID, LINKEDIN_REDIRECT_URI } = getConfig2();
  const state = crypto2.randomUUID();
  res.cookie("linkedin_oauth_state", state, { httpOnly: true, maxAge: 6e5, sameSite: "lax" });
  const scopes = ["openid", "profile", "email", "w_member_social"].join("%20");
  const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${LINKEDIN_CLIENT_ID}&redirect_uri=${encodeURIComponent(LINKEDIN_REDIRECT_URI)}&state=${state}&scope=${scopes}`;
  res.redirect(authUrl);
});
router3.get("/callback", async (req, res) => {
  const { LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, LINKEDIN_REDIRECT_URI, DASHBOARD_URL } = getConfig2();
  const supabase3 = getSupabase2();
  try {
    const { code, state, error: oauthError } = req.query;
    console.log("[LinkedIn OAuth] Callback received", { code: !!code, error: oauthError });
    if (oauthError) {
      console.error("[LinkedIn OAuth] Error:", oauthError);
      return res.redirect(`${DASHBOARD_URL}/login?error=linkedin_denied`);
    }
    if (!code) {
      return res.redirect(`${DASHBOARD_URL}/login?error=no_code`);
    }
    const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: LINKEDIN_REDIRECT_URI,
        client_id: LINKEDIN_CLIENT_ID,
        client_secret: LINKEDIN_CLIENT_SECRET
      })
    });
    const tokenData = await tokenRes.json();
    console.log("[LinkedIn OAuth] Token received:", !!tokenData.access_token);
    if (!tokenData.access_token) {
      console.error("[LinkedIn OAuth] Token exchange failed:", tokenData);
      return res.redirect(`${DASHBOARD_URL}/login?error=token_failed`);
    }
    const profileRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const profile = await profileRes.json();
    console.log("[LinkedIn OAuth] Profile:", profile.email, profile.name);
    const linkedinName = profile.name || profile.given_name || "LinkedIn User";
    const linkedinEmail = profile.email || `linkedin_${profile.sub}@wassel.app`;
    const linkedinSub = profile.sub || "";
    const linkedinPicture = profile.picture || "";
    const { data: userList } = await supabase3.auth.admin.listUsers();
    const existingUser = userList?.users?.find(
      (u) => u.email === linkedinEmail
    );
    let userId;
    if (existingUser) {
      userId = existingUser.id;
      console.log("[LinkedIn OAuth] Existing user found:", userId);
      try {
        const existingMeta = existingUser.user_metadata || {};
        await supabase3.auth.admin.updateUserById(userId, {
          user_metadata: {
            ...existingMeta,
            avatar_url: linkedinPicture || existingMeta.avatar_url,
            picture: linkedinPicture || existingMeta.picture,
            full_name: linkedinName || existingMeta.full_name,
            linkedin_id: linkedinSub || existingMeta.linkedin_id
          }
        });
        console.log("[LinkedIn OAuth] Updated user metadata with LinkedIn photo");
      } catch (metaErr) {
        console.warn("[LinkedIn OAuth] Metadata update skipped:", metaErr.message);
      }
      if (linkedinPicture) {
        await supabase3.from("profiles").update({ avatar_url: linkedinPicture }).eq("id", userId);
      }
    } else {
      const { data: newUser, error: createError } = await supabase3.auth.admin.createUser({
        email: linkedinEmail,
        email_confirm: true,
        user_metadata: {
          full_name: linkedinName,
          avatar_url: linkedinPicture,
          linkedin_id: linkedinSub,
          provider: "linkedin"
        }
      });
      if (createError) {
        console.error("[LinkedIn OAuth] User creation failed:", createError);
        return res.redirect(`${DASHBOARD_URL}/login?error=callback_failed`);
      }
      userId = newUser.user.id;
      console.log("[LinkedIn OAuth] New user created:", userId);
      await supabase3.from("profiles").upsert({
        id: userId,
        email: linkedinEmail,
        full_name: linkedinName,
        role: "client_user"
      });
      try {
        const { data: team } = await supabase3.from("teams").insert({ name: linkedinName + "'s Team", plan: "trial" }).select().single();
        if (team) {
          await supabase3.from("team_members").insert({
            team_id: team.id,
            user_id: userId,
            role: "owner"
          });
        }
      } catch (teamErr) {
        console.warn("[LinkedIn OAuth] Team creation skipped:", teamErr);
      }
    }
    const expiresAt = new Date(Date.now() + (tokenData.expires_in || 5184e3) * 1e3).toISOString();
    await supabase3.from("linkedin_connections").upsert({
      user_id: userId,
      linkedin_member_id: linkedinSub,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || null,
      expires_at: expiresAt,
      linkedin_name: linkedinName,
      linkedin_email: linkedinEmail,
      profile_picture_url: linkedinPicture || null,
      headline: profile.headline || null,
      oauth_connected: true,
      status: "connected",
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }, { onConflict: "user_id" });
    console.log("[LinkedIn OAuth] Token saved to DB");
    await supabase3.from("profiles").update({ linkedin_connected: true }).eq("id", userId);
    const { data: linkData, error: linkError } = await supabase3.auth.admin.generateLink({
      type: "magiclink",
      email: linkedinEmail,
      options: {
        redirectTo: `${DASHBOARD_URL}/onboarding/extension`
      }
    });
    if (linkData?.properties?.action_link) {
      console.log("[LinkedIn OAuth] Redirecting via magic link");
      return res.redirect(linkData.properties.action_link);
    }
    console.warn("[LinkedIn OAuth] Magic link failed, fallback redirect", linkError);
    return res.redirect(`${DASHBOARD_URL}/login?linkedin=connected`);
  } catch (e) {
    console.error("[LinkedIn OAuth] Callback error:", e);
    return res.redirect(`${DASHBOARD_URL}/login?error=callback_failed`);
  }
});
router3.get("/profile", async (req, res) => {
  const supabase3 = getSupabase2();
  try {
    let userId = getUserId(req);
    if (!userId) {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        const jwt2 = authHeader.slice(7);
        const { data } = await supabase3.auth.admin.getUserById(
          // Decode sub from JWT payload without verifying (admin API verifies)
          (() => {
            try {
              return JSON.parse(Buffer.from(jwt2.split(".")[1], "base64").toString()).sub || "";
            } catch {
              return "";
            }
          })()
        );
        userId = data?.user?.id || null;
        if (!userId) {
          const { data: d2 } = await supabase3.auth.getUser(jwt2);
          userId = d2?.user?.id || null;
        }
      }
    }
    let photoUrl = null;
    let headline = null;
    let fullName = null;
    if (userId) {
      const { data: conn } = await supabase3.from("linkedin_connections").select("linkedin_name, profile_picture_url, headline").eq("user_id", userId).eq("oauth_connected", true).limit(1).single();
      if (conn) {
        photoUrl = conn.profile_picture_url || null;
        headline = conn.headline || null;
        fullName = conn.linkedin_name || null;
      }
      if (!photoUrl) {
        const { data: profile } = await supabase3.from("profiles").select("avatar_url, full_name").eq("id", userId).single();
        photoUrl = profile?.avatar_url || null;
        fullName = fullName || profile?.full_name || null;
      }
      if (!photoUrl) {
        const { data: userData } = await supabase3.auth.admin.getUserById(userId);
        if (userData?.user) {
          const meta = userData.user.user_metadata || {};
          photoUrl = meta.picture || meta.avatar_url || meta.profile_picture || null;
          fullName = fullName || meta.full_name || meta.name || null;
        }
      }
    }
    res.json({ photoUrl, headline, fullName });
  } catch (e) {
    console.error("[LinkedIn] Profile fetch error:", e.message);
    res.json({ photoUrl: null, headline: null, fullName: null });
  }
});
router3.get("/status", async (req, res) => {
  const supabase3 = getSupabase2();
  try {
    const { data: connections } = await supabase3.from("linkedin_connections").select("linkedin_name, linkedin_email, linkedin_member_id, oauth_connected, status, expires_at").eq("oauth_connected", true).eq("status", "connected").limit(1);
    if (connections && connections.length > 0) {
      const conn = connections[0];
      const expired = new Date(conn.expires_at) < /* @__PURE__ */ new Date();
      res.json({
        connected: !expired,
        expired,
        name: conn.linkedin_name,
        email: conn.linkedin_email,
        memberId: conn.linkedin_member_id
      });
    } else {
      res.json({ connected: false });
    }
  } catch (e) {
    res.json({ connected: false, error: e.message });
  }
});
router3.post("/send-invite", async (req, res) => {
  const supabase3 = getSupabase2();
  try {
    const { linkedinProfileUrl, message } = req.body;
    if (!linkedinProfileUrl) {
      return res.status(400).json({ error: "linkedinProfileUrl required" });
    }
    const { data: connections } = await supabase3.from("linkedin_connections").select("access_token, expires_at").eq("oauth_connected", true).eq("status", "connected").limit(1);
    if (!connections || connections.length === 0) {
      return res.status(400).json({ error: "No LinkedIn account connected. Connect via /app/extension." });
    }
    const conn = connections[0];
    if (new Date(conn.expires_at) < /* @__PURE__ */ new Date()) {
      return res.status(401).json({ error: "LinkedIn token expired. Please reconnect." });
    }
    res.json({
      success: true,
      method: "queued",
      note: "Invite queued for extension execution. Server-side sending requires LinkedIn API partner access.",
      profileUrl: linkedinProfileUrl
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
router3.post("/disconnect", async (req, res) => {
  const supabase3 = getSupabase2();
  try {
    const { error } = await supabase3.from("linkedin_connections").update({ oauth_connected: false, status: "disconnected", access_token: null }).eq("oauth_connected", true);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
router3.get("/test", (_req, res) => {
  const { LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, LINKEDIN_REDIRECT_URI, DASHBOARD_URL } = getConfig2();
  res.json({
    linkedinRoutes: "ACTIVE \u2705",
    clientId: LINKEDIN_CLIENT_ID ? "SET \u2705" : "MISSING \u274C",
    secret: LINKEDIN_CLIENT_SECRET ? "SET \u2705" : "MISSING \u274C",
    redirectUri: LINKEDIN_REDIRECT_URI || "MISSING \u274C",
    dashboardUrl: DASHBOARD_URL,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
var linkedinOAuthRoutes_default = router3;

// server/_core/inviteRoutes.ts
import { Router as Router4 } from "express";
import { randomBytes as randomBytes3 } from "crypto";
var router4 = Router4();
var INVITE_EXPIRY_HOURS = 72;
router4.post("/send", async (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Email is required" });
    }
    const teamId = req.user?.teamId || process.env.DEFAULT_TEAM_ID || "00000000-0000-0000-0000-000000000001";
    let clientId;
    const { data: existingClient } = await supabase.from("clients").select("id, status").eq("email", email).eq("team_id", teamId).single();
    if (existingClient) {
      clientId = existingClient.id;
      if (existingClient.status === "connected") {
        return res.status(400).json({ error: "Client already connected" });
      }
    } else {
      const { data: newClient, error: createError } = await supabase.from("clients").insert({ team_id: teamId, email, name: name || null, status: "pending" }).select("id").single();
      if (createError || !newClient) {
        console.error("[Invite] Failed to create client:", createError);
        return res.status(500).json({ error: "Failed to create client" });
      }
      clientId = newClient.id;
    }
    const inviteToken = randomBytes3(32).toString("hex");
    const expiresAt = new Date(Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1e3).toISOString();
    const { error: inviteError } = await supabase.from("client_invites").insert({ client_id: clientId, token: inviteToken, expires_at: expiresAt });
    if (inviteError) {
      console.error("[Invite] Failed to create invite:", inviteError);
      return res.status(500).json({ error: "Failed to create invite" });
    }
    await supabase.from("clients").update({ status: "invited", updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", clientId);
    const appUrl = process.env.APP_URL || "https://wassel-alpha.vercel.app";
    const inviteUrl = `${appUrl}/invite/${inviteToken}`;
    const resendApiKey = process.env.RESEND_API_KEY;
    let sent = false;
    let provider = "none";
    let emailError = null;
    if (resendApiKey) {
      provider = "resend";
      try {
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${resendApiKey}`
          },
          body: JSON.stringify({
            from: "Wassel <noreply@wassel.app>",
            to: [email],
            subject: "Connect your LinkedIn \u2014 Wassel",
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px;">
                <h1 style="color: #2563eb; margin-bottom: 20px;">Wassel</h1>
                <p style="font-size: 16px; color: #333;">You've been invited to connect your LinkedIn account with Wassel.</p>
                <p style="font-size: 16px; color: #333;">Click the button below to get started:</p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${inviteUrl}" style="background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600;">
                    Connect LinkedIn
                  </a>
                </div>
                <p style="font-size: 14px; color: #666;">This link expires in ${INVITE_EXPIRY_HOURS} hours.</p>
                <p style="font-size: 12px; color: #999; margin-top: 30px;">\u2014 Wassel Team</p>
              </div>
            `
          })
        });
        sent = emailRes.ok;
        if (!sent) {
          const errBody = await emailRes.text();
          emailError = `Resend ${emailRes.status}: ${errBody.substring(0, 200)}`;
          console.error(`[Invite] SEND_EMAIL_FAIL email=${email} status=${emailRes.status} body=${errBody.substring(0, 200)}`);
        }
      } catch (err) {
        emailError = err.message || "Unknown email error";
        console.error(`[Invite] SEND_EMAIL_ERROR email=${email} error=${emailError}`);
      }
    }
    console.log(`[Invite] SEND_OK email=${email} clientId=${clientId} sent=${sent} provider=${provider}`);
    res.json({
      success: true,
      clientId,
      inviteToken,
      inviteUrl,
      sent,
      provider,
      message: sent ? "Invite sent successfully via email" : "Invite created. Copy the link and share it manually.",
      ...emailError ? { emailError } : {}
    });
  } catch (error) {
    const errorId = randomBytes3(4).toString("hex");
    console.error(`[Invite] SEND_FATAL errorId=${errorId} error=`, error);
    res.status(500).json({ error: "Server error", errorId });
  }
});
router4.get("/validate/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const { data: invite, error } = await supabase.from("client_invites").select("id, client_id, expires_at, used_at, clients(email, name, status)").eq("token", token).single();
    if (error || !invite) {
      return res.status(404).json({ error: "Invalid invite token", valid: false });
    }
    if (invite.used_at) {
      return res.status(400).json({ error: "Invite already used", valid: false, used: true });
    }
    if (new Date(invite.expires_at) < /* @__PURE__ */ new Date()) {
      return res.status(400).json({ error: "Invite expired", valid: false, expired: true });
    }
    res.json({
      valid: true,
      clientId: invite.client_id,
      client: invite.clients
    });
  } catch (error) {
    console.error("[Invite] Validate error:", error);
    res.status(500).json({ error: "Server error", valid: false });
  }
});
router4.get("/status", async (req, res) => {
  try {
    const teamId = req.user?.teamId || process.env.DEFAULT_TEAM_ID || "00000000-0000-0000-0000-000000000001";
    const { data: clients, error: clientsError } = await supabase.from("clients").select(`
        id,
        email,
        name,
        status,
        created_at,
        updated_at,
        linkedin_connections(linkedin_member_id, linkedin_name, linkedin_email, created_at)
      `).eq("team_id", teamId).order("created_at", { ascending: false });
    if (clientsError) {
      console.error("[Clients] Status error:", clientsError);
      return res.status(500).json({ error: "Failed to fetch clients" });
    }
    res.json({ clients: clients || [] });
  } catch (error) {
    console.error("[Clients] Status error:", error);
    res.status(500).json({ error: "Server error" });
  }
});
router4.get("/latest", async (req, res) => {
  try {
    const teamId = req.user?.teamId || process.env.DEFAULT_TEAM_ID || "00000000-0000-0000-0000-000000000001";
    const appUrl = process.env.APP_URL || "https://wassel-alpha.vercel.app";
    const { data: invites, error } = await supabase.from("client_invites").select(`
                id,
                token,
                expires_at,
                used_at,
                created_at,
                clients(id, email, name, status)
            `).order("created_at", { ascending: false }).limit(20);
    if (error) {
      console.error("[Invites] Latest error:", error);
      return res.status(500).json({ error: "Failed to fetch invites" });
    }
    const result = (invites || []).map((inv) => ({
      id: inv.id,
      email: inv.clients?.email || "unknown",
      name: inv.clients?.name || null,
      status: inv.used_at ? "used" : new Date(inv.expires_at) < /* @__PURE__ */ new Date() ? "expired" : "pending",
      clientStatus: inv.clients?.status || "unknown",
      created_at: inv.created_at,
      expires_at: inv.expires_at,
      used_at: inv.used_at,
      tokenMasked: inv.token ? `${inv.token.substring(0, 8)}...` : null,
      inviteUrl: `${appUrl}/invite/${inv.token}`
    }));
    res.json({ invites: result });
  } catch (error) {
    console.error("[Invites] Latest error:", error);
    res.status(500).json({ error: "Server error" });
  }
});
router4.post("/:id/disconnect", async (req, res) => {
  try {
    const clientId = req.params.id;
    console.log(`[Clients] DISCONNECT_START client_id=${clientId.substring(0, 8)}...`);
    const { error: delError } = await supabase.from("linkedin_connections").delete().eq("client_id", clientId);
    if (delError) {
      console.warn(`[Clients] DISCONNECT linkedin_connections delete warning:`, delError.message);
    }
    const { error: updateError } = await supabase.from("clients").update({ status: "invited", updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", clientId);
    if (updateError) {
      console.error(`[Clients] DISCONNECT status update fail:`, updateError.message);
      return res.status(500).json({ error: "Failed to update client status" });
    }
    console.log(`[Clients] DISCONNECT_OK client_id=${clientId.substring(0, 8)}...`);
    res.json({ success: true, message: "LinkedIn disconnected. Client can reconnect via invite link." });
  } catch (error) {
    console.error("[Clients] Disconnect error:", error.message || error);
    res.status(500).json({ error: "Server error" });
  }
});
router4.delete("/:id", async (req, res) => {
  try {
    const clientId = req.params.id;
    console.log(`[Clients] DELETE_START client_id=${clientId.substring(0, 8)}...`);
    const { error: e1 } = await supabase.from("prospects").delete().eq("client_id", clientId);
    if (e1) console.warn(`[Clients] DELETE prospects warn:`, e1.message);
    const { error: e2 } = await supabase.from("prospect_import_jobs").delete().eq("client_id", clientId);
    if (e2) console.warn(`[Clients] DELETE import_jobs warn:`, e2.message);
    const { error: e3 } = await supabase.from("linkedin_connections").delete().eq("client_id", clientId);
    if (e3) console.warn(`[Clients] DELETE linkedin_connections warn:`, e3.message);
    const { error: e4 } = await supabase.from("client_invites").delete().eq("client_id", clientId);
    if (e4) console.warn(`[Clients] DELETE invites warn:`, e4.message);
    const { error: e5 } = await supabase.from("oauth_states").delete().eq("client_id", clientId);
    if (e5) console.warn(`[Clients] DELETE oauth_states warn:`, e5.message);
    const { error: e6 } = await supabase.from("clients").delete().eq("id", clientId);
    if (e6) {
      console.error(`[Clients] DELETE client fail:`, e6.message);
      return res.status(500).json({ error: "Failed to delete client record" });
    }
    console.log(`[Clients] DELETE_OK client_id=${clientId.substring(0, 8)}...`);
    res.json({ success: true, message: "Client and all associated data deleted." });
  } catch (error) {
    console.error("[Clients] Delete error:", error.message || error);
    res.status(500).json({ error: "Server error" });
  }
});
router4.delete("/:id", async (req, res) => {
  try {
    const inviteId = req.params.id;
    console.log(`[Invites] DELETE invite_id=${inviteId.substring(0, 8)}...`);
    const { error } = await supabase.from("client_invites").delete().eq("id", inviteId);
    if (error) {
      console.error(`[Invites] DELETE fail:`, error.message);
      return res.status(500).json({ error: "Failed to delete invite" });
    }
    res.json({ success: true, message: "Invite deleted." });
  } catch (error) {
    console.error("[Invites] Delete error:", error.message || error);
    res.status(500).json({ error: "Server error" });
  }
});
var inviteRoutes_default = router4;

// server/_core/extensionRoutes.ts
import { Router as Router5 } from "express";
var router5 = Router5();
function getTeamId(req) {
  const user = req.user;
  if (!user) return null;
  if (user.role === "super_admin" && req.query.target_team_id) {
    return req.query.target_team_id;
  }
  return user.teamId || null;
}
router5.get("/bootstrap", async (req, res) => {
  try {
    const teamId = getTeamId(req);
    if (!teamId) {
      return res.status(401).json({ error: "No team associated with user" });
    }
    const clientId = req.query.client_id;
    if (!clientId) {
      return res.status(400).json({ error: "client_id required" });
    }
    const { data: client, error } = await supabase.from("clients").select("id, email, name, status").eq("id", clientId).eq("team_id", teamId).single();
    if (error || !client) {
      return res.status(404).json({ error: "Client not found" });
    }
    const appUrl = process.env.APP_URL || "https://wassel-alpha.vercel.app";
    res.json({
      clientId: client.id,
      clientEmail: client.email,
      clientName: client.name,
      clientStatus: client.status,
      appUrl,
      apiUrl: `${appUrl}/api`,
      allowedOrigins: ["https://www.linkedin.com", appUrl]
    });
  } catch (error) {
    console.error("[Extension] Bootstrap error:", error);
    res.status(500).json({ error: "Server error" });
  }
});
router5.get("/campaigns", async (req, res) => {
  try {
    const teamId = getTeamId(req);
    if (!teamId) {
      return res.status(401).json({ error: "No team associated with user" });
    }
    const { data: campaigns, error } = await supabase.from("campaigns").select("id, name, status, created_at").eq("team_id", teamId).order("created_at", { ascending: false });
    if (error) {
      console.log("[Extension] Campaigns query error:", error.message);
      return res.json({
        campaigns: [{
          id: "default",
          name: "Default Campaign",
          status: "active"
        }]
      });
    }
    if (!campaigns || campaigns.length === 0) {
      return res.json({
        campaigns: [{
          id: "default",
          name: "Default Campaign",
          status: "active"
        }]
      });
    }
    res.json({ campaigns });
  } catch (error) {
    console.error("[Extension] Campaigns error:", error);
    res.status(500).json({ error: "Server error" });
  }
});
router5.post("/import", async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.sub;
    if (!userId) {
      console.error("[Import] NO_USER auth:", JSON.stringify(req.user));
      return res.status(401).json({ error: "Not authenticated" });
    }
    let resolvedTeamId = getTeamId(req);
    if (!resolvedTeamId) {
      const { data: membership, error: memberError } = await supabase.from("team_members").select("team_id").eq("user_id", userId).single();
      if (memberError || !membership?.team_id) {
        console.error("[Import] NO_TEAM user:", userId, memberError?.message);
        return res.status(400).json({ error: "No team associated with user", userId });
      }
      resolvedTeamId = membership.team_id;
    }
    const { client_id, campaign_id, source_url, prospects } = req.body;
    console.log(`[Import] START team_id=${resolvedTeamId} count=${prospects?.length || 0} source=${source_url || "none"}`);
    if (!prospects || !Array.isArray(prospects) || prospects.length === 0) {
      console.error("[Import] VALIDATION_FAIL body:", JSON.stringify(req.body).substring(0, 500));
      return res.status(400).json({ error: "prospects array is required and must not be empty" });
    }
    const { data: team } = await supabase.from("teams").select("plan").eq("id", resolvedTeamId).single();
    const plan = team?.plan || "trial";
    const PLAN_LIMITS = { trial: 500, starter: 1e3, growth: 5e3, agency: 99999 };
    const maxProspects = PLAN_LIMITS[plan] || 500;
    const { count: existingCount } = await supabase.from("prospects").select("id", { count: "exact", head: true }).eq("team_id", resolvedTeamId);
    const currentCount = existingCount || 0;
    if (currentCount + prospects.length > maxProspects) {
      const remaining = Math.max(0, maxProspects - currentCount);
      return res.status(403).json({
        error: `You've reached your ${plan} plan limit of ${maxProspects} prospects. You have ${remaining} slots remaining. Upgrade your plan to import more.`,
        limit: maxProspects,
        current: currentCount,
        remaining,
        upgrade: true
      });
    }
    const prospectRecords = prospects.map((p) => {
      const name = p.name || [p.first_name || p.firstName || "", p.last_name || p.lastName || ""].filter(Boolean).join(" ") || "Unknown";
      const title = p.title || p.job_title || p.jobTitle || null;
      const company = p.company || p.company_name || null;
      const linkedinUrl = p.linkedin_url || p.linkedinUrl || p.profile_url || "";
      const location = p.location || null;
      return {
        team_id: resolvedTeamId,
        client_id: client_id || resolvedTeamId,
        campaign_id: campaign_id || null,
        linkedin_url: linkedinUrl,
        name,
        title,
        company,
        location,
        photo_url: p.photo_url || p.photoUrl || null,
        source_url: source_url || null,
        status: "imported"
      };
    });
    console.log("[Import] Sample record:", JSON.stringify(prospectRecords[0]));
    const { data: inserted, error: insertError } = await supabase.from("prospects").upsert(prospectRecords, { onConflict: "linkedin_url,team_id", ignoreDuplicates: true }).select("id");
    if (insertError) {
      console.error(`[Import] INSERT_FAIL team_id=${resolvedTeamId} error=`, insertError.message || insertError);
      console.error("[Import] INSERT_FAIL detail:", JSON.stringify(insertError));
      const { data: inserted2, error: insertError2 } = await supabase.from("prospects").insert(prospectRecords).select("id");
      if (insertError2) {
        console.error("[Import] FALLBACK_INSERT_FAIL:", insertError2.message);
        return res.status(500).json({ error: "Failed to import prospects", detail: insertError2.message });
      }
      const count = inserted2?.length || prospects.length;
      console.log(`[Import] OK (fallback insert) team_id=${resolvedTeamId} imported=${count}`);
      return res.json({ success: true, imported: count, message: `${count} prospects imported successfully` });
    }
    const importedCount = inserted?.length || prospects.length;
    try {
      await supabase.from("prospect_import_jobs").insert({
        client_id: client_id || resolvedTeamId,
        campaign_id: campaign_id || null,
        source_url: source_url || null,
        prospect_count: importedCount,
        status: "completed"
      });
    } catch (jobErr) {
      console.warn(`[Import] JOB_RECORD_FAIL (non-fatal):`, jobErr.message);
    }
    console.log(`[Import] OK team_id=${resolvedTeamId} imported=${importedCount}`);
    res.json({
      success: true,
      imported: importedCount,
      message: `${importedCount} prospects imported successfully`
    });
  } catch (error) {
    console.error("[Import] FATAL:", error.message || error);
    console.error("[Import] FATAL body:", JSON.stringify(req.body).substring(0, 500));
    console.error("[Import] FATAL user:", JSON.stringify(req.user));
    res.status(500).json({ error: "Server error", detail: error.message || "Unknown error" });
  }
});
router5.get("/prospects", async (req, res) => {
  try {
    const teamId = getTeamId(req);
    if (!teamId) {
      return res.status(401).json({ error: "No team associated with user" });
    }
    const clientId = req.query.client_id;
    let query = supabase.from("prospects").select("id, linkedin_url, name, title, company, location, photo_url, source_url, status, created_at").eq("team_id", teamId).order("created_at", { ascending: false }).limit(1e3);
    if (clientId) {
      query = query.eq("client_id", clientId);
    }
    const { data: prospects, error } = await query;
    if (error) {
      console.error("[Extension] Prospects query error:", error);
      return res.json({ prospects: [], count: 0 });
    }
    res.json({
      prospects: prospects || [],
      count: prospects?.length || 0
    });
  } catch (error) {
    console.error("[Extension] Prospects error:", error);
    res.status(500).json({ error: "Server error" });
  }
});
router5.delete("/prospects", async (req, res) => {
  try {
    const teamId = getTeamId(req);
    if (!teamId) {
      return res.status(401).json({ error: "No team associated with user" });
    }
    const { prospectIds } = req.body;
    if (!prospectIds || !Array.isArray(prospectIds) || prospectIds.length === 0) {
      return res.status(400).json({ error: "prospectIds array is required" });
    }
    const { data: owned } = await supabase.from("prospects").select("id").eq("team_id", teamId).in("id", prospectIds);
    const ownedIds = (owned || []).map((p) => p.id);
    if (ownedIds.length === 0) {
      return res.status(404).json({ error: "No matching prospects found" });
    }
    await supabase.from("prospect_step_status").delete().in("prospect_id", ownedIds);
    const { error: deleteError } = await supabase.from("prospects").delete().in("id", ownedIds);
    if (deleteError) {
      console.error("[Extension] Delete prospects error:", deleteError);
      return res.status(500).json({ error: "Failed to delete prospects" });
    }
    console.log(`[Extension] Deleted ${ownedIds.length} prospects for team ${teamId}`);
    res.json({ success: true, deleted: ownedIds.length });
  } catch (error) {
    console.error("[Extension] Delete prospects error:", error);
    res.status(500).json({ error: "Server error" });
  }
});
var extensionRoutes_default = router5;

// server/_core/clientRoutes.ts
import { Router as Router6 } from "express";
var router6 = Router6();
router6.post("/:id/disconnect", async (req, res) => {
  try {
    const clientId = req.params.id;
    console.log(`[Clients] DISCONNECT_START client_id=${clientId.substring(0, 8)}...`);
    const { error: delError } = await supabase.from("linkedin_connections").delete().eq("client_id", clientId);
    if (delError) {
      console.warn(`[Clients] DISCONNECT linkedin_connections delete warning:`, delError.message);
    }
    const { error: updateError } = await supabase.from("clients").update({ status: "invited", updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", clientId);
    if (updateError) {
      console.error(`[Clients] DISCONNECT status update fail:`, updateError.message);
      return res.status(500).json({ error: "Failed to update client status" });
    }
    console.log(`[Clients] DISCONNECT_OK client_id=${clientId.substring(0, 8)}...`);
    res.json({ success: true, message: "LinkedIn disconnected. Client can reconnect via invite link." });
  } catch (error) {
    console.error("[Clients] Disconnect error:", error.message || error);
    res.status(500).json({ error: "Server error" });
  }
});
router6.delete("/:id", async (req, res) => {
  try {
    const clientId = req.params.id;
    console.log(`[Clients] DELETE_START client_id=${clientId.substring(0, 8)}...`);
    const { error: e1 } = await supabase.from("prospects").delete().eq("client_id", clientId);
    if (e1) console.warn(`[Clients] DELETE prospects warn:`, e1.message);
    const { error: e2 } = await supabase.from("prospect_import_jobs").delete().eq("client_id", clientId);
    if (e2) console.warn(`[Clients] DELETE import_jobs warn:`, e2.message);
    const { error: e3 } = await supabase.from("linkedin_connections").delete().eq("client_id", clientId);
    if (e3) console.warn(`[Clients] DELETE linkedin_connections warn:`, e3.message);
    const { error: e4 } = await supabase.from("client_invites").delete().eq("client_id", clientId);
    if (e4) console.warn(`[Clients] DELETE invites warn:`, e4.message);
    const { error: e5 } = await supabase.from("oauth_states").delete().eq("client_id", clientId);
    if (e5) console.warn(`[Clients] DELETE oauth_states warn:`, e5.message);
    const { error: e6 } = await supabase.from("clients").delete().eq("id", clientId);
    if (e6) {
      console.error(`[Clients] DELETE client fail:`, e6.message);
      return res.status(500).json({ error: "Failed to delete client record" });
    }
    console.log(`[Clients] DELETE_OK client_id=${clientId.substring(0, 8)}...`);
    res.json({ success: true, message: "Client and all associated data deleted." });
  } catch (error) {
    console.error("[Clients] Delete error:", error.message || error);
    res.status(500).json({ error: "Server error" });
  }
});
var clientRoutes_default = router6;

// server/_core/sequenceRoutes.ts
import { Router as Router7 } from "express";
var router7 = Router7();
function getTeamId2(req) {
  const user = req.user;
  if (!user) return null;
  if (user.role === "super_admin" && req.query.target_team_id) {
    return req.query.target_team_id;
  }
  return user.teamId || null;
}
function replaceVariables(template, prospect) {
  if (!template) return "";
  return template.replace(/\{\{firstName\}\}/g, prospect?.name?.split(" ")[0] || prospect?.first_name || "").replace(/\{\{lastName\}\}/g, prospect?.name?.split(" ").slice(1).join(" ") || prospect?.last_name || "").replace(/\{\{company\}\}/g, prospect?.company || "").replace(/\{\{jobTitle\}\}/g, prospect?.title || prospect?.headline || "");
}
router7.get("/campaigns/:id/steps", async (req, res) => {
  try {
    const teamId = getTeamId2(req);
    if (!teamId) return res.status(401).json({ error: "Unauthorized" });
    const { data: campaign } = await supabase.from("campaigns").select("id").eq("id", req.params.id).eq("team_id", teamId).single();
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    const { data: steps, error } = await supabase.from("campaign_steps").select("*").eq("campaign_id", req.params.id).order("step_number", { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, data: steps || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
router7.delete("/campaigns/:id", async (req, res) => {
  try {
    const teamId = getTeamId2(req);
    if (!teamId) return res.status(401).json({ error: "Unauthorized" });
    const { data: campaign } = await supabase.from("campaigns").select("id").eq("id", req.params.id).eq("team_id", teamId).single();
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    await supabase.from("prospect_step_status").delete().eq("campaign_id", req.params.id);
    await supabase.from("campaign_steps").delete().eq("campaign_id", req.params.id);
    const { error } = await supabase.from("campaigns").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, deleted: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
router7.post("/campaigns/:id/steps", async (req, res) => {
  try {
    const teamId = getTeamId2(req);
    if (!teamId) return res.status(401).json({ error: "Unauthorized" });
    const { data: campaign } = await supabase.from("campaigns").select("id").eq("id", req.params.id).eq("team_id", teamId).single();
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    const { steps } = req.body;
    if (!Array.isArray(steps)) return res.status(400).json({ error: "steps array required" });
    const typeMap = {
      "visit": "visit",
      "follow": "follow",
      "invitation": "invitation",
      "message": "message",
      "email": "email",
      "delay": "delay",
      "condition": "condition",
      "invite": "invitation",
      "connection_request": "invitation",
      "follow_up": "follow",
      "follow_up_message": "follow",
      "followup": "follow"
    };
    await supabase.from("campaign_steps").delete().eq("campaign_id", req.params.id);
    const stepsToInsert = steps.map((step, index) => ({
      campaign_id: req.params.id,
      step_number: index + 1,
      step_type: typeMap[step.step_type] || step.step_type,
      name: step.name || `Step ${index + 1}`,
      configuration: step.configuration || {},
      message_template: step.message_template || null,
      delay_days: step.delay_days || 0
    }));
    const { data: inserted, error } = await supabase.from("campaign_steps").insert(stepsToInsert).select();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, data: inserted });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
router7.post("/campaigns/:id/enroll", async (req, res) => {
  try {
    const teamId = getTeamId2(req);
    if (!teamId) return res.status(401).json({ error: "Unauthorized" });
    const { data: campaign } = await supabase.from("campaigns").select("id").eq("id", req.params.id).eq("team_id", teamId).single();
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    const { prospect_ids } = req.body;
    if (!Array.isArray(prospect_ids) || prospect_ids.length === 0) {
      return res.status(400).json({ error: "prospect_ids array required" });
    }
    const { data: steps } = await supabase.from("campaign_steps").select("id, step_number, step_type, delay_days").eq("campaign_id", req.params.id).order("step_number", { ascending: true });
    if (!steps || steps.length === 0) {
      return res.status(400).json({ error: "Campaign has no steps configured" });
    }
    const statusRows = [];
    const now = (/* @__PURE__ */ new Date()).toISOString();
    for (const prospectId of prospect_ids) {
      for (const step of steps) {
        statusRows.push({
          prospect_id: prospectId,
          campaign_id: req.params.id,
          step_id: step.id,
          status: step.step_number === 1 ? "pending" : "waiting",
          scheduled_at: step.step_number === 1 ? now : null
        });
      }
    }
    const chunkSize = 50;
    let totalInserted = 0;
    for (let i = 0; i < statusRows.length; i += chunkSize) {
      const chunk = statusRows.slice(i, i + chunkSize);
      const { data: inserted, error } = await supabase.from("prospect_step_status").insert(chunk).select();
      if (error) {
        console.error(`[Enroll] Chunk ${Math.floor(i / chunkSize) + 1} error:`, error.message);
        continue;
      }
      totalInserted += inserted?.length || 0;
    }
    res.json({
      success: true,
      enrolled: prospect_ids.length,
      steps_created: totalInserted
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
router7.get("/campaigns/:id/activity", async (req, res) => {
  try {
    const teamId = getTeamId2(req);
    if (!teamId) return res.status(401).json({ error: "Unauthorized" });
    const { data: campaign } = await supabase.from("campaigns").select("id").eq("id", req.params.id).eq("team_id", teamId).single();
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    const { data: items, error } = await supabase.from("prospect_step_status").select(`
        id,
        status,
        executed_at,
        updated_at,
        campaign_steps (step_type, step_number, name),
        prospects (name, photo_url)
      `).eq("campaign_id", req.params.id).in("status", ["completed", "failed", "in_progress"]).order("updated_at", { ascending: false }).limit(20);
    if (error) return res.status(500).json({ error: error.message });
    const activity = (items || []).map((item) => ({
      id: item.id,
      prospectName: item.prospects?.name || "Unknown",
      photoUrl: item.prospects?.photo_url || null,
      stepType: item.campaign_steps?.step_type || "unknown",
      stepName: item.campaign_steps?.name || "",
      status: item.status,
      executedAt: item.executed_at || item.updated_at
    }));
    res.json({ success: true, activity });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
router7.get("/campaigns/:id/queue", async (req, res) => {
  try {
    const teamId = getTeamId2(req);
    if (!teamId) return res.status(401).json({ error: "Unauthorized" });
    const { data: campaign } = await supabase.from("campaigns").select("id").eq("id", req.params.id).eq("team_id", teamId).single();
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    const { data: queueItems, error } = await supabase.from("prospect_step_status").select(`
        id,
        prospect_id,
        step_id,
        status,
        scheduled_at,
        campaign_steps!inner (
          step_type,
          step_number,
          message_template,
          name
        ),
        prospects!inner (
          linkedin_url,
          name,
          title,
          company,
          first_name,
          last_name
        )
      `).eq("campaign_id", req.params.id).eq("status", "pending").lte("scheduled_at", (/* @__PURE__ */ new Date()).toISOString()).order("scheduled_at", { ascending: true }).limit(50);
    if (error) return res.status(500).json({ error: error.message });
    const queue = (queueItems || []).map((item) => {
      const step = item.campaign_steps;
      const prospect = item.prospects;
      return {
        prospectStepId: item.id,
        prospectId: item.prospect_id,
        stepId: item.step_id,
        stepType: step?.step_type,
        stepNumber: step?.step_number,
        stepName: step?.name,
        linkedinUrl: prospect?.linkedin_url,
        prospectName: prospect?.name || `${prospect?.first_name || ""} ${prospect?.last_name || ""}`.trim(),
        messageTemplate: replaceVariables(step?.message_template, prospect),
        scheduledAt: item.scheduled_at
      };
    });
    res.json({ success: true, data: queue });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
router7.post("/step/complete", async (req, res) => {
  try {
    const teamId = getTeamId2(req);
    if (!teamId) return res.status(401).json({ error: "Unauthorized" });
    const { prospectStepId, status, errorMessage } = req.body;
    if (!prospectStepId || !status) {
      return res.status(400).json({ error: "prospectStepId and status required" });
    }
    if (!["completed", "failed"].includes(status)) {
      return res.status(400).json({ error: "status must be completed or failed" });
    }
    const { data: currentStep, error: fetchError } = await supabase.from("prospect_step_status").select(`
        id,
        prospect_id,
        campaign_id,
        step_id,
        campaign_steps!inner (
          step_number,
          step_type
        )
      `).eq("id", prospectStepId).single();
    if (fetchError || !currentStep) {
      return res.status(404).json({ error: "Step status not found" });
    }
    const { data: campaign } = await supabase.from("campaigns").select("id").eq("id", currentStep.campaign_id).eq("team_id", teamId).single();
    if (!campaign) return res.status(403).json({ error: "Forbidden" });
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await supabase.from("prospect_step_status").update({
      status,
      executed_at: now,
      error_message: errorMessage || null
    }).eq("id", prospectStepId);
    if (status === "completed") {
      const currentStepData = currentStep.campaign_steps;
      const currentStepNumber = currentStepData.step_number;
      const currentStepType = currentStepData.step_type;
      const { data: nextStepDef } = await supabase.from("campaign_steps").select("id, step_type, delay_days").eq("campaign_id", currentStep.campaign_id).eq("step_number", currentStepNumber + 1).single();
      if (nextStepDef) {
        const { data: nextStepStatus } = await supabase.from("prospect_step_status").select("id").eq("prospect_id", currentStep.prospect_id).eq("campaign_id", currentStep.campaign_id).eq("step_id", nextStepDef.id).single();
        if (nextStepStatus) {
          const nextStepType = nextStepDef.step_type;
          const delayDays = nextStepDef.delay_days || 0;
          if (currentStepType === "invitation" || currentStepType === "invite") {
            if (nextStepType === "message") {
              const { data: connection } = await supabase.from("linkedin_connections").select("connection_status").eq("prospect_id", currentStep.prospect_id).single();
              if (connection?.connection_status === "accepted") {
                const scheduledAt = delayDays > 0 ? new Date(Date.now() + delayDays * 864e5).toISOString() : now;
                await supabase.from("prospect_step_status").update({ status: "pending", scheduled_at: scheduledAt }).eq("id", nextStepStatus.id);
              } else {
                await supabase.from("acceptance_check_jobs").insert({
                  prospect_step_status_id: nextStepStatus.id,
                  prospect_id: currentStep.prospect_id,
                  campaign_id: currentStep.campaign_id,
                  next_check_at: new Date(Date.now() + 6 * 36e5).toISOString(),
                  // 6 hours
                  checks_remaining: 56
                  // 14 days * 4/day
                });
              }
            } else {
              const scheduledAt = delayDays > 0 ? new Date(Date.now() + delayDays * 864e5).toISOString() : now;
              await supabase.from("prospect_step_status").update({ status: "pending", scheduled_at: scheduledAt }).eq("id", nextStepStatus.id);
            }
          } else {
            const scheduledAt = delayDays > 0 ? new Date(Date.now() + delayDays * 864e5).toISOString() : now;
            await supabase.from("prospect_step_status").update({ status: "pending", scheduled_at: scheduledAt }).eq("id", nextStepStatus.id);
          }
        }
      }
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
router7.get("/campaigns/:id/stats", async (req, res) => {
  try {
    const teamId = getTeamId2(req);
    if (!teamId) return res.status(401).json({ error: "Unauthorized" });
    const { data: campaign } = await supabase.from("campaigns").select("id").eq("id", req.params.id).eq("team_id", teamId).single();
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    const { data: statuses, error } = await supabase.from("prospect_step_status").select(`
        step_id,
        status,
        campaign_steps!inner (
          step_number,
          step_type,
          name
        )
      `).eq("campaign_id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    const stepStats = {};
    for (const item of statuses || []) {
      const stepData = item.campaign_steps;
      const stepKey = item.step_id;
      if (!stepStats[stepKey]) {
        stepStats[stepKey] = {
          stepId: item.step_id,
          stepNumber: stepData.step_number,
          stepType: stepData.step_type,
          stepName: stepData.name,
          waiting: 0,
          pending: 0,
          in_progress: 0,
          completed: 0,
          failed: 0,
          skipped: 0
        };
      }
      stepStats[stepKey][item.status] = (stepStats[stepKey][item.status] || 0) + 1;
    }
    const stats = Object.values(stepStats).sort((a, b) => a.stepNumber - b.stepNumber);
    const sent = (statuses || []).filter((s) => s.status === "completed").length;
    const inProgress = (statuses || []).filter((s) => ["pending", "in_progress"].includes(s.status)).length;
    const failed = (statuses || []).filter((s) => s.status === "failed").length;
    const inviteSteps = (statuses || []).filter(
      (s) => s.campaign_steps?.step_type === "invitation" || s.campaign_steps?.step_type === "invite"
    );
    const inviteCompleted = inviteSteps.filter((s) => s.status === "completed").length;
    let accepted = 0;
    if (inviteCompleted > 0) {
      const prospectIds = Array.from(new Set(inviteSteps.filter((s) => s.status === "completed").map((s) => s.prospect_id || "")));
      if (prospectIds.length > 0) {
        const { count } = await supabase.from("prospects").select("id", { count: "exact", head: true }).in("id", prospectIds).eq("connection_status", "accepted");
        accepted = count || 0;
      }
    }
    const acceptanceRate = inviteCompleted > 0 ? Math.round(accepted / inviteCompleted * 100) : 0;
    res.json({
      success: true,
      data: {
        steps: stats,
        summary: { sent, inProgress, failed, inviteCompleted, accepted, acceptanceRate }
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
router7.get("/campaigns/:id/prospect-status", async (req, res) => {
  try {
    const teamId = getTeamId2(req);
    if (!teamId) return res.status(401).json({ error: "Unauthorized" });
    const { data: campaign } = await supabase.from("campaigns").select("id").eq("id", req.params.id).eq("team_id", teamId).single();
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    const { data: statuses, error } = await supabase.from("prospect_step_status").select(`
        id,
        prospect_id,
        step_id,
        status,
        executed_at,
        error_message,
        campaign_steps!inner (
          step_number,
          step_type,
          name
        ),
        prospects!inner (
          name,
          linkedin_url,
          company,
          title,
          connection_status
        )
      `).eq("campaign_id", req.params.id).order("created_at", { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    const { data: checkJobs } = await supabase.from("acceptance_check_jobs").select("prospect_id, last_checked_at").eq("campaign_id", req.params.id);
    const lastCheckedMap = {};
    for (const job of checkJobs || []) {
      lastCheckedMap[job.prospect_id] = job.last_checked_at;
    }
    const prospectMap = {};
    for (const item of statuses || []) {
      const prospect = item.prospects;
      const step = item.campaign_steps;
      if (!prospectMap[item.prospect_id]) {
        prospectMap[item.prospect_id] = {
          prospectId: item.prospect_id,
          name: prospect.name,
          linkedinUrl: prospect.linkedin_url,
          company: prospect.company,
          title: prospect.title,
          connectionStatus: prospect.connection_status || "none",
          lastCheckedAt: lastCheckedMap[item.prospect_id] || null,
          steps: {}
        };
      }
      prospectMap[item.prospect_id].steps[step.step_number] = {
        stepId: item.step_id,
        stepType: step.step_type,
        stepName: step.name,
        status: item.status,
        executedAt: item.executed_at,
        errorMessage: item.error_message
      };
    }
    res.json({ success: true, data: Object.values(prospectMap) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
router7.get("/pending-acceptance-checks", async (req, res) => {
  try {
    const teamId = getTeamId2(req);
    if (!teamId) return res.status(401).json({ error: "Unauthorized" });
    const sixHoursAgo = new Date(Date.now() - 6 * 36e5).toISOString();
    const fourteenDaysAgo = new Date(Date.now() - 14 * 864e5).toISOString();
    const { data: jobs, error } = await supabase.from("acceptance_check_jobs").select(`
        id,
        prospect_id,
        prospect_step_status_id,
        campaign_id,
        last_checked_at,
        checks_remaining,
        created_at
      `).gt("checks_remaining", 0).gte("created_at", fourteenDaysAgo).or(`last_checked_at.is.null,last_checked_at.lt.${sixHoursAgo}`).limit(10);
    if (error) return res.status(500).json({ error: error.message });
    if (!jobs || jobs.length === 0) {
      return res.json({ success: true, data: [] });
    }
    const prospectIds = jobs.map((j) => j.prospect_id);
    const { data: prospects } = await supabase.from("prospects").select("id, linkedin_url, name, company, connection_status").in("id", prospectIds);
    const prospectMap = {};
    for (const p of prospects || []) {
      prospectMap[p.id] = p;
    }
    const campaignIds = Array.from(new Set(jobs.map((j) => j.campaign_id)));
    const { data: campaigns } = await supabase.from("campaigns").select("id").in("id", campaignIds).eq("team_id", teamId);
    const validCampaignIds = new Set((campaigns || []).map((c) => c.id));
    const result = jobs.filter((j) => validCampaignIds.has(j.campaign_id)).map((j) => ({
      jobId: j.id,
      prospectId: j.prospect_id,
      prospectStepStatusId: j.prospect_step_status_id,
      campaignId: j.campaign_id,
      linkedinUrl: prospectMap[j.prospect_id]?.linkedin_url || "",
      prospectName: prospectMap[j.prospect_id]?.name || "Unknown",
      currentStatus: prospectMap[j.prospect_id]?.connection_status || "none",
      lastCheckedAt: j.last_checked_at,
      checksRemaining: j.checks_remaining
    }));
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
router7.post("/update-connection-status", async (req, res) => {
  try {
    const teamId = getTeamId2(req);
    if (!teamId) return res.status(401).json({ error: "Unauthorized" });
    const { prospectId, status, jobId } = req.body;
    if (!prospectId || !status) {
      return res.status(400).json({ error: "prospectId and status required" });
    }
    if (!["accepted", "pending", "withdrawn"].includes(status)) {
      return res.status(400).json({ error: "status must be accepted, pending, or withdrawn" });
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await supabase.from("prospects").update({ connection_status: status }).eq("id", prospectId);
    const { data: existingConn } = await supabase.from("linkedin_connections").select("id").eq("prospect_id", prospectId).single();
    if (existingConn) {
      await supabase.from("linkedin_connections").update({ connection_status: status }).eq("prospect_id", prospectId);
    }
    if (status === "accepted") {
      const { data: job } = jobId ? await supabase.from("acceptance_check_jobs").select("*").eq("id", jobId).single() : await supabase.from("acceptance_check_jobs").select("*").eq("prospect_id", prospectId).limit(1).single();
      if (job) {
        const { data: pss } = await supabase.from("prospect_step_status").select("step_id, campaign_steps!inner(delay_days)").eq("id", job.prospect_step_status_id).single();
        const delayDays = pss?.campaign_steps?.delay_days || 0;
        const scheduledAt = delayDays > 0 ? new Date(Date.now() + delayDays * 864e5).toISOString() : now;
        await supabase.from("prospect_step_status").update({ status: "pending", scheduled_at: scheduledAt }).eq("id", job.prospect_step_status_id);
        await supabase.from("acceptance_check_jobs").delete().eq("id", job.id);
        console.log(`[ConnSync] \u2713 ${prospectId} accepted \u2192 Message 1 unlocked`);
      }
      res.json({ success: true, action: "unlocked_message", prospectId });
    } else if (status === "withdrawn") {
      const { data: job } = jobId ? await supabase.from("acceptance_check_jobs").select("*").eq("id", jobId).single() : await supabase.from("acceptance_check_jobs").select("*").eq("prospect_id", prospectId).limit(1).single();
      if (job) {
        await supabase.from("prospect_step_status").update({ status: "skipped", error_message: "Connection withdrawn/expired" }).eq("id", job.prospect_step_status_id);
        const { data: laterSteps } = await supabase.from("prospect_step_status").select("id").eq("prospect_id", prospectId).eq("campaign_id", job.campaign_id).eq("status", "waiting");
        if (laterSteps && laterSteps.length > 0) {
          await supabase.from("prospect_step_status").update({ status: "skipped", error_message: "Connection not established" }).in("id", laterSteps.map((s) => s.id));
        }
        await supabase.from("acceptance_check_jobs").delete().eq("id", job.id);
        console.log(`[ConnSync] \u2717 ${prospectId} withdrawn \u2192 steps skipped`);
      }
      res.json({ success: true, action: "skipped", prospectId });
    } else {
      if (jobId) {
        const { data: job } = await supabase.from("acceptance_check_jobs").select("checks_remaining").eq("id", jobId).single();
        await supabase.from("acceptance_check_jobs").update({
          last_checked_at: now,
          checks_remaining: (job?.checks_remaining || 56) - 1
        }).eq("id", jobId);
      } else {
        await supabase.from("acceptance_check_jobs").update({ last_checked_at: now }).eq("prospect_id", prospectId);
      }
      res.json({ success: true, action: "still_pending", prospectId });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
router7.post("/campaigns/pause", async (req, res) => {
  try {
    const teamId = getTeamId2(req);
    if (!teamId) return res.status(401).json({ error: "Unauthorized" });
    const { campaignId, reason } = req.body;
    if (!campaignId) return res.status(400).json({ error: "campaignId required" });
    const { error } = await supabase.from("campaigns").update({ status: "paused" }).eq("id", campaignId).eq("team_id", teamId);
    if (error) return res.status(500).json({ error: error.message });
    console.log(`[Sequence] Campaign ${campaignId} paused. Reason: ${reason || "unknown"}`);
    res.json({ success: true, message: "Campaign paused" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
router7.post("/check-acceptances", async (req, res) => {
  try {
    const teamId = getTeamId2(req);
    if (!teamId) return res.status(401).json({ error: "Unauthorized" });
    const { data: jobs, error } = await supabase.from("acceptance_check_jobs").select("*").lte("next_check_at", (/* @__PURE__ */ new Date()).toISOString()).gt("checks_remaining", 0).limit(50);
    if (error) return res.status(500).json({ error: error.message });
    let unlocked = 0;
    let expired = 0;
    let deferred = 0;
    for (const job of jobs || []) {
      const { data: connection } = await supabase.from("linkedin_connections").select("connection_status").eq("prospect_id", job.prospect_id).single();
      if (connection?.connection_status === "accepted") {
        const { data: pss } = await supabase.from("prospect_step_status").select("step_id, campaign_steps!inner(delay_days)").eq("id", job.prospect_step_status_id).single();
        const delayDays = pss?.campaign_steps?.delay_days || 0;
        const scheduledAt = delayDays > 0 ? new Date(Date.now() + delayDays * 864e5).toISOString() : (/* @__PURE__ */ new Date()).toISOString();
        await supabase.from("prospect_step_status").update({ status: "pending", scheduled_at: scheduledAt }).eq("id", job.prospect_step_status_id);
        await supabase.from("acceptance_check_jobs").delete().eq("id", job.id);
        unlocked++;
      } else if (job.checks_remaining <= 1) {
        await supabase.from("prospect_step_status").update({ status: "skipped", error_message: "Connection not accepted within 14 days" }).eq("id", job.prospect_step_status_id);
        await supabase.from("acceptance_check_jobs").delete().eq("id", job.id);
        expired++;
      } else {
        await supabase.from("acceptance_check_jobs").update({
          next_check_at: new Date(Date.now() + 6 * 36e5).toISOString(),
          checks_remaining: job.checks_remaining - 1
        }).eq("id", job.id);
        deferred++;
      }
    }
    res.json({ success: true, unlocked, expired, deferred });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
router7.get("/campaigns/:id/analytics", async (req, res) => {
  try {
    const teamId = getTeamId2(req);
    if (!teamId) return res.status(401).json({ error: "Unauthorized" });
    const campaignId = req.params.id;
    const { data: campaign } = await supabase.from("campaigns").select("id, created_at, status").eq("id", campaignId).eq("team_id", teamId).single();
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    const { data: statuses } = await supabase.from("prospect_step_status").select(`
        prospect_id,
        status,
        executed_at,
        campaign_steps!inner (
          step_type,
          step_number,
          name
        )
      `).eq("campaign_id", campaignId);
    const prospectIds = Array.from(new Set((statuses || []).map((s) => s.prospect_id)));
    let prospects = [];
    if (prospectIds.length > 0) {
      const { data } = await supabase.from("prospects").select("id, connection_status, replied_at, reply_detected").in("id", prospectIds);
      prospects = data || [];
    }
    const prospectMap = {};
    for (const p of prospects) {
      prospectMap[p.id] = p;
    }
    const enrolled = prospectIds.length;
    let visited = 0, invited = 0, messaged = 0, followedUp = 0;
    const prospectSteps = {};
    for (const s of statuses || []) {
      const step = s.campaign_steps;
      if (!prospectSteps[s.prospect_id]) prospectSteps[s.prospect_id] = {};
      prospectSteps[s.prospect_id][`${step.step_type}_${step.step_number}`] = s.status;
      if (s.status === "completed") {
        if (step.step_type === "visit") visited++;
        if (step.step_type === "invitation" || step.step_type === "invite") invited++;
        if (step.step_type === "message") {
          const messageStepNums = (statuses || []).filter((st) => st.campaign_steps.step_type === "message").map((st) => st.campaign_steps.step_number).sort((a, b) => a - b);
          const firstMessageNum = messageStepNums[0];
          if (step.step_number === firstMessageNum) messaged++;
          else followedUp++;
        }
      }
    }
    const accepted = prospects.filter((p) => p.connection_status === "accepted").length;
    const replied = prospects.filter((p) => p.reply_detected).length;
    const acceptanceRate = invited > 0 ? Math.round(accepted / invited * 100) : 0;
    const messageRate = accepted > 0 ? Math.round(messaged / accepted * 100) : 0;
    const replyRate = messaged > 0 ? Math.round(replied / messaged * 100) : 0;
    const startDate = campaign.created_at;
    const daysRunning = Math.max(1, Math.ceil((Date.now() - new Date(startDate).getTime()) / 864e5));
    let avgDaysToAccept = 0;
    if (accepted > 0) {
      const acceptTimes = [];
      for (const pid of prospectIds) {
        const p = prospectMap[pid];
        if (p?.connection_status !== "accepted") continue;
        const inviteStep = (statuses || []).find(
          (s) => s.prospect_id === pid && s.status === "completed" && (s.campaign_steps.step_type === "invitation" || s.campaign_steps.step_type === "invite")
        );
        if (inviteStep?.executed_at) {
          const msgStep = (statuses || []).find(
            (s) => s.prospect_id === pid && s.status === "completed" && s.campaign_steps.step_type === "message"
          );
          if (msgStep?.executed_at) {
            const days = (new Date(msgStep.executed_at).getTime() - new Date(inviteStep.executed_at).getTime()) / 864e5;
            if (days > 0) acceptTimes.push(days);
          }
        }
      }
      if (acceptTimes.length > 0) {
        avgDaysToAccept = Math.round(acceptTimes.reduce((a, b) => a + b, 0) / acceptTimes.length * 10) / 10;
      }
    }
    const remainingProspects = enrolled - visited;
    const prospectsPerDay = daysRunning > 0 ? visited / daysRunning : 0;
    const estimatedDaysLeft = prospectsPerDay > 0 ? Math.ceil(remainingProspects / prospectsPerDay) : null;
    const { data: snapshots } = await supabase.from("campaign_analytics_snapshots").select("*").eq("campaign_id", campaignId).order("snapshot_date", { ascending: true }).limit(14);
    res.json({
      success: true,
      data: {
        funnel: { enrolled, visited, invited, accepted, messaged, followedUp, replied },
        rates: {
          acceptanceRate: `${acceptanceRate}%`,
          messageRate: `${messageRate}%`,
          replyRate: `${replyRate}%`
        },
        time: {
          startDate,
          daysRunning,
          avgDaysToAccept,
          estimatedDaysLeft
        },
        dailySnapshots: snapshots || []
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
router7.post("/campaigns/:id/snapshot", async (req, res) => {
  try {
    const teamId = getTeamId2(req);
    if (!teamId) return res.status(401).json({ error: "Unauthorized" });
    const campaignId = req.params.id;
    const { data: campaign } = await supabase.from("campaigns").select("id").eq("id", campaignId).eq("team_id", teamId).single();
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    const { data: statuses } = await supabase.from("prospect_step_status").select("prospect_id, status, campaign_steps!inner(step_type, step_number)").eq("campaign_id", campaignId);
    const prospectIds = Array.from(new Set((statuses || []).map((s) => s.prospect_id)));
    let visitsD = 0, invitesD = 0, messagesD = 0, followUpsD = 0;
    const messageNums = (statuses || []).filter((s) => s.campaign_steps.step_type === "message").map((s) => s.campaign_steps.step_number).sort((a, b) => a - b);
    const firstMsgNum = messageNums.length > 0 ? messageNums[0] : 999;
    for (const s of statuses || []) {
      if (s.status !== "completed") continue;
      const step = s.campaign_steps;
      if (step.step_type === "visit") visitsD++;
      if (step.step_type === "invitation" || step.step_type === "invite") invitesD++;
      if (step.step_type === "message") {
        if (step.step_number === firstMsgNum) messagesD++;
        else followUpsD++;
      }
    }
    let acceptedD = 0, repliesD = 0;
    if (prospectIds.length > 0) {
      const { count: ac } = await supabase.from("prospects").select("id", { count: "exact", head: true }).in("id", prospectIds).eq("connection_status", "accepted");
      acceptedD = ac || 0;
      const { count: rc } = await supabase.from("prospects").select("id", { count: "exact", head: true }).in("id", prospectIds).eq("reply_detected", true);
      repliesD = rc || 0;
    }
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const { data: existing } = await supabase.from("campaign_analytics_snapshots").select("id").eq("campaign_id", campaignId).eq("snapshot_date", today).single();
    if (existing) {
      await supabase.from("campaign_analytics_snapshots").update({
        enrolled: prospectIds.length,
        visits_done: visitsD,
        invites_sent: invitesD,
        accepted: acceptedD,
        messages_sent: messagesD,
        follow_ups_sent: followUpsD,
        replies: repliesD
      }).eq("id", existing.id);
    } else {
      await supabase.from("campaign_analytics_snapshots").insert({
        campaign_id: campaignId,
        snapshot_date: today,
        enrolled: prospectIds.length,
        visits_done: visitsD,
        invites_sent: invitesD,
        accepted: acceptedD,
        messages_sent: messagesD,
        follow_ups_sent: followUpsD,
        replies: repliesD
      });
    }
    res.json({ success: true, snapshot: { date: today, enrolled: prospectIds.length, visits: visitsD, invites: invitesD, accepted: acceptedD, messages: messagesD, followUps: followUpsD, replies: repliesD } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
router7.post("/prospects/:id/mark-replied", async (req, res) => {
  try {
    const teamId = getTeamId2(req);
    if (!teamId) return res.status(401).json({ error: "Unauthorized" });
    const prospectId = req.params.id;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const { data: pss } = await supabase.from("prospect_step_status").select("campaign_id").eq("prospect_id", prospectId).limit(1).single();
    if (!pss) return res.status(404).json({ error: "Prospect not found in any campaign" });
    const { data: campaign } = await supabase.from("campaigns").select("id").eq("id", pss.campaign_id).eq("team_id", teamId).single();
    if (!campaign) return res.status(403).json({ error: "Forbidden" });
    await supabase.from("prospects").update({ replied_at: now, reply_detected: true }).eq("id", prospectId);
    const { data: waitingSteps } = await supabase.from("prospect_step_status").select("id, step_id, campaign_steps!inner(step_type, step_number)").eq("prospect_id", prospectId).eq("status", "waiting");
    const messageSteps = (waitingSteps || []).filter(
      (s) => s.campaign_steps.step_type === "message"
    );
    if (messageSteps.length > 0) {
      const nextStep = messageSteps.sort(
        (a, b) => a.campaign_steps.step_number - b.campaign_steps.step_number
      )[0];
      await supabase.from("prospect_step_status").update({ status: "pending", scheduled_at: now }).eq("id", nextStep.id);
      console.log(`[Analytics] \u2713 ${prospectId} replied \u2192 Follow-up unlocked`);
    }
    res.json({ success: true, prospectId, repliedAt: now });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
router7.get("/queue/active", async (req, res) => {
  try {
    const teamId = getTeamId2(req);
    if (!teamId) return res.status(401).json({ error: "Unauthorized" });
    const { data: activeCampaigns, error: campError } = await supabase.from("campaigns").select("id").eq("team_id", teamId).in("status", ["active"]);
    if (campError || !activeCampaigns || activeCampaigns.length === 0) {
      console.log(`[Queue] No active campaigns for team=${teamId}`);
      return res.json({ success: true, queue: [], count: 0 });
    }
    const campaignIds = activeCampaigns.map((c) => c.id);
    console.log(`[Queue] Active campaigns: ${campaignIds.length} for team=${teamId}`);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const { data: items, error: qError } = await supabase.from("prospect_step_status").select(`
        id,
        status,
        scheduled_at,
        step_id,
        prospect_id,
        campaign_id,
        campaign_steps (
          step_type,
          step_number,
          message_template,
          delay_days,
          name
        ),
        prospects (
          id,
          name,
          linkedin_url,
          title,
          company,
          reply_detected
        )
      `).in("campaign_id", campaignIds).eq("status", "pending").lte("scheduled_at", now).order("scheduled_at", { ascending: true }).limit(5);
    if (qError) {
      console.error("[Queue] Query error:", qError.message);
      return res.json({ success: true, queue: [], count: 0, error: qError.message });
    }
    console.log(`[Queue] Raw items found: ${items?.length || 0}`);
    const queue = (items || []).map((item) => {
      const step = item.campaign_steps;
      const prospect = item.prospects;
      let message = step?.message_template || "";
      if (prospect) {
        const nameParts = (prospect.name || "").split(" ");
        message = message.replace(/\{\{firstName\}\}/g, nameParts[0] || "").replace(/\{\{lastName\}\}/g, nameParts.slice(1).join(" ") || "").replace(/\{\{company\}\}/g, prospect.company || "").replace(/\{\{jobTitle\}\}/g, prospect.title || "");
      }
      return {
        prospectStepId: item.id,
        step_type: step?.step_type,
        step_number: step?.step_number,
        step_name: step?.name,
        delay_days: step?.delay_days,
        message,
        prospect_id: prospect?.id,
        name: prospect?.name,
        linkedin_url: prospect?.linkedin_url,
        title: prospect?.title,
        company: prospect?.company,
        reply_detected: prospect?.reply_detected,
        campaign_id: item.campaign_id
      };
    });
    console.log(`[Queue] Returning ${queue.length} pending actions`);
    res.json({ success: true, queue, count: queue.length });
  } catch (e) {
    console.error("[Queue] Error:", e);
    res.status(500).json({ error: e.message });
  }
});
router7.get("/debug/queue", async (_req, res) => {
  try {
    const { data, error } = await supabase.from("prospect_step_status").select(`
        id,
        status,
        scheduled_at,
        campaign_id,
        step_id,
        prospect_id,
        campaign_steps (step_type, step_number, name),
        prospects (name, linkedin_url),
        campaigns (name, status, team_id)
      `).eq("status", "pending").order("created_at", { ascending: false }).limit(20);
    if (error) {
      return res.json({ error: error.message, hint: error.hint });
    }
    const { data: counts } = await supabase.from("prospect_step_status").select("status").limit(100);
    const statusCounts = {};
    (counts || []).forEach((r) => {
      statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
    });
    res.json({
      pending_items: data?.length || 0,
      status_counts: statusCounts,
      items: data,
      now: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (e) {
    res.json({ error: e.message });
  }
});
router7.post("/step/complete", async (req, res) => {
  try {
    const teamId = getTeamId2(req);
    if (!teamId) return res.status(401).json({ error: "Unauthorized" });
    const { prospectStepId, status, errorMessage } = req.body;
    if (!prospectStepId || !status) {
      return res.status(400).json({ error: "prospectStepId and status required" });
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const { data: currentStep } = await supabase.from("prospect_step_status").select(`
        id, prospect_id, campaign_id, step_id,
        campaign_steps!inner (step_number, step_type)
      `).eq("id", prospectStepId).single();
    if (!currentStep) {
      return res.status(404).json({ error: "Step status not found" });
    }
    await supabase.from("prospect_step_status").update({
      status,
      completed_at: status === "completed" ? now : null,
      error_message: errorMessage || null
    }).eq("id", prospectStepId);
    if (status === "completed") {
      const stepData = currentStep.campaign_steps;
      const nextStepNumber = stepData.step_number + 1;
      const { data: nextStepDef } = await supabase.from("campaign_steps").select("id, step_type, delay_days, step_number").eq("campaign_id", currentStep.campaign_id).eq("step_number", nextStepNumber).single();
      if (nextStepDef) {
        const { data: nextPSS } = await supabase.from("prospect_step_status").select("id").eq("prospect_id", currentStep.prospect_id).eq("step_id", nextStepDef.id).eq("campaign_id", currentStep.campaign_id).single();
        if (nextPSS) {
          if (nextStepDef.step_type === "follow" || nextStepDef.step_type === "message" && nextStepDef.step_number >= 4) {
            const { data: prospect } = await supabase.from("prospects").select("reply_detected").eq("id", currentStep.prospect_id).single();
            if (prospect?.reply_detected) {
              await supabase.from("prospect_step_status").update({
                status: "skipped",
                error_message: "Replied \u2014 follow-up skipped"
              }).eq("id", nextPSS.id);
              console.log(`[Step] \u2713 Skipped follow-up for ${currentStep.prospect_id} \u2014 prospect replied`);
              return res.json({ success: true, skipped: true });
            }
          }
          const scheduledAt = /* @__PURE__ */ new Date();
          scheduledAt.setDate(scheduledAt.getDate() + (nextStepDef.delay_days || 0));
          await supabase.from("prospect_step_status").update({
            status: "pending",
            scheduled_at: scheduledAt.toISOString()
          }).eq("id", nextPSS.id);
          console.log(`[Step] \u2713 Next step ${nextStepDef.step_type} unlocked for ${currentStep.prospect_id}, scheduled at ${scheduledAt.toISOString()}`);
        }
      } else {
        console.log(`[Step] \u2713 All steps complete for prospect ${currentStep.prospect_id}`);
      }
    }
    res.json({ success: true });
  } catch (e) {
    console.error("[Step] Error:", e);
    res.status(500).json({ error: e.message });
  }
});
var sequenceRoutes_default = router7;

// server/_core/adminRoutes.ts
import { Router as Router8 } from "express";
import { createClient as createClient4 } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
var router8 = Router8();
function supabase2() {
  return createClient4(
    process.env.SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
async function logAction(adminId, action, targetUserId, metadata) {
  await supabase2().from("admin_activity_log").insert({
    admin_id: adminId,
    action,
    target_user_id: targetUserId || null,
    metadata: metadata || null
  });
}
router8.get("/overview", async (req, res) => {
  try {
    const sb = supabase2();
    const { count: totalTeams } = await sb.from("teams").select("*", { count: "exact", head: true });
    const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
    const { count: activeWeek } = await sb.from("teams").select("*", { count: "exact", head: true }).gte("last_active_at", weekAgo);
    const { count: activeCampaigns } = await sb.from("campaigns").select("*", { count: "exact", head: true }).eq("status", "active");
    const { count: totalProspects } = await sb.from("prospects").select("*", { count: "exact", head: true });
    const { data: recentLogs } = await sb.from("admin_activity_log").select("*").order("created_at", { ascending: false }).limit(10);
    const { data: recentProfiles } = await sb.from("profiles").select("id, email, full_name, created_at").order("created_at", { ascending: false }).limit(5);
    const activity = [
      ...(recentProfiles || []).map((p) => ({
        type: "signup",
        text: `New signup: ${p.email}`,
        name: p.full_name || p.email?.split("@")[0] || "User",
        time: p.created_at
      })),
      ...(recentLogs || []).map((l) => ({
        type: "admin",
        text: l.action,
        name: "Admin",
        time: l.created_at
      }))
    ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 10);
    res.json({
      metrics: {
        totalTeams: totalTeams || 0,
        activeWeek: activeWeek || 0,
        activeCampaigns: activeCampaigns || 0,
        totalProspects: totalProspects || 0
      },
      activity
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
router8.get("/customers", async (req, res) => {
  try {
    const sb = supabase2();
    const { data: teams } = await sb.from("teams").select("id, name, created_at, plan, status, last_active_at").order("created_at", { ascending: false });
    if (!teams) return res.json({ customers: [] });
    const teamIds = teams.map((t2) => t2.id);
    const { data: members } = await sb.from("team_members").select("team_id, user_id, role").in("team_id", teamIds);
    const ownerUserIds = (members || []).filter((m) => m.role === "owner").map((m) => m.user_id);
    const { data: profiles } = await sb.from("profiles").select("id, email, full_name").in("id", ownerUserIds.length > 0 ? ownerUserIds : ["none"]);
    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
    const memberMap = /* @__PURE__ */ new Map();
    (members || []).filter((m) => m.role === "owner").forEach((m) => memberMap.set(m.team_id, m));
    const { data: prospectCounts } = await sb.rpc("count_prospects_per_team");
    const prospectMap = /* @__PURE__ */ new Map();
    if (Array.isArray(prospectCounts)) {
      prospectCounts.forEach((r) => prospectMap.set(r.team_id, r.count));
    }
    const { data: campaigns } = await sb.from("campaigns").select("id, team_id").in("team_id", teamIds);
    const campaignCounts = /* @__PURE__ */ new Map();
    (campaigns || []).forEach((c) => {
      campaignCounts.set(c.team_id, (campaignCounts.get(c.team_id) || 0) + 1);
    });
    const customers = teams.map((t2) => {
      const ownerMember = memberMap.get(t2.id);
      const ownerProfile = ownerMember ? profileMap.get(ownerMember.user_id) : null;
      return {
        id: t2.id,
        name: t2.name || ownerProfile?.full_name || "Unknown",
        email: ownerProfile?.email || "",
        plan: t2.plan || "trial",
        status: t2.status || "active",
        prospects: prospectMap.get(t2.id) || 0,
        campaigns: campaignCounts.get(t2.id) || 0,
        lastActive: t2.last_active_at,
        createdAt: t2.created_at,
        userId: ownerMember?.user_id || null
      };
    });
    res.json({ customers });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
router8.get("/customers/:id", async (req, res) => {
  try {
    const sb = supabase2();
    const teamId = req.params.id;
    const { data: team } = await sb.from("teams").select("*").eq("id", teamId).single();
    if (!team) return res.status(404).json({ error: "Team not found" });
    const { data: owner } = await sb.from("team_members").select("user_id").eq("team_id", teamId).eq("role", "owner").single();
    let profile = null;
    if (owner) {
      const { data: p } = await sb.from("profiles").select("*").eq("id", owner.user_id).single();
      profile = p;
    }
    const { data: campaigns } = await sb.from("campaigns").select("id, name, status, type, created_at").eq("team_id", teamId).order("created_at", { ascending: false });
    const { count: prospectCount } = await sb.from("prospects").select("*", { count: "exact", head: true }).in("campaign_id", (campaigns || []).map((c) => c.id));
    const { count: invitesSent } = await sb.from("prospect_step_status").select("*", { count: "exact", head: true }).eq("step_type", "invite").eq("status", "completed").in("campaign_id", (campaigns || []).map((c) => c.id));
    const { count: accepted } = await sb.from("linkedin_connections").select("*", { count: "exact", head: true }).eq("connection_status", "accepted").eq("team_id", teamId);
    const acceptRate = invitesSent && invitesSent > 0 ? Math.round((accepted || 0) / invitesSent * 100) : 0;
    res.json({
      team,
      profile,
      campaigns: campaigns || [],
      metrics: {
        prospects: prospectCount || 0,
        activeCampaigns: (campaigns || []).filter((c) => c.status === "active").length,
        acceptanceRate: acceptRate,
        daysSinceSignup: Math.floor((Date.now() - new Date(team.created_at).getTime()) / 864e5)
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
router8.post("/customers/:id/suspend", async (req, res) => {
  try {
    const sb = supabase2();
    const teamId = req.params.id;
    const adminId = req.user?.id;
    const { data: team } = await sb.from("teams").select("status").eq("id", teamId).single();
    if (!team) return res.status(404).json({ error: "Team not found" });
    const newStatus = team.status === "suspended" ? "active" : "suspended";
    await sb.from("teams").update({ status: newStatus }).eq("id", teamId);
    await logAction(adminId, `${newStatus === "suspended" ? "Suspended" : "Unsuspended"} team`, void 0, { teamId });
    res.json({ status: newStatus });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
router8.post("/impersonate", async (req, res) => {
  try {
    const sb = supabase2();
    const adminId = req.user?.id;
    const { targetUserId } = req.body;
    if (!targetUserId) return res.status(400).json({ error: "targetUserId required" });
    const { data: adminProfile } = await sb.from("profiles").select("role").eq("id", adminId).single();
    if (!adminProfile || adminProfile.role !== "super_admin") {
      return res.status(403).json({ error: "Forbidden" });
    }
    const { data: targetProfile } = await sb.from("profiles").select("id, email, role, team_id").eq("id", targetUserId).single();
    if (!targetProfile) return res.status(404).json({ error: "User not found" });
    const secret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET || "fallback-secret";
    const token = jwt.sign(
      {
        sub: targetProfile.id,
        email: targetProfile.email,
        role: targetProfile.role || "client_user",
        team_id: targetProfile.team_id,
        impersonated_by: adminId,
        iss: "wassel-admin"
      },
      secret,
      { expiresIn: "1h" }
    );
    await logAction(adminId, `Impersonated user: ${targetProfile.email}`, targetUserId);
    res.json({
      token,
      user: {
        id: targetProfile.id,
        email: targetProfile.email,
        role: targetProfile.role
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
router8.get("/stats", async (req, res) => {
  try {
    const sb = supabase2();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 864e5).toISOString();
    const { data: recentProfiles } = await sb.from("profiles").select("created_at").gte("created_at", thirtyDaysAgo);
    const signupsByDay = /* @__PURE__ */ new Map();
    (recentProfiles || []).forEach((p) => {
      const day = p.created_at?.slice(0, 10);
      if (day) signupsByDay.set(day, (signupsByDay.get(day) || 0) + 1);
    });
    const { data: recentInvites } = await sb.from("prospect_step_status").select("completed_at").eq("step_type", "invite").eq("status", "completed").gte("completed_at", thirtyDaysAgo);
    const invitesByDay = /* @__PURE__ */ new Map();
    (recentInvites || []).forEach((i) => {
      const day = i.completed_at?.slice(0, 10);
      if (day) invitesByDay.set(day, (invitesByDay.get(day) || 0) + 1);
    });
    const { data: recentConnections } = await sb.from("linkedin_connections").select("connected_at").eq("connection_status", "accepted").gte("connected_at", thirtyDaysAgo);
    const connectionsByDay = /* @__PURE__ */ new Map();
    (recentConnections || []).forEach((c) => {
      const day = c.connected_at?.slice(0, 10);
      if (day) connectionsByDay.set(day, (connectionsByDay.get(day) || 0) + 1);
    });
    const dailyData = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(Date.now() - i * 864e5);
      const day = date.toISOString().slice(0, 10);
      dailyData.push({
        date: day,
        signups: signupsByDay.get(day) || 0,
        invites: invitesByDay.get(day) || 0,
        connections: connectionsByDay.get(day) || 0
      });
    }
    const { data: teams } = await sb.from("teams").select("id, name").limit(10);
    const tables = ["profiles", "teams", "campaigns", "prospects", "prospect_step_status", "linkedin_connections"];
    const tableCounts = {};
    for (const table of tables) {
      const { count } = await sb.from(table).select("*", { count: "exact", head: true });
      tableCounts[table] = count || 0;
    }
    res.json({
      dailyData,
      tableCounts,
      topTeams: teams || []
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
var adminRoutes_default = router8;

// server/_core/activityRoutes.ts
import { Router as Router9 } from "express";
var router9 = Router9();
function getTeamId3(req) {
  const user = req.user;
  if (!user) return null;
  if (user.role === "super_admin" && req.query.target_team_id) {
    return req.query.target_team_id;
  }
  return user.teamId || null;
}
router9.post("/", async (req, res) => {
  try {
    const userId = req.user?.id;
    console.log("[ActivityLog] POST received:", { userId, body: req.body });
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    let teamId = getTeamId3(req);
    if (!teamId) {
      const { data: membership } = await supabase.from("team_members").select("team_id").eq("user_id", userId).single();
      teamId = membership?.team_id || null;
    }
    const { action_type, status, prospect_name, linkedin_url, campaign_id, error_message } = req.body;
    if (!action_type || !status) {
      return res.status(400).json({ error: "action_type and status are required" });
    }
    const { error } = await supabase.from("activity_logs").insert({
      user_id: userId,
      team_id: teamId || null,
      campaign_id: campaign_id || null,
      action_type,
      status,
      prospect_name: prospect_name || null,
      linkedin_url: linkedin_url || null,
      error_message: error_message || null,
      executed_at: (/* @__PURE__ */ new Date()).toISOString()
    });
    if (error) {
      console.error("[ActivityLog] Insert error:", error.message);
      return res.status(500).json({ error: "Failed to log activity" });
    }
    res.json({ success: true });
  } catch (err) {
    console.error("[ActivityLog] POST error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});
router9.get("/", async (req, res) => {
  try {
    const userId = req.user?.id;
    console.log("[ActivityLog] GET requested by user:", userId);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    let teamId = getTeamId3(req);
    if (!teamId) {
      const { data: membership } = await supabase.from("team_members").select("team_id").eq("user_id", userId).single();
      teamId = membership?.team_id || null;
    }
    const limit = parseInt(req.query.limit) || 50;
    const campaignId = req.query.campaign_id;
    let query = supabase.from("activity_logs").select("id, action_type, status, prospect_name, linkedin_url, error_message, executed_at, created_at").order("created_at", { ascending: false }).limit(limit);
    if (teamId) {
      query = query.or(`team_id.eq.${teamId},user_id.eq.${userId}`);
    } else {
      query = query.eq("user_id", userId);
    }
    if (campaignId) {
      query = query.eq("campaign_id", campaignId);
    }
    const { data: logs, error } = await query;
    if (error) {
      console.error("[ActivityLog] GET error:", error.message);
      return res.json({ logs: [] });
    }
    res.json({ logs: logs || [] });
  } catch (err) {
    console.error("[ActivityLog] GET error:", err.message);
    res.json({ logs: [] });
  }
});
router9.get("/debug", async (req, res) => {
  try {
    const userId = req.user?.id;
    let teamId = getTeamId3(req);
    if (!teamId && userId) {
      const { data: membership } = await supabase.from("team_members").select("team_id").eq("user_id", userId).single();
      teamId = membership?.team_id || null;
    }
    let debugQuery = supabase.from("activity_logs").select("*", { count: "exact" }).order("created_at", { ascending: false }).limit(1);
    if (teamId) {
      debugQuery = debugQuery.eq("team_id", teamId);
    } else if (userId) {
      debugQuery = debugQuery.eq("user_id", userId);
    }
    const { data, error, count } = await debugQuery;
    const tableExists = !error || error.code !== "42P01";
    res.json({
      tableExists,
      rowCount: count || 0,
      lastEntry: data?.[0] || null,
      teamId,
      userId,
      error: error?.message || null,
      errorCode: error?.code || null
    });
  } catch (err) {
    res.json({ tableExists: false, error: err.message });
  }
});
var activityRoutes_default = router9;

// server/_core/aiRoutes.ts
import { Router as Router10 } from "express";
var router10 = Router10();
function getUserId2(req) {
  return req.userId || req.user?.id || null;
}
function detectGenderFromName(name) {
  if (!name) return "unknown";
  const first = name.trim().split(/\s+/)[0].toLowerCase();
  const femaleNames = /* @__PURE__ */ new Set([
    // Arabic female names
    "\u0633\u0627\u0631\u0629",
    "\u0646\u0648\u0631\u0629",
    "\u0646\u0648\u0641",
    "\u0631\u064A\u0645",
    "\u0645\u0631\u064A\u0645",
    "\u0641\u0627\u0637\u0645\u0629",
    "\u0647\u0646\u062F",
    "\u0644\u0637\u064A\u0641\u0629",
    "\u0623\u0645\u064A\u0631\u0629",
    "\u0639\u0627\u0626\u0634\u0629",
    "\u062E\u062F\u064A\u062C\u0629",
    "\u0632\u064A\u0646\u0628",
    "\u0631\u0646\u0627",
    "\u0644\u064A\u0644\u0649",
    "\u062F\u0627\u0646\u0627",
    "\u0631\u0647\u0641",
    "\u063A\u062F\u064A\u0631",
    "\u0645\u0646\u0649",
    "\u0623\u0633\u0645\u0627\u0621",
    "\u062C\u0648\u0627\u0647\u0631",
    "\u0646\u062C\u0644\u0627\u0621",
    "\u062D\u064A\u0627\u0629",
    "\u0648\u0641\u0627\u0621",
    "\u0633\u0645\u0631",
    "\u0634\u064A\u0645\u0627\u0621",
    "\u0625\u064A\u0645\u0627\u0646",
    "\u0625\u0633\u0631\u0627\u0621",
    "\u0647\u064A\u0627",
    "\u0628\u062F\u0631\u064A\u0629",
    "\u0644\u0645\u064A\u0627\u0621",
    "\u0645\u0644\u0627\u0643",
    "\u0634\u0647\u062F",
    "\u064A\u0627\u0631\u0627",
    "\u062C\u0648\u062F",
    "\u062A\u0627\u0644\u0627",
    "\u062F\u0644\u0627\u0644",
    "\u0631\u0634\u0627",
    "\u0645\u064A\u0633\u0627\u0621",
    "\u0647\u062F\u064A\u0644",
    "\u0623\u0631\u0648\u0649",
    "\u0644\u064A\u0646",
    "\u0628\u064A\u0627\u0646",
    "\u0645\u0647\u0627",
    "\u0633\u0644\u0645\u0649",
    "\u0648\u0644\u0627\u0621",
    "\u0622\u0645\u0627\u0644",
    "\u0622\u0644\u0627\u0621",
    "\u0623\u0631\u064A\u062C",
    "\u0623\u0641\u0646\u0627\u0646",
    "\u0635\u0641\u0627\u0621",
    "\u0646\u0647\u0649",
    // English female names
    "sara",
    "sarah",
    "emma",
    "olivia",
    "ava",
    "isabella",
    "sophia",
    "mia",
    "charlotte",
    "amelia",
    "harper",
    "evelyn",
    "abigail",
    "emily",
    "elizabeth",
    "mila",
    "ella",
    "avery",
    "sofia",
    "camila",
    "aria",
    "scarlett",
    "victoria",
    "madison",
    "luna",
    "grace",
    "chloe",
    "penelope",
    "layla",
    "riley",
    "zoey",
    "nora",
    "lily",
    "eleanor",
    "hannah",
    "lillian",
    "addison",
    "aubrey",
    "ellie",
    "stella",
    "natalie",
    "zoe",
    "leah",
    "hazel",
    "violet",
    "aurora",
    "savannah",
    "audrey",
    "brooklyn",
    "bella",
    "claire",
    "skylar",
    "lucy",
    "paisley",
    "anna",
    "caroline",
    "nova",
    "emilia",
    "kennedy",
    "samantha",
    "maya",
    "willow",
    "naomi",
    "aaliyah",
    "elena",
    "ariana",
    "allison",
    "alexa",
    "jennifer",
    "jasmine",
    "alice",
    "julia",
    "jessica",
    "ashley",
    "amanda",
    "stephanie",
    "melissa",
    "nicole",
    "amber",
    "linda",
    "danielle",
    "rebecca",
    "michelle",
    "sandra",
    "heather",
    "rachel",
    "diana",
    "andrea",
    "amy",
    "karen",
    "lisa",
    "patricia",
    "fatima",
    "noura"
  ]);
  const maleNames = /* @__PURE__ */ new Set([
    // Arabic male names
    "\u0645\u062D\u0645\u062F",
    "\u0623\u062D\u0645\u062F",
    "\u0639\u0644\u064A",
    "\u0639\u0645\u0631",
    "\u062E\u0627\u0644\u062F",
    "\u0639\u0628\u062F\u0627\u0644\u0644\u0647",
    "\u0633\u0639\u062F",
    "\u0641\u064A\u0635\u0644",
    "\u0628\u0646\u062F\u0631",
    "\u062A\u0631\u0643\u064A",
    "\u0633\u0644\u0637\u0627\u0646",
    "\u0646\u0627\u0635\u0631",
    "\u064A\u0648\u0633\u0641",
    "\u0625\u0628\u0631\u0627\u0647\u064A\u0645",
    "\u0639\u0628\u062F\u0627\u0644\u0631\u062D\u0645\u0646",
    "\u0639\u0628\u062F\u0627\u0644\u0639\u0632\u064A\u0632",
    "\u062D\u0645\u062F",
    "\u0632\u064A\u0627\u062F",
    "\u0635\u0627\u0644\u062D",
    "\u0639\u0627\u062F\u0644",
    "\u0637\u0627\u0631\u0642",
    "\u0631\u0627\u0645\u064A",
    "\u0628\u0627\u0633\u0645",
    "\u0648\u0644\u064A\u062F",
    "\u0647\u0627\u0646\u064A",
    "\u0623\u064A\u0645\u0646",
    "\u0643\u0631\u064A\u0645",
    "\u0634\u0631\u064A\u0641",
    "\u062D\u0633\u0627\u0645",
    "\u062A\u0627\u0645\u0631",
    "\u0645\u062D\u0645\u0648\u062F",
    "\u0645\u0635\u0637\u0641\u0649",
    "\u0645\u0627\u062C\u062F",
    "\u0633\u0627\u0645\u064A",
    "\u0646\u0627\u062F\u0631",
    "\u0639\u0628\u062F\u0627\u0644\u0643\u0631\u064A\u0645",
    "\u0645\u0646\u0635\u0648\u0631",
    "\u0639\u0645\u0631\u0648",
    "\u0645\u0627\u0632\u0646",
    "\u0648\u0627\u0626\u0644",
    "\u0623\u0633\u0627\u0645\u0629",
    "\u0632\u0643\u0631\u064A\u0627",
    "\u0645\u0639\u062A\u0632",
    "\u0639\u0632\u064A\u0632",
    "\u062D\u0627\u062A\u0645",
    "\u062C\u0644\u0627\u0644",
    "\u062C\u0645\u0627\u0644",
    // English male names
    "james",
    "john",
    "robert",
    "michael",
    "william",
    "david",
    "richard",
    "joseph",
    "thomas",
    "charles",
    "christopher",
    "daniel",
    "matthew",
    "anthony",
    "mark",
    "donald",
    "steven",
    "paul",
    "andrew",
    "joshua",
    "kenneth",
    "kevin",
    "brian",
    "george",
    "timothy",
    "ronald",
    "edward",
    "jason",
    "jeffrey",
    "ryan",
    "jacob",
    "gary",
    "nicholas",
    "eric",
    "jonathan",
    "stephen",
    "larry",
    "justin",
    "scott",
    "brandon",
    "benjamin",
    "samuel",
    "raymond",
    "frank",
    "gregory",
    "alexander",
    "patrick",
    "jack",
    "dennis",
    "tyler",
    "aaron",
    "jose",
    "henry",
    "adam",
    "douglas",
    "nathan",
    "peter",
    "zachary",
    "kyle",
    "noah",
    "ethan",
    "mason",
    "liam",
    "oliver",
    "elijah",
    "aiden",
    "lucas",
    "jackson",
    "logan",
    "caleb",
    "jayden",
    "grayson",
    "sebastian",
    "mateo",
    "owen",
    "muhammad",
    "omar",
    "ali",
    "ahmed",
    "hassan",
    "walid",
    "faisal",
    "khalid",
    "nasser",
    "yusuf",
    "ibrahim",
    "tariq",
    "sami"
  ]);
  if (femaleNames.has(first)) return "female";
  if (maleNames.has(first)) return "male";
  const firstWord = name.trim().split(/\s+/)[0];
  if (/[ةه]$/.test(firstWord) && firstWord.length > 2) return "female";
  return "unknown";
}
function detectStyleFromProfile(profile) {
  const title = (profile.title || "").toLowerCase();
  const company = (profile.company || "").toLowerCase();
  const isCLevel = /ceo|coo|cfo|cto|chief|رئيس|مدير عام/.test(title);
  const isDirector = /director|vp|vice|مدير|قائد/.test(title);
  const isManager = /manager|head|lead|مشرف/.test(title);
  const isSpecialist = /specialist|engineer|analyst|متخصص|مهندس|محلل/.test(title);
  const isOilGas = /aramco|sabic|saipem|oil|gas|drilling|petroleum|نفط|أرامكو/.test(company + title);
  const isTech = /tech|software|digital|تقنية|برمجة|رقمي/.test(company + title);
  const isHR = /hr|human resources|talent|recruitment|موارد بشرية|توظيف/.test(title);
  const isFinance = /finance|bank|investment|مالية|بنك|استثمار/.test(company + title);
  const isGovt = /ministry|government|وزارة|حكومة|هيئة/.test(company);
  let formality = "professional";
  let length = "medium";
  let approach = "value-first";
  if (isCLevel) {
    formality = "executive";
    length = "short";
    approach = "peer-to-peer";
  } else if (isDirector) {
    formality = "formal";
    length = "short";
    approach = "results-focused";
  } else if (isManager) {
    formality = "professional";
    length = "medium";
    approach = "problem-solution";
  } else if (isSpecialist) {
    formality = "friendly";
    length = "medium";
    approach = "expertise-recognition";
  }
  if (isOilGas) approach = "industry-specific-oilgas";
  if (isTech) approach = "innovation-focused";
  if (isHR) approach = "talent-focused";
  if (isGovt) {
    formality = "very-formal";
    approach = "vision2030-aligned";
  }
  return { formality, length, approach, isCLevel, isDirector, isOilGas, isTech, isHR, isGovt };
}
function buildSystemPrompt(userContext, prospectProfile, purpose, style, language, stepType, senderGender = "unknown") {
  const styleGuides = {
    executive: `Write as peer-to-peer executive communication.
Ultra concise \u2014 2 sentences max.
No pleasantries. Lead with the outcome/opportunity.
Example: "\u0623\u0647\u0644\u0627\u064B [\u0627\u0644\u0627\u0633\u0645]\u060C \u0646\u0633\u0627\u0639\u062F \u0642\u0627\u062F\u0629 \u0645\u062B\u0644\u0643 \u0639\u0644\u0649 [\u0627\u0644\u0646\u062A\u064A\u062C\u0629]. \u0647\u0644 \u064A\u0646\u0627\u0633\u0628\u0643 10 \u062F\u0642\u0627\u0626\u0642\u061F"`,
    formal: `Professional and respectful tone.
3 sentences: Hook \u2192 Value \u2192 CTA.
Reference their specific achievement or company.`,
    professional: `Warm but professional. 3-4 sentences.
Start with what you noticed about THEM specifically.
End with a soft, low-commitment ask.`,
    friendly: `Conversational and genuine. 3 sentences.
Sound like a real person, not a template.
Use their first name naturally.`,
    "very-formal": `Use respectful honorifics.
Reference Vision 2030 if relevant to their sector.
Very formal Arabic. No casual language.`
  };
  const approachGuides = {
    "value-first": "Lead with the value you bring, not who you are",
    "peer-to-peer": "Speak as an equal, not a vendor",
    "results-focused": "Mention a specific result/metric",
    "problem-solution": "Name their likely pain point first",
    "expertise-recognition": "Acknowledge their expertise first",
    "industry-specific-oilgas": "Reference oil & gas sector challenges: operational efficiency, HSE, project timelines",
    "innovation-focused": "Reference digital transformation, AI, or tech trends",
    "talent-focused": "Frame around people, culture, or talent strategy",
    "vision2030-aligned": "Connect to Vision 2030 goals when natural"
  };
  const maxLen = stepType === "invite" ? "300 characters (connection note limit)" : stepType === "post" ? "3000 characters" : "500 characters";
  const senderBlock = userContext.name || userContext.headline ? `You are writing ON BEHALF of:
Name: ${userContext.name || ""}
Role: ${userContext.headline || ""}

` : "";
  const recipientBlock = prospectProfile.name || prospectProfile.title || prospectProfile.company ? `You are writing TO:
Name: ${prospectProfile.name || "the recipient"}
Title: ${prospectProfile.title || ""}
Company: ${prospectProfile.company || ""}

` : "";
  const genderBlock = language === "ar" ? senderGender === "female" ? `SENDER GRAMMAR (Arabic): Sender is female \u2014 use feminine forms when sender refers to themselves:
  \u0645\u062A\u062E\u0635\u0635\u0629\u060C \u0645\u0647\u062A\u0645\u0629\u060C \u0633\u0639\u064A\u062F\u0629\u060C \u0645\u062A\u062D\u0645\u0633\u0629\u060C \u0623\u0639\u0645\u0644 \u0641\u064A (unchanged), \u0623\u0646\u0627 (unchanged)
  Example: "\u0623\u0646\u0627 \u0645\u062A\u062E\u0635\u0635\u0629 \u0641\u064A..." not "\u0645\u062A\u062E\u0635\u0635"

` : senderGender === "male" ? `SENDER GRAMMAR (Arabic): Sender is male \u2014 use masculine forms:
  \u0645\u062A\u062E\u0635\u0635\u060C \u0645\u0647\u062A\u0645\u060C \u0633\u0639\u064A\u062F\u060C \u0645\u062A\u062D\u0645\u0633

` : "" : "";
  return `You are an expert LinkedIn copywriter specializing in ${language === "ar" ? "Arabic" : "English"} outreach.

${senderBlock}${recipientBlock}${genderBlock}PURPOSE: ${purpose}
MESSAGE TYPE: ${stepType}
MAX LENGTH: ${maxLen}

STYLE GUIDE:
${styleGuides[style.formality] || styleGuides["professional"]}

APPROACH:
${approachGuides[style.approach] || approachGuides["value-first"]}

STRICT RULES:
1. Start with ${language === "ar" ? '"\u0623\u0647\u0644\u0627\u064B [\u0627\u0644\u0627\u0633\u0645]"' : '"Hi [Name]"'} if prospect name is known
2. ${style.length === "short" ? "2 sentences max" : "3-4 sentences total"}
3. ONE specific detail about THEM (their company or role)
4. ONE clear value proposition
5. ONE soft CTA at the end
6. ${stepType === "invite" ? "Max 280 characters for connection notes" : "Max 500 characters"}
7. Never use: "\u0623\u062A\u0645\u0646\u0649 \u0623\u0646 \u062A\u0643\u0648\u0646 \u0628\u062E\u064A\u0631" or "I hope this finds you well"
8. Never use: "\u0641\u0631\u064A\u0642 \u0631\u0627\u0626\u0639" or "amazing profile"
9. Sound human \u2014 not like a template
10. Return ONLY the message text, nothing else

EXAMPLES BY PURPOSE:
[Sales - Executive]: "\u0623\u0647\u0644\u0627\u064B \u062E\u0627\u0644\u062F\u060C \u0642\u064A\u0627\u062F\u062A\u0643 \u0644\u0639\u0645\u0644\u064A\u0627\u062A SABIC \u0627\u0644\u0631\u0642\u0645\u064A\u0629 \u0644\u0627\u0641\u062A\u0629. \u0646\u0633\u0627\u0639\u062F \u0645\u062F\u064A\u0631\u064A \u0627\u0644\u0639\u0645\u0644\u064A\u0627\u062A \u0639\u0644\u0649 \u062A\u0642\u0644\u064A\u0635 \u0648\u0642\u062A \u0627\u0644\u062A\u0642\u0627\u0631\u064A\u0631 40%. \u0647\u0644 \u062A\u0646\u0627\u0633\u0628\u0643 15 \u062F\u0642\u064A\u0642\u0629\u061F"
[Recruiting - HR]: "\u0623\u0647\u0644\u0627\u064B \u0633\u0627\u0631\u0629\u060C \u062E\u0628\u0631\u062A\u0643 \u0641\u064A \u0628\u0646\u0627\u0621 \u062B\u0642\u0627\u0641\u0629 \u0627\u0644\u0645\u0648\u0627\u0647\u0628 \u0641\u064A \u0627\u0644\u0642\u0637\u0627\u0639 \u0627\u0644\u0635\u062D\u064A \u0645\u0645\u064A\u0632\u0629. \u0644\u062F\u064A\u0646\u0627 \u0641\u0631\u0635\u0629 \u0642\u064A\u0627\u062F\u064A\u0629 \u0641\u064A \u0634\u0631\u0643\u0629 \u062A\u0642\u0646\u064A\u0629 \u0628\u0631\u0624\u064A\u0629 \u0648\u0627\u0636\u062D\u0629. \u0647\u0644 \u0623\u0646\u062A\u0650 \u0645\u0646\u0641\u062A\u062D\u0629 \u0639\u0644\u0649 \u0646\u0642\u0627\u0634\u061F"
[Networking - Oil & Gas]: "\u0623\u0647\u0644\u0627\u064B \u0645\u062D\u0645\u062F\u060C \u062A\u062C\u0631\u0628\u062A\u0643 \u0641\u064A \u0625\u062F\u0627\u0631\u0629 \u0645\u0634\u0627\u0631\u064A\u0639 \u0627\u0644\u062D\u0641\u0631 \u0628\u0623\u0631\u0627\u0645\u0643\u0648 \u062A\u062B\u064A\u0631 \u0627\u0647\u062A\u0645\u0627\u0645\u064A. \u0623\u0639\u0645\u0644 \u0641\u064A \u0645\u062C\u0627\u0644 \u0645\u0643\u0645\u0651\u0644 \u0648\u0623\u0631\u0649 \u0641\u0631\u0635\u0629 \u0644\u0644\u062A\u0628\u0627\u062F\u0644 \u0627\u0644\u0645\u0639\u0631\u0641\u064A. \u0647\u0644 \u062A\u0642\u0628\u0644 \u0627\u0644\u062A\u0648\u0627\u0635\u0644\u061F"
[Partnership - Tech]: "Hi Ahmed, your work on digital transformation at STC is impressive. We're building complementary infrastructure in the fintech space. Would you be open to exploring synergies?"`;
}
var tones = {
  professional: "Professional, polished tone.",
  friendly: "Warm, conversational, human tone.",
  direct: "Direct and concise. Get to the point fast.",
  casual: "Casual, relaxed, conversational.",
  arabic: "Write entirely in Arabic. Professional tone."
};
var purposes = {
  sales: "Selling a product or service. Focus on value proposition.",
  job_search: "Looking for a job opportunity. Show enthusiasm and relevance.",
  recruiting: "Recruiting talent. Highlight the opportunity.",
  hiring: "Hiring for a specific role. Attract top candidates.",
  networking: "Building professional connections. Be genuine.",
  partnership: "Exploring business partnership. Highlight mutual benefits."
};
router10.post("/generate-message", async (req, res) => {
  try {
    const {
      stepType,
      goal,
      purpose,
      senderContext,
      specificGoal,
      tone,
      prospectName,
      prospectTitle,
      prospectCompany,
      language,
      postType,
      messageType
    } = req.body;
    const resolvedStepType = stepType || messageType || (postType ? "post" : null) || purpose || "message";
    const resolvedGoal = specificGoal || goal || "";
    const resolvedPurpose = purpose || stepType || "networking";
    const resolvedTone = tone || "professional";
    const resolvedLang = language || "ar";
    console.log("[AI] Request:", { resolvedStepType, resolvedPurpose, resolvedTone, prospectTitle, prospectCompany });
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: "AI service not configured \u2014 set ANTHROPIC_API_KEY in Vercel" });
    }
    const prospectProfile = {
      name: prospectName || "",
      title: prospectTitle || "",
      company: prospectCompany || ""
    };
    const style = detectStyleFromProfile(prospectProfile);
    if (resolvedTone === "casual" || resolvedTone === "friendly") style.formality = "friendly";
    if (resolvedTone === "direct") style.formality = "formal";
    let senderName = "";
    let senderHeadline = senderContext || "";
    let senderGender = "unknown";
    const userId = getUserId2(req);
    if (userId) {
      try {
        const { data: conn } = await supabase.from("linkedin_connections").select("linkedin_name, headline").eq("user_id", userId).eq("oauth_connected", true).limit(1).single();
        if (conn) {
          senderName = conn.linkedin_name || "";
          senderHeadline = senderContext || conn.headline || "";
          senderGender = detectGenderFromName(senderName);
        }
      } catch (_) {
      }
    }
    const userContext = {
      name: senderName,
      headline: senderHeadline,
      company: ""
    };
    let systemPrompt;
    if (resolvedStepType === "post") {
      const toneDesc = tones[resolvedTone] || tones.professional;
      const purposeDesc = purposes[resolvedPurpose] || "";
      systemPrompt = `You are an expert LinkedIn content writer.
Write a LinkedIn post. MAX 3000 characters.
Make it engaging and authentic.
Use short paragraphs and line breaks.
End with a call-to-action or thought-provoking question.
Tone: ${toneDesc}
${purposeDesc ? `Purpose: ${purposeDesc}` : ""}
${postType ? `Post type: ${postType}` : ""}
${resolvedLang === "ar" ? "Write entirely in Arabic." : ""}
Return ONLY the post text, nothing else.`;
    } else {
      systemPrompt = buildSystemPrompt(
        userContext,
        prospectProfile,
        `${resolvedPurpose}${resolvedGoal ? ` \u2014 ${resolvedGoal}` : ""}`,
        style,
        resolvedLang,
        resolvedStepType,
        senderGender
      );
    }
    const userMessage = resolvedGoal ? `Goal: ${resolvedGoal}
Write the message:` : `Purpose: ${purposes[resolvedPurpose] || "general outreach"}
Write the message:`;
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: resolvedStepType === "post" ? 800 : 200,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }]
      })
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.error("[AI] Anthropic error:", response.status, errData);
      return res.status(500).json({ error: "AI generation failed" });
    }
    const data = await response.json();
    const generated = (data.content?.[0]?.text || "").trim();
    const maxChars = resolvedStepType === "invite" ? 300 : resolvedStepType === "post" ? 3e3 : 500;
    res.json({
      message: generated.substring(0, maxChars),
      charCount: Math.min(generated.length, maxChars),
      detectedStyle: style
    });
  } catch (e) {
    console.error("[AI] Error:", e);
    res.status(500).json({ error: e.message || "AI generation failed" });
  }
});
var aiRoutes_default = router10;

// server/_core/apolloRoutes.ts
import { Router as Router11 } from "express";
var router11 = Router11();
function getUserId3(req) {
  return req.userId || req.user?.id || null;
}
function normalizeProspects(items) {
  return items.map((p) => {
    const rawDegree = p.connectionDegree || p.connection_degree || p.degree || p.connectionType || "";
    const degree = String(rawDegree).replace(/[^0-9]/g, "");
    return {
      name: [
        p.firstName || p.first_name,
        p.lastName || p.last_name
      ].filter(Boolean).join(" ") || p.fullName || p.name || "",
      first_name: p.firstName || p.first_name || "",
      last_name: p.lastName || p.last_name || "",
      title: p.headline || p.title || p.currentPosition?.[0]?.position || "",
      company: p.currentPosition?.[0]?.companyName || p.company || "",
      location: p.location?.linkedinText || p.location?.parsed?.text || p.location || p.city || "",
      linkedin_url: p.linkedinUrl || p.profileUrl || p.url || null,
      avatar_url: p.photo || p.profilePicture?.url || p.imageUrl || null,
      avatar_initials: ((p.firstName?.[0] || p.first_name?.[0] || "") + (p.lastName?.[0] || p.last_name?.[0] || "")).toUpperCase() || "?",
      connection_degree: degree || null
      // "1", "2", "3", or null
    };
  }).filter((p) => (p.name || p.linkedin_url) && p.connection_degree !== "1");
}
router11.post("/search", async (req, res) => {
  try {
    const {
      jobTitles = [],
      locations = [],
      keywords = "",
      limit = 50
    } = req.body;
    const token = process.env.APIFY_API_TOKEN || "apify_api_CWdZMugTbgkgRByDMhsYDTAmCzez3g4EZ4S9";
    const maxItems = Math.min(Number(limit) || 50, 500);
    const kw = [
      ...jobTitles || [],
      keywords || ""
    ].filter(Boolean).join(" ");
    console.log("[Prospects] Search keywords:", kw);
    console.log("[Prospects] Locations:", locations);
    console.log("[Prospects] Max items:", maxItems);
    const apifyUrl = `https://api.apify.com/v2/acts/harvestapi~linkedin-profile-search/run-sync-get-dataset-items?token=${token}&timeout=300&memory=1024`;
    const body = {
      searchQuery: kw || "professional",
      maxItems,
      locations: (locations || []).length > 0 ? locations.map((l) => l.toUpperCase()) : void 0
    };
    console.log("[Prospects] Calling harvestapi actor...");
    const apifyRes = await fetch(apifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(28e4)
    });
    console.log("[Prospects] Primary actor status:", apifyRes.status);
    if (!apifyRes.ok) {
      const errText = await apifyRes.text();
      console.error("[Prospects] Search failed:", apifyRes.status, errText.slice(0, 500));
      return res.status(502).json({ error: "Search service error. Please try again." });
    }
    const items = await apifyRes.json();
    console.log("[Prospects] Got items:", Array.isArray(items) ? items.length : typeof items);
    const prospects = normalizeProspects(Array.isArray(items) ? items : []);
    res.json({ prospects, total: prospects.length });
  } catch (err) {
    console.error("[Prospects] Fatal:", err.message);
    res.status(500).json({ error: "Search failed: " + err.message });
  }
});
router11.post("/import", async (req, res) => {
  try {
    const userId = getUserId3(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { prospects } = req.body;
    if (!prospects?.length) return res.status(400).json({ error: "No prospects provided" });
    const { data: member } = await supabase.from("team_members").select("team_id").eq("user_id", userId).limit(1).single();
    if (!member?.team_id) return res.status(400).json({ error: "No team found" });
    const records = prospects.map((p) => ({
      team_id: member.team_id,
      client_id: member.team_id,
      name: p.name || "Unknown",
      title: p.title || null,
      company: p.company || null,
      location: p.location || null,
      linkedin_url: p.linkedin_url || null,
      photo_url: p.avatar_url || p.photo || null,
      source_url: null,
      status: "imported"
    }));
    console.log("[Import] Importing", records.length, "prospects for team", member.team_id);
    const BATCH = 50;
    let imported = 0;
    for (let i = 0; i < records.length; i += BATCH) {
      const batch = records.slice(i, i + BATCH);
      const { data: inserted, error } = await supabase.from("prospects").upsert(batch, { onConflict: "linkedin_url,team_id", ignoreDuplicates: true }).select("id");
      if (error) {
        console.error("[Import] Batch error:", error.message, error.code, error.details);
      } else {
        imported += inserted?.length || batch.length;
      }
    }
    console.log("[Import] Done. Imported:", imported);
    res.json({ success: true, imported });
  } catch (err) {
    console.error("[Import] Error:", err.message);
    res.status(500).json({ error: "Import failed" });
  }
});
var apolloRoutes_default = router11;

// server/_core/postRoutes.ts
import { Router as Router12 } from "express";
var router12 = Router12();
function getTeamId4(req) {
  const user = req.user;
  if (!user) return null;
  return user.teamId || null;
}
async function resolveTeamId(req) {
  let teamId = getTeamId4(req);
  if (!teamId) {
    const userId = req.user?.id;
    if (!userId) return null;
    const { data: membership } = await supabase.from("team_members").select("team_id").eq("user_id", userId).single();
    teamId = membership?.team_id || null;
  }
  return teamId;
}
router12.get("/", async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    const teamId = await resolveTeamId(req);
    if (!teamId) return res.json({ posts: [] });
    const status = req.query.status;
    let query = supabase.from("posts").select("*").eq("team_id", teamId).order("created_at", { ascending: false });
    if (status && status !== "all") {
      query = query.eq("status", status);
    }
    const { data: posts, error } = await query.limit(100);
    if (error) {
      console.error("[Posts] GET error:", error.message);
      return res.json({ posts: [] });
    }
    res.json({ posts: posts || [] });
  } catch (err) {
    console.error("[Posts] GET error:", err.message);
    res.json({ posts: [] });
  }
});
router12.post("/", async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    const teamId = await resolveTeamId(req);
    if (!teamId) return res.status(400).json({ error: "No team associated" });
    const { content, scheduled_at } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ error: "Content is required" });
    }
    const status = scheduled_at ? "scheduled" : "draft";
    const { data: post, error } = await supabase.from("posts").insert({
      team_id: teamId,
      user_id: userId,
      content: content.trim(),
      status,
      scheduled_at: scheduled_at || null
    }).select().single();
    if (error) {
      console.error("[Posts] INSERT error:", error.message);
      return res.status(500).json({ error: "Failed to create post" });
    }
    res.json({ post });
  } catch (err) {
    console.error("[Posts] POST error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});
router12.put("/:id", async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    const { id } = req.params;
    const { content, scheduled_at, status } = req.body;
    const updates = { updated_at: (/* @__PURE__ */ new Date()).toISOString() };
    if (content !== void 0) updates.content = content.trim();
    if (scheduled_at !== void 0) updates.scheduled_at = scheduled_at;
    if (status !== void 0) updates.status = status;
    const { data: post, error } = await supabase.from("posts").update(updates).eq("id", id).select().single();
    if (error) {
      console.error("[Posts] UPDATE error:", error.message);
      return res.status(500).json({ error: "Failed to update post" });
    }
    res.json({ post });
  } catch (err) {
    console.error("[Posts] PUT error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});
router12.delete("/:id", async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    const { id } = req.params;
    const { error } = await supabase.from("posts").delete().eq("id", id);
    if (error) {
      console.error("[Posts] DELETE error:", error.message);
      return res.status(500).json({ error: "Failed to delete post" });
    }
    res.json({ success: true });
  } catch (err) {
    console.error("[Posts] DELETE error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});
router12.post("/:id/publish", async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    const { id } = req.params;
    const { data: post, error: fetchError } = await supabase.from("posts").select("*").eq("id", id).single();
    if (fetchError || !post) {
      return res.status(404).json({ error: "Post not found" });
    }
    const { error: updateError } = await supabase.from("posts").update({
      status: "published",
      published_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", id);
    if (updateError) {
      console.error("[Posts] Publish error:", updateError.message);
      return res.status(500).json({ error: "Failed to publish post" });
    }
    res.json({
      success: true,
      post: { ...post, status: "published" },
      publishAction: {
        type: "PUBLISH_POST",
        postId: id,
        content: post.content
      }
    });
  } catch (err) {
    console.error("[Posts] Publish error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});
var postRoutes_default = router12;

// server/_core/messageRoutes.ts
import { Router as Router13 } from "express";
var router13 = Router13();
function getUserId4(req) {
  return req.user?.id || req.user?.sub || null;
}
function getTeamId5(req) {
  const user = req.user;
  if (!user) return null;
  if (user.role === "super_admin" && req.query.target_team_id) {
    return req.query.target_team_id;
  }
  return user.teamId || null;
}
router13.get("/", async (req, res) => {
  try {
    const teamId = getTeamId5(req);
    if (!teamId) return res.status(401).json({ error: "No team" });
    const type = req.query.type;
    let query = supabase.from("messages").select("*").eq("team_id", teamId).order("created_at", { ascending: false });
    if (type && type !== "all") {
      query = query.eq("message_type", type);
    }
    const { data, error } = await query;
    if (error) {
      console.error("[Messages] List error:", error.message);
      return res.json({ messages: [] });
    }
    res.json({ messages: data || [] });
  } catch (e) {
    console.error("[Messages] Error:", e.message);
    res.status(500).json({ error: e.message });
  }
});
router13.post("/", async (req, res) => {
  try {
    const teamId = getTeamId5(req);
    const userId = getUserId4(req);
    if (!teamId) return res.status(401).json({ error: "No team" });
    const { name, content, message_type, purpose, tone, variables } = req.body;
    if (!name || !content) {
      return res.status(400).json({ error: "name and content required" });
    }
    const { data, error } = await supabase.from("messages").insert({
      team_id: teamId,
      user_id: userId,
      name,
      content,
      message_type: message_type || "connection_note",
      purpose: purpose || null,
      tone: tone || null,
      variables: variables || []
    }).select().single();
    if (error) {
      console.error("[Messages] Create error:", error.message);
      return res.status(500).json({ error: error.message });
    }
    res.json({ message: data });
  } catch (e) {
    console.error("[Messages] Error:", e.message);
    res.status(500).json({ error: e.message });
  }
});
router13.put("/:id", async (req, res) => {
  try {
    const teamId = getTeamId5(req);
    if (!teamId) return res.status(401).json({ error: "No team" });
    const { name, content, message_type, purpose, tone, variables } = req.body;
    const { data, error } = await supabase.from("messages").update({
      name,
      content,
      message_type,
      purpose,
      tone,
      variables,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", req.params.id).eq("team_id", teamId).select().single();
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.json({ message: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
router13.delete("/:id", async (req, res) => {
  try {
    const teamId = getTeamId5(req);
    if (!teamId) return res.status(401).json({ error: "No team" });
    const { error } = await supabase.from("messages").delete().eq("id", req.params.id).eq("team_id", teamId);
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
router13.post("/:id/use", async (req, res) => {
  try {
    const teamId = getTeamId5(req);
    if (!teamId) return res.status(401).json({ error: "No team" });
    const { data: msg } = await supabase.from("messages").select("usage_count").eq("id", req.params.id).eq("team_id", teamId).single();
    await supabase.from("messages").update({ usage_count: (msg?.usage_count || 0) + 1 }).eq("id", req.params.id).eq("team_id", teamId);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
var messageRoutes_default = router13;

// server/_core/stripeRoutes.ts
import { Router as Router14 } from "express";
import Stripe from "stripe";
var router14 = Router14();
var stripeKey = process.env.STRIPE_SECRET_KEY || "";
var stripe = stripeKey ? new Stripe(stripeKey) : null;
var PRICE_IDS = {
  starter: process.env.STRIPE_STARTER_PRICE_ID || "",
  growth: process.env.STRIPE_GROWTH_PRICE_ID || "",
  agency: process.env.STRIPE_AGENCY_PRICE_ID || ""
};
router14.post("/create-checkout", async (req, res) => {
  try {
    if (!stripe) return res.status(500).json({ error: "Stripe not configured" });
    const { plan } = req.body;
    const priceId = PRICE_IDS[plan];
    if (!priceId) return res.status(400).json({ error: "Invalid plan" });
    const teamId = req.teamId || req.user?.team_id || "";
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_URL || "https://wassel-alpha.vercel.app"}/app?upgraded=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_URL || "https://wassel-alpha.vercel.app"}/pricing`,
      metadata: { teamId, plan }
    });
    res.json({ checkoutUrl: session.url });
  } catch (e) {
    console.error("[Stripe] Checkout error:", e);
    res.status(500).json({ error: e.message });
  }
});
router14.post("/webhook", async (req, res) => {
  try {
    if (!stripe) return res.status(500).json({ error: "Stripe not configured" });
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      console.error("[Stripe] Webhook signature verification failed:", err.message);
      return res.status(400).json({ error: "Webhook signature verification failed" });
    }
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const { teamId, plan } = session.metadata || {};
      if (teamId && plan) {
        const { createClient: createClient7 } = await import("@supabase/supabase-js");
        const supabase3 = createClient7(
          process.env.SUPABASE_URL || "",
          process.env.SUPABASE_SERVICE_KEY || ""
        );
        await supabase3.from("teams").update({
          plan,
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription
        }).eq("id", teamId);
        console.log(`[Stripe] \u2713 Team ${teamId} upgraded to ${plan}`);
      }
    }
    res.json({ received: true });
  } catch (e) {
    console.error("[Stripe] Webhook error:", e);
    res.status(500).json({ error: e.message });
  }
});
router14.get("/portal", async (req, res) => {
  try {
    if (!stripe) return res.status(500).json({ error: "Stripe not configured" });
    const customerId = req.stripeCustomerId;
    if (!customerId) return res.status(400).json({ error: "No Stripe customer found" });
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.NEXT_PUBLIC_URL || "https://wassel-alpha.vercel.app"}/app`
    });
    res.json({ portalUrl: session.url });
  } catch (e) {
    console.error("[Stripe] Portal error:", e);
    res.status(500).json({ error: e.message });
  }
});
var stripeRoutes_default = router14;

// server/_core/sessionRoutes.ts
import { Router as Router15 } from "express";
import fetch2 from "node-fetch";
import { HttpsProxyAgent } from "https-proxy-agent";
var router15 = Router15();
async function verifyLinkedInCookie(liAt, jsessionId) {
  try {
    const csrfToken = (jsessionId || "").replace(/"/g, "");
    const headers = {
      "cookie": `li_at=${liAt}${jsessionId ? `; JSESSIONID="${jsessionId}"` : ""}`,
      "csrf-token": csrfToken,
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      "x-restli-protocol-version": "2.0.0",
      "accept": "application/vnd.linkedin.normalized+json+2.1"
    };
    const proxyUrl = process.env.LINKEDIN_PROXY_URL;
    const agent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : void 0;
    const res = await fetch2("https://www.linkedin.com/voyager/api/me", {
      headers,
      redirect: "manual",
      ...agent ? { agent } : {}
    });
    if (res.status >= 300 && res.status < 400 || res.status === 401 || res.status === 403) {
      return { valid: false, reason: `LinkedIn rejected cookie (HTTP ${res.status})` };
    }
    if (res.ok) {
      const data = await res.json();
      const firstName = data?.firstName || data?.miniProfile?.firstName || "";
      const lastName = data?.lastName || data?.miniProfile?.lastName || "";
      const name = `${firstName} ${lastName}`.trim();
      return { valid: true, name: name || "Unknown" };
    }
    return { valid: false, reason: `Unexpected HTTP ${res.status}` };
  } catch (err) {
    return { valid: false, reason: err.message };
  }
}
function getTeamId6(req) {
  const user = req.user;
  if (!user) return null;
  if (user.role === "super_admin" && req.query.target_team_id) {
    return req.query.target_team_id;
  }
  return user.teamId || null;
}
router15.post("/store", async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const { li_at, jsessionid } = req.body;
    if (!li_at || typeof li_at !== "string") {
      return res.status(400).json({ error: "li_at cookie is required" });
    }
    const teamId = getTeamId6(req);
    const encryptedLiAt = encrypt(li_at);
    const encryptedJsession = jsessionid ? encrypt(jsessionid) : null;
    const { data, error } = await supabase.from("linkedin_sessions").upsert({
      user_id: userId,
      team_id: teamId,
      li_at: encryptedLiAt,
      jsessionid: encryptedJsession,
      status: "active",
      last_verified_at: (/* @__PURE__ */ new Date()).toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }, { onConflict: "user_id" }).select("id").single();
    if (error) {
      console.error("[Session] Store error:", error.message);
      return res.status(500).json({ error: error.message });
    }
    console.log(`[Session] Stored for user=${userId.slice(0, 8)}\u2026`);
    const verification = await verifyLinkedInCookie(
      li_at,
      jsessionid || ""
    );
    if (verification.valid) {
      console.log(`[Session] \u2705 Cookie verified for ${verification.name}`);
    } else {
      console.log(`[Session] \u26A0\uFE0F Cookie stored but INVALID: ${verification.reason}`);
    }
    res.json({
      success: true,
      id: data?.id,
      status: "active",
      verified: verification.valid,
      linkedinName: verification.name || null,
      verifyError: verification.reason || null
    });
  } catch (err) {
    console.error("[Session] Store exception:", err.message);
    res.status(500).json({ error: err.message });
  }
});
router15.get("/status", async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.json({ hasSession: false, reason: "not_authenticated" });
    }
    const { data } = await supabase.from("linkedin_sessions").select("id, status, last_verified_at, expires_at, created_at, updated_at").eq("user_id", userId).eq("status", "active").single();
    if (!data) {
      return res.json({ hasSession: false });
    }
    if (data.expires_at && new Date(data.expires_at) < /* @__PURE__ */ new Date()) {
      await supabase.from("linkedin_sessions").update({ status: "expired" }).eq("id", data.id);
      return res.json({ hasSession: false, reason: "expired" });
    }
    res.json({
      hasSession: true,
      status: data.status,
      lastVerified: data.last_verified_at,
      expiresAt: data.expires_at,
      updatedAt: data.updated_at
    });
  } catch (err) {
    res.json({ hasSession: false, error: err.message });
  }
});
router15.get("/verify", async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const { data } = await supabase.from("linkedin_sessions").select("*").eq("user_id", userId).eq("status", "active").single();
    if (!data) {
      return res.json({ hasSession: false, verified: false, reason: "No active session stored" });
    }
    try {
      const liAt = decrypt(data.li_at);
      const jsessionId = data.jsessionid ? decrypt(data.jsessionid) : "";
      if (!liAt) {
        return res.json({ hasSession: true, verified: false, reason: "Decrypted cookie is empty" });
      }
      const result = await verifyLinkedInCookie(liAt, jsessionId);
      if (result.valid) {
        await supabase.from("linkedin_sessions").update({ last_verified_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", data.id);
      }
      return res.json({
        hasSession: true,
        verified: result.valid,
        linkedinName: result.name || null,
        reason: result.reason || null,
        lastUpdated: data.updated_at,
        cookieLength: liAt.length
      });
    } catch (decryptErr) {
      return res.json({ hasSession: true, verified: false, reason: `Decryption failed: ${decryptErr.message}` });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router15.post("/manual-store", async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const { li_at, jsessionid } = req.body;
    if (!li_at || typeof li_at !== "string" || li_at.length < 50) {
      return res.status(400).json({ error: "Invalid li_at cookie. Must be a long string from LinkedIn." });
    }
    const verification = await verifyLinkedInCookie(li_at, jsessionid || "");
    if (!verification.valid) {
      return res.status(400).json({
        error: "Cookie is not valid with LinkedIn",
        reason: verification.reason,
        hint: "Make sure you are logged into LinkedIn and copied the correct li_at cookie value"
      });
    }
    const teamId = getTeamId6(req);
    const encryptedLiAt = encrypt(li_at);
    const encryptedJsession = jsessionid ? encrypt(jsessionid) : null;
    const { data, error } = await supabase.from("linkedin_sessions").upsert({
      user_id: userId,
      team_id: teamId,
      li_at: encryptedLiAt,
      jsessionid: encryptedJsession,
      status: "active",
      last_verified_at: (/* @__PURE__ */ new Date()).toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }, { onConflict: "user_id" }).select("id").single();
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    console.log(`[Session] \u2705 Manual store for user=${userId.slice(0, 8)}\u2026 verified as ${verification.name}`);
    res.json({
      success: true,
      verified: true,
      linkedinName: verification.name,
      id: data?.id
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router15.delete("/revoke", async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const { error } = await supabase.from("linkedin_sessions").update({ status: "revoked", li_at: "", jsessionid: "", updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("user_id", userId);
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    console.log(`[Session] Revoked for user=${userId.slice(0, 8)}\u2026`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var sessionRoutes_default = router15;

// server/_core/automationRoutes.ts
import { Router as Router16 } from "express";
var router16 = Router16();
var AUTOMATION_URL = process.env.AUTOMATION_SERVER_URL || "";
var AUTOMATION_KEY = process.env.AUTOMATION_API_KEY || "";
function getTeamId7(req) {
  const user = req.user;
  if (!user) return null;
  if (user.role === "super_admin" && req.query.target_team_id) {
    return req.query.target_team_id;
  }
  return user.teamId || null;
}
function replaceVariables2(template, prospect) {
  if (!template) return "";
  return template.replace(/\{\{firstName\}\}/g, prospect?.name?.split(" ")[0] || prospect?.first_name || "").replace(/\{\{lastName\}\}/g, prospect?.name?.split(" ").slice(1).join(" ") || prospect?.last_name || "").replace(/\{\{company\}\}/g, prospect?.company || "").replace(/\{\{jobTitle\}\}/g, prospect?.title || prospect?.headline || "");
}
router16.post("/campaigns/:id/launch", async (req, res) => {
  try {
    const userId = req.user?.id;
    const teamId = getTeamId7(req);
    if (!userId || !teamId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    if (!AUTOMATION_URL) {
      return res.status(503).json({ error: "Automation server not configured" });
    }
    const campaignId = req.params.id;
    const { data: campaign } = await supabase.from("campaigns").select("id, name, status").eq("id", campaignId).eq("team_id", teamId).single();
    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }
    const { data: session } = await supabase.from("linkedin_sessions").select("id, status").eq("user_id", userId).eq("status", "active").single();
    if (!session) {
      return res.status(400).json({
        error: "No active LinkedIn session. Open LinkedIn in your browser and reload the Wassel extension."
      });
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const { data: pendingSteps, error: qError } = await supabase.from("prospect_step_status").select(`
        id,
        prospect_id,
        step_id,
        campaign_steps (
          step_type,
          step_number,
          message_template
        ),
        prospects (
          id,
          name,
          linkedin_url,
          title,
          company
        )
      `).eq("campaign_id", campaignId).eq("status", "pending").lte("scheduled_at", now).order("scheduled_at", { ascending: true }).limit(100);
    if (qError) {
      return res.status(500).json({ error: qError.message });
    }
    if (!pendingSteps || pendingSteps.length === 0) {
      return res.json({ success: true, queued: 0, message: "No pending actions" });
    }
    let queued = 0;
    let failed = 0;
    for (const step of pendingSteps) {
      const stepData = step.campaign_steps;
      const prospect = step.prospects;
      if (!prospect?.linkedin_url) continue;
      const actionType = stepData?.step_type === "invitation" || stepData?.step_type === "invite" || stepData?.step_type === "connection_request" ? "connect" : stepData?.step_type === "visit" ? "visit" : stepData?.step_type === "message" || stepData?.step_type === "follow_up" ? "message" : null;
      if (!actionType) continue;
      try {
        const resp = await fetch(`${AUTOMATION_URL}/jobs/enqueue`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${AUTOMATION_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            type: actionType,
            userId,
            teamId,
            prospectStepId: step.id,
            linkedinUrl: prospect.linkedin_url,
            name: prospect.name || "",
            message: replaceVariables2(stepData?.message_template, prospect),
            campaignId
          })
        });
        if (resp.ok) {
          queued++;
          await supabase.from("prospect_step_status").update({ status: "in_progress" }).eq("id", step.id);
        } else {
          failed++;
        }
      } catch (err) {
        console.error("[Automation] Queue error:", err.message);
        failed++;
      }
    }
    if (queued > 0) {
      await supabase.from("campaigns").update({ status: "active" }).eq("id", campaignId);
    }
    console.log(`[Automation] Campaign ${campaignId.slice(0, 8)}\u2026 launched: ${queued} queued, ${failed} failed`);
    res.json({ success: true, queued, failed });
  } catch (err) {
    console.error("[Automation] Launch error:", err.message);
    res.status(500).json({ error: err.message });
  }
});
router16.get("/campaigns/:id/progress", async (req, res) => {
  try {
    const teamId = getTeamId7(req);
    if (!teamId) return res.status(401).json({ error: "Authentication required" });
    const campaignId = req.params.id;
    const { data: campaign } = await supabase.from("campaigns").select("id").eq("id", campaignId).eq("team_id", teamId).single();
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    const { data: statuses } = await supabase.from("prospect_step_status").select("status").eq("campaign_id", campaignId);
    const counts = { total: 0, pending: 0, in_progress: 0, completed: 0, failed: 0, waiting: 0, skipped: 0 };
    for (const s of statuses || []) {
      counts.total++;
      const st = s.status;
      if (st in counts) counts[st]++;
    }
    res.json({ success: true, progress: counts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router16.post("/campaigns/:id/pause", async (req, res) => {
  try {
    const teamId = getTeamId7(req);
    if (!teamId) return res.status(401).json({ error: "Authentication required" });
    const campaignId = req.params.id;
    const { data: campaign } = await supabase.from("campaigns").select("id").eq("id", campaignId).eq("team_id", teamId).single();
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    await supabase.from("prospect_step_status").update({ status: "pending" }).eq("campaign_id", campaignId).eq("status", "in_progress");
    await supabase.from("campaigns").update({ status: "paused" }).eq("id", campaignId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var automationRoutes_default = router16;

// server/_core/cloudCampaignRoutes.ts
import { Router as Router17 } from "express";

// server/_core/linkedinApi.ts
import fetch3 from "node-fetch";
import { HttpsProxyAgent as HttpsProxyAgent2 } from "https-proxy-agent";
function getProxyAgent() {
  const proxyUrl = process.env.LINKEDIN_PROXY_URL;
  if (!proxyUrl) {
    console.warn("[LinkedIn] No LINKEDIN_PROXY_URL set \u2014 requests will come from datacenter IP (may be blocked)");
    return void 0;
  }
  return new HttpsProxyAgent2(proxyUrl);
}
var _cachedAgent = null;
function getAgent() {
  if (_cachedAgent === null) {
    _cachedAgent = getProxyAgent();
  }
  return _cachedAgent;
}
function getHeaders(session, contentType) {
  const csrfToken = session.jsessionId.replace(/"/g, "");
  const headers = {
    "cookie": `li_at=${session.liAt}; JSESSIONID="${session.jsessionId}"`,
    "csrf-token": csrfToken,
    "user-agent": session.userAgent || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "x-li-lang": "en_US",
    "x-restli-protocol-version": "2.0.0",
    "x-li-track": '{"clientVersion":"1.13.8806","mpVersion":"1.13.8806","osName":"web","timezoneOffset":3,"timezone":"Asia/Riyadh","deviceFormFactor":"DESKTOP","mpName":"voyager-web"}',
    "accept": "application/vnd.linkedin.normalized+json+2.1"
  };
  if (contentType) {
    headers["content-type"] = contentType;
  }
  return headers;
}
function getFetchOpts(extra) {
  const agent = getAgent();
  return { ...agent ? { agent } : {}, ...extra };
}
function isSessionExpired(status) {
  return status >= 300 && status < 400 || status === 401 || status === 403;
}
function extractSlug(linkedinUrl) {
  const match = linkedinUrl.match(/\/in\/([^/?#]+)/);
  return match ? match[1].replace(/\/$/, "") : "";
}
async function visitProfile(session, profileSlug) {
  try {
    const res = await fetch3(
      `https://www.linkedin.com/voyager/api/identity/profiles/${encodeURIComponent(profileSlug)}`,
      {
        headers: getHeaders(session),
        redirect: "manual",
        ...getFetchOpts()
      }
    );
    if (isSessionExpired(res.status)) {
      return { success: false, error: "session_expired: LinkedIn redirected (li_at cookie invalid)" };
    }
    if (res.ok) {
      const data = await res.json();
      const firstName = data?.firstName || data?.miniProfile?.firstName || "";
      const lastName = data?.lastName || data?.miniProfile?.lastName || "";
      const name = `${firstName} ${lastName}`.trim();
      const profileId = data?.entityUrn?.split(":").pop() || data?.miniProfile?.entityUrn?.split(":").pop() || data?.profileId || profileSlug;
      return {
        success: true,
        name,
        profileId,
        entityUrn: data?.entityUrn || `urn:li:fsd_profile:${profileId}`
      };
    }
    const errText = await res.text().catch(() => "");
    return { success: false, error: `HTTP ${res.status}: ${errText.slice(0, 200)}` };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
async function sendInvite(session, profileId, note) {
  try {
    const body = {
      invitee: {
        "com.linkedin.voyager.growth.invitation.InviteeProfile": {
          profileId
        }
      }
    };
    if (note && note.trim()) {
      body.message = note.trim().slice(0, 300);
    }
    const res = await fetch3(
      "https://www.linkedin.com/voyager/api/growth/normInvitations",
      {
        method: "POST",
        headers: getHeaders(session, "application/json"),
        body: JSON.stringify(body),
        redirect: "manual",
        ...getFetchOpts()
      }
    );
    if (isSessionExpired(res.status)) {
      return { success: false, error: "session_expired" };
    }
    if (res.ok || res.status === 201) {
      return { success: true };
    }
    const errText = await res.text().catch(() => "");
    if (res.status === 422 || res.status === 400) {
      return await sendInviteV2(session, profileId, note);
    }
    return { success: false, error: `HTTP ${res.status}: ${errText.slice(0, 300)}` };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
async function sendInviteV2(session, profileId, note) {
  try {
    const entityUrn = profileId.startsWith("urn:") ? profileId : `urn:li:fsd_profile:${profileId}`;
    const body = {
      invitee: {
        inviteeUnion: {
          memberProfile: entityUrn
        }
      }
    };
    if (note && note.trim()) {
      body.customMessage = note.trim().slice(0, 300);
    }
    const res = await fetch3(
      "https://www.linkedin.com/voyager/api/voyagerRelationshipsDashMemberRelationships?action=verifyQuotaAndCreate",
      {
        method: "POST",
        headers: getHeaders(session, "application/json"),
        body: JSON.stringify(body),
        redirect: "manual",
        ...getFetchOpts()
      }
    );
    if (isSessionExpired(res.status)) {
      return { success: false, error: "session_expired" };
    }
    if (res.ok || res.status === 201 || res.status === 200) {
      return { success: true };
    }
    const errText = await res.text().catch(() => "");
    return { success: false, error: `HTTP ${res.status} (v2): ${errText.slice(0, 300)}` };
  } catch (err) {
    return { success: false, error: `v2_invite_error: ${err.message}` };
  }
}
async function sendMessage(session, profileUrn, message) {
  try {
    const body = {
      keyVersion: "LEGACY_INBOX",
      conversationCreate: {
        eventCreate: {
          value: {
            "com.linkedin.voyager.messaging.create.MessageCreate": {
              attributedBody: { text: message, attributes: [] },
              attachments: []
            }
          }
        },
        recipients: [profileUrn],
        subtype: "MEMBER_TO_MEMBER"
      }
    };
    const res = await fetch3(
      "https://www.linkedin.com/voyager/api/messaging/conversations",
      {
        method: "POST",
        headers: getHeaders(session, "application/json"),
        body: JSON.stringify(body),
        redirect: "manual",
        ...getFetchOpts()
      }
    );
    if (isSessionExpired(res.status)) {
      return { success: false, error: "session_expired" };
    }
    if (res.ok || res.status === 201) {
      return { success: true };
    }
    if (res.status === 422 || res.status === 400) {
      return await sendMessageV2(session, profileUrn, message);
    }
    const errText = await res.text().catch(() => "");
    return { success: false, error: `HTTP ${res.status}: ${errText.slice(0, 300)}` };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
async function sendMessageV2(session, profileUrn, message) {
  try {
    const body = {
      message: {
        body: {
          text: message
        }
      },
      mailboxUrn: profileUrn,
      trackingId: crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
    };
    const res = await fetch3(
      "https://www.linkedin.com/voyager/api/voyagerMessagingDashMessengerMessages?action=createMessage",
      {
        method: "POST",
        headers: getHeaders(session, "application/json"),
        body: JSON.stringify(body),
        redirect: "manual",
        ...getFetchOpts()
      }
    );
    if (isSessionExpired(res.status)) {
      return { success: false, error: "session_expired" };
    }
    if (res.ok || res.status === 201 || res.status === 200) {
      return { success: true };
    }
    const errText = await res.text().catch(() => "");
    return { success: false, error: `HTTP ${res.status} (v2): ${errText.slice(0, 300)}` };
  } catch (err) {
    return { success: false, error: `v2_message_error: ${err.message}` };
  }
}
async function followProfile(session, profileSlug) {
  try {
    const profile = await visitProfile(session, profileSlug);
    if (!profile.success || !profile.profileId) {
      return { success: false, error: "profile_not_found_for_follow" };
    }
    const entityUrn = profile.entityUrn || `urn:li:fsd_profile:${profile.profileId}`;
    const res = await fetch3(
      "https://www.linkedin.com/voyager/api/feed/follows",
      {
        method: "POST",
        headers: getHeaders(session, "application/json"),
        body: JSON.stringify({ urn: entityUrn }),
        redirect: "manual"
      }
    );
    if (isSessionExpired(res.status)) {
      return { success: false, error: "session_expired" };
    }
    if (res.ok || res.status === 201 || res.status === 200) {
      return { success: true, name: profile.name };
    }
    const res2 = await fetch3(
      `https://www.linkedin.com/voyager/api/voyagerRelationshipsDashFollows?action=followByEntityUrn`,
      {
        method: "POST",
        headers: getHeaders(session, "application/json"),
        body: JSON.stringify({ entityUrn }),
        redirect: "manual"
      }
    );
    if (res2.ok || res2.status === 201 || res2.status === 200) {
      return { success: true, name: profile.name };
    }
    return { success: false, error: `HTTP ${res.status} / ${res2.status}` };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
async function checkConnectionStatus(session, profileSlug) {
  try {
    const res = await fetch3(
      `https://www.linkedin.com/voyager/api/identity/profiles/${encodeURIComponent(profileSlug)}/networkinfo`,
      {
        headers: getHeaders(session),
        redirect: "manual",
        ...getFetchOpts()
      }
    );
    if (isSessionExpired(res.status)) {
      return { status: "error", error: "session_expired" };
    }
    if (res.ok) {
      const data = await res.json();
      const distance = data?.distance?.value || data?.followingInfo?.distance?.value || "";
      if (distance === "DISTANCE_1" || distance === "FIRST_DEGREE") {
        return { status: "connected" };
      }
      const pendingInvite = data?.pendingInvitation || data?.entityUrn;
      if (pendingInvite) {
        return { status: "pending" };
      }
      return { status: "not_connected" };
    }
    return { status: "error", error: `HTTP ${res.status}` };
  } catch (err) {
    return { status: "error", error: err.message };
  }
}

// server/_core/cloudCampaignRoutes.ts
var router17 = Router17();
function renderTemplate(template, prospect) {
  if (!template) return "";
  const name = prospect?.name || "";
  const firstName = name.split(" ")[0] || "";
  const company = prospect?.company || "";
  return template.replace(/\{\{firstName\}\}/gi, firstName).replace(/\{\{name\}\}/gi, name).replace(/\{\{fullName\}\}/gi, name).replace(/\{\{company\}\}/gi, company);
}
function profileMatchesProspect(profileName, prospectName) {
  if (!profileName || !prospectName) return true;
  const normalize = (s) => s.toLowerCase().replace(/[^a-z\u0600-\u06ff0-9]/g, "");
  const pn = normalize(profileName);
  const sn = normalize(prospectName);
  return pn.includes(sn) || sn.includes(pn) || pn === sn;
}
async function getUserSession(userId) {
  const { data } = await supabase.from("linkedin_sessions").select("*").eq("user_id", userId).eq("status", "active").single();
  if (!data) return null;
  try {
    const liAt = decrypt(data.li_at);
    const jsessionId = data.jsessionid ? decrypt(data.jsessionid) : "";
    if (!liAt) return null;
    return {
      liAt,
      jsessionId,
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    };
  } catch (e) {
    console.error("[Cloud] Failed to decrypt session:", e.message);
    return null;
  }
}
async function getUserTeamId(userId) {
  const { data } = await supabase.from("team_members").select("team_id").eq("user_id", userId).single();
  return data?.team_id || null;
}
router17.post("/execute", async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Auth required" });
    const { actionType, targetUrl, message, campaignId, prospectName } = req.body;
    const session = await getUserSession(userId);
    if (!session) {
      return res.status(400).json({
        error: "No LinkedIn session. Please open LinkedIn and reload the extension."
      });
    }
    const slug = extractSlug(targetUrl || "");
    if (!slug) return res.status(400).json({ error: "Invalid LinkedIn URL" });
    let result = { success: false, error: "unknown_action" };
    await new Promise((r) => setTimeout(r, 2e3 + Math.random() * 3e3));
    switch (actionType) {
      case "visit": {
        result = await visitProfile(session, slug);
        break;
      }
      case "connect": {
        const profile = await visitProfile(session, slug);
        if (profile.success && profile.profileId) {
          if (prospectName && profile.name && !profileMatchesProspect(profile.name, prospectName)) {
            result = { success: false, error: `identity_mismatch: expected "${prospectName}" but got "${profile.name}"` };
            break;
          }
          await new Promise((r) => setTimeout(r, 1e3 + Math.random() * 2e3));
          const renderedMessage = renderTemplate(message || "", { name: prospectName });
          result = await sendInvite(session, profile.profileId, renderedMessage);
        } else {
          result = { success: false, error: "Profile not found: " + slug };
        }
        break;
      }
      case "message": {
        const profile = await visitProfile(session, slug);
        if (profile.success && profile.profileId) {
          if (prospectName && profile.name && !profileMatchesProspect(profile.name, prospectName)) {
            result = { success: false, error: `identity_mismatch: expected "${prospectName}" but got "${profile.name}"` };
            break;
          }
          const profileUrn = `urn:li:fsd_profile:${profile.profileId}`;
          await new Promise((r) => setTimeout(r, 1e3 + Math.random() * 2e3));
          const renderedMessage = renderTemplate(message || "", { name: prospectName });
          result = await sendMessage(session, profileUrn, renderedMessage);
        } else {
          result = { success: false, error: "Profile not found: " + slug };
        }
        break;
      }
      case "follow": {
        result = await followProfile(session, slug);
        break;
      }
    }
    const teamId = await getUserTeamId(userId);
    await supabase.from("activity_logs").insert({
      user_id: userId,
      team_id: teamId,
      campaign_id: campaignId || null,
      action_type: actionType,
      status: result.success ? "success" : "failed",
      prospect_name: prospectName || result.name || slug,
      linkedin_url: targetUrl,
      error_message: result.error || null,
      executed_at: (/* @__PURE__ */ new Date()).toISOString()
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router17.post("/campaign/:id/launch", async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Auth required" });
    const campaignId = req.params.id;
    const session = await getUserSession(userId);
    if (!session) {
      return res.status(400).json({ error: "No LinkedIn session" });
    }
    const { data: campaign } = await supabase.from("campaigns").select("*").eq("id", campaignId).single();
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    const { data: steps } = await supabase.from("campaign_steps").select("id, step_number, step_type, delay_days").eq("campaign_id", campaignId).order("step_number", { ascending: true });
    if (!steps || steps.length === 0) {
      return res.status(400).json({ error: "Campaign has no steps configured" });
    }
    const { count: existingCount } = await supabase.from("prospect_step_status").select("*", { count: "exact", head: true }).eq("campaign_id", campaignId).in("status", ["pending", "waiting", "in_progress"]);
    let pendingCount = existingCount || 0;
    if (!pendingCount) {
      const { data: prospects } = await supabase.from("prospects").select("id").eq("campaign_id", campaignId);
      if (!prospects || prospects.length === 0) {
        return res.status(400).json({ error: "No prospects in this campaign" });
      }
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const statusRows = [];
      for (const prospect of prospects) {
        for (const step of steps) {
          statusRows.push({
            prospect_id: prospect.id,
            campaign_id: campaignId,
            step_id: step.id,
            status: step.step_number === 1 ? "pending" : "waiting",
            scheduled_at: step.step_number === 1 ? now : null
          });
        }
      }
      for (let i = 0; i < statusRows.length; i += 50) {
        await supabase.from("prospect_step_status").insert(statusRows.slice(i, i + 50));
      }
      pendingCount = statusRows.length;
      console.log(`[CloudLaunch] Auto-enrolled ${prospects.length} prospects \xD7 ${steps.length} steps`);
    }
    await supabase.from("prospect_step_status").update({ status: "pending" }).eq("campaign_id", campaignId).eq("status", "in_progress");
    await supabase.from("campaigns").update({ status: "active", started_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", campaignId);
    const teamId = campaign.team_id || await getUserTeamId(userId);
    await supabase.from("activity_logs").insert({
      user_id: userId,
      team_id: teamId,
      campaign_id: campaignId,
      action_type: "campaign_launch",
      status: "success",
      prospect_name: `Campaign "${campaign.name}" launched`,
      executed_at: (/* @__PURE__ */ new Date()).toISOString()
    });
    res.json({
      success: true,
      message: "Campaign launched \u2014 cron will process actions every minute",
      prospects: pendingCount,
      steps: steps.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router17.post("/campaign/:id/tick", async (_req, res) => {
  return res.json({
    ok: true,
    disabled: true,
    message: "Cron handles all execution. /tick is disabled to prevent duplicate actions."
  });
});
router17.get("/session-check", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.json({ hasSession: false });
  const session = await getUserSession(userId);
  res.json({ hasSession: !!session });
});
var cloudCampaignRoutes_default = router17;

// server/_core/campaignCron.ts
import { Router as Router18 } from "express";
import fetch4 from "node-fetch";
import { HttpsProxyAgent as HttpsProxyAgent3 } from "https-proxy-agent";
var router18 = Router18();
var CRON_SECRET = process.env.CRON_SECRET || "";
var DAILY_LIMITS = {
  visit: 100,
  connect: 50,
  message: 60,
  follow: 50
};
function renderTemplate2(template, prospect) {
  if (!template) return "";
  const name = prospect?.name || "";
  const firstName = name.split(" ")[0] || "";
  const lastName = name.split(" ").slice(1).join(" ") || "";
  const company = prospect?.company || "";
  const title = prospect?.title || "";
  return template.replace(/\{\{firstName\}\}/gi, firstName).replace(/\{\{lastName\}\}/gi, lastName).replace(/\{\{name\}\}/gi, name).replace(/\{\{fullName\}\}/gi, name).replace(/\{\{company\}\}/gi, company).replace(/\{\{jobTitle\}\}/gi, title).replace(/\{\{title\}\}/gi, title);
}
function profileMatchesProspect2(profileName, prospectName) {
  if (!profileName || !prospectName) return true;
  const normalize = (s) => s.toLowerCase().replace(/[^a-z\u0600-\u06ff0-9]/g, "");
  const pn = normalize(profileName);
  const sn = normalize(prospectName);
  return pn.includes(sn) || sn.includes(pn) || pn === sn;
}
function stepTypeToActionType(stepType) {
  const map = {
    visit: "visit",
    invitation: "connect",
    invite: "connect",
    connect: "connect",
    message: "message",
    followup: "message",
    follow_up: "message",
    follow: "follow"
  };
  return map[stepType] || null;
}
async function getUserSession2(userId) {
  const { data } = await supabase.from("linkedin_sessions").select("*").eq("user_id", userId).eq("status", "active").single();
  if (!data) return null;
  let liAt = "";
  let jsessionId = "";
  try {
    liAt = decrypt(data.li_at);
  } catch (e) {
    console.error("[Cron] Failed to decrypt li_at:", e.message);
    return null;
  }
  try {
    jsessionId = data.jsessionid ? decrypt(data.jsessionid) : "";
  } catch (e) {
    console.error("[Cron] Failed to decrypt jsessionid:", e.message);
  }
  if (!liAt) {
    console.error("[Cron] Decrypted li_at is empty");
    return null;
  }
  return {
    liAt,
    jsessionId,
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  };
}
async function getDailyCount(userId, actionType) {
  const today = /* @__PURE__ */ new Date();
  today.setHours(0, 0, 0, 0);
  const { count } = await supabase.from("activity_logs").select("*", { count: "exact", head: true }).eq("user_id", userId).eq("action_type", actionType).in("status", ["success", "completed"]).gte("executed_at", today.toISOString());
  return count || 0;
}
router18.get("/diagnose", async (req, res) => {
  const authHeader = req.headers["authorization"] || "";
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const { data: sessionData } = await supabase.from("linkedin_sessions").select("*").eq("status", "active").limit(1).single();
    if (!sessionData) {
      return res.json({ error: "No active session found" });
    }
    let liAt = "";
    let jsessionId = "";
    try {
      liAt = decrypt(sessionData.li_at);
    } catch (e) {
      return res.json({ error: "decrypt_li_at_failed", message: e.message });
    }
    try {
      jsessionId = sessionData.jsessionid ? decrypt(sessionData.jsessionid) : "";
    } catch (e) {
      return res.json({ error: "decrypt_jsessionid_failed", message: e.message });
    }
    const diag = {
      li_at_decrypted_len: liAt.length,
      li_at_prefix: liAt.substring(0, 8),
      li_at_suffix: liAt.substring(liAt.length - 8),
      jsessionid_decrypted_len: jsessionId.length,
      jsessionid_prefix: jsessionId.substring(0, 10)
    };
    const proxyUrl = process.env.LINKEDIN_PROXY_URL;
    const agent = proxyUrl ? new HttpsProxyAgent3(proxyUrl) : void 0;
    diag.proxy_configured = !!proxyUrl;
    if (proxyUrl) {
      try {
        const pu = new URL(proxyUrl);
        diag.proxy_host = pu.hostname;
        diag.proxy_port = pu.port;
        diag.proxy_user = pu.username?.substring(0, 30) + "...";
      } catch {
      }
    }
    const session = {
      liAt,
      jsessionId,
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    };
    try {
      const meRes = await fetch4("https://www.linkedin.com/voyager/api/me", {
        headers: {
          "cookie": `li_at=${liAt}${jsessionId ? `; JSESSIONID="${jsessionId}"` : ""}`,
          "csrf-token": jsessionId.replace(/"/g, ""),
          "user-agent": session.userAgent,
          "x-restli-protocol-version": "2.0.0",
          "accept": "application/vnd.linkedin.normalized+json+2.1"
        },
        redirect: "manual",
        ...agent ? { agent } : {}
      });
      diag.me_status = meRes.status;
      diag.me_headers = Object.fromEntries(meRes.headers);
      if (meRes.ok) {
        const meData = await meRes.json();
        diag.me_name = `${meData?.firstName || ""} ${meData?.lastName || ""}`.trim();
        diag.me_ok = true;
      }
    } catch (e) {
      diag.me_error = e.message;
    }
    try {
      const profileRes = await fetch4(
        "https://www.linkedin.com/voyager/api/identity/profiles/me",
        {
          headers: {
            "cookie": `li_at=${session.liAt}; JSESSIONID="${session.jsessionId}"`,
            "csrf-token": session.jsessionId.replace(/"/g, ""),
            "user-agent": session.userAgent,
            "x-li-lang": "en_US",
            "x-restli-protocol-version": "2.0.0",
            "x-li-track": '{"clientVersion":"1.13.8806","mpVersion":"1.13.8806","osName":"web","timezoneOffset":3,"timezone":"Asia/Riyadh","deviceFormFactor":"DESKTOP","mpName":"voyager-web"}',
            "accept": "application/vnd.linkedin.normalized+json+2.1"
          },
          redirect: "manual",
          ...agent ? { agent } : {}
        }
      );
      diag.profile_status = profileRes.status;
      if (profileRes.ok) {
        diag.profile_ok = true;
      } else if (profileRes.status >= 300 && profileRes.status < 400) {
        diag.profile_redirect = profileRes.headers.get("location");
      }
    } catch (e) {
      diag.profile_error = e.message;
    }
    return res.json({ ok: true, diag });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});
router18.get("/campaign-runner", async (req, res) => {
  const authHeader = req.headers["authorization"] || "";
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const results = [];
  const startTime = Date.now();
  try {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1e3).toISOString();
    const { data: stuckRows } = await supabase.from("prospect_step_status").update({ status: "pending" }).eq("status", "in_progress").lt("created_at", tenMinAgo).select("id");
    if (stuckRows?.length) {
      console.log(`[Cron] Recovered ${stuckRows.length} stuck rows`);
    }
    const { data: activeCampaigns } = await supabase.from("campaigns").select("id, team_id, created_by, name").eq("status", "active");
    if (!activeCampaigns?.length) {
      return res.json({ ok: true, message: "No active campaigns", processed: 0 });
    }
    const teamCampaigns = {};
    for (const c of activeCampaigns) {
      if (!c.team_id) continue;
      if (!teamCampaigns[c.team_id]) teamCampaigns[c.team_id] = [];
      teamCampaigns[c.team_id].push(c);
    }
    const userCampaigns = {};
    for (const [teamId, campaigns] of Object.entries(teamCampaigns)) {
      const { data: members } = await supabase.from("team_members").select("user_id").eq("team_id", teamId);
      if (!members?.length) continue;
      for (const m of members) {
        const { data: sess } = await supabase.from("linkedin_sessions").select("id").eq("user_id", m.user_id).eq("status", "active").limit(1);
        if (sess?.length) {
          if (!userCampaigns[m.user_id]) {
            userCampaigns[m.user_id] = { campaigns: [], teamId };
          }
          userCampaigns[m.user_id].campaigns.push(...campaigns);
          break;
        }
      }
    }
    for (const [userId, { campaigns, teamId }] of Object.entries(userCampaigns)) {
      const session = await getUserSession2(userId);
      if (!session) {
        results.push({ userId, error: "no_session" });
        continue;
      }
      for (const campaign of campaigns) {
        if (Date.now() - startTime > 8e3) break;
        try {
          const result = await processCampaignAction(campaign, userId, teamId, session);
          if (result) results.push(result);
        } catch (err) {
          console.error(`[Cron] Error processing campaign ${campaign.name}:`, err.message);
          results.push({ campaign: campaign.name, error: err.message });
        }
      }
      if (Date.now() - startTime > 8e3) break;
    }
    if (Date.now() - startTime < 7e3) {
      try {
        const acceptanceResults = await processAcceptanceChecks(startTime);
        if (acceptanceResults.length) {
          results.push({ acceptance_checks: acceptanceResults });
        }
      } catch (err) {
        console.error("[Cron] Acceptance check error:", err.message);
      }
    }
    return res.json({ ok: true, processed: results.length, results, elapsed: Date.now() - startTime });
  } catch (err) {
    console.error("[CampaignCron] Fatal error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});
async function processCampaignAction(campaign, userId, teamId, session) {
  const { count: totalRows } = await supabase.from("prospect_step_status").select("*", { count: "exact", head: true }).eq("campaign_id", campaign.id);
  if (!totalRows) {
    await autoEnrollProspects(campaign.id);
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const { data: pendingSteps } = await supabase.from("prospect_step_status").select(`
      id,
      prospect_id,
      step_id,
      status,
      campaign_steps!inner (
        id,
        step_number,
        step_type,
        name,
        message_template,
        delay_days
      ),
      prospects!inner (
        id,
        linkedin_url,
        name,
        company,
        title,
        connection_status
      )
    `).eq("campaign_id", campaign.id).eq("status", "pending").or(`scheduled_at.is.null,scheduled_at.lte.${now}`).order("created_at", { ascending: true }).limit(1);
  if (!pendingSteps?.length) {
    const { count: remaining } = await supabase.from("prospect_step_status").select("*", { count: "exact", head: true }).eq("campaign_id", campaign.id).in("status", ["pending", "in_progress", "waiting"]);
    if (!remaining) {
      await supabase.from("campaigns").update({ status: "completed", completed_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", campaign.id);
      return { campaign: campaign.name, status: "completed" };
    }
    return null;
  }
  const pss = pendingSteps[0];
  const stepDef = pss.campaign_steps;
  const prospect = pss.prospects;
  if (!prospect?.linkedin_url) return null;
  const slug = extractSlug(prospect.linkedin_url);
  if (!slug) return null;
  const actionType = stepTypeToActionType(stepDef.step_type);
  if (!actionType) return null;
  const dailyCount = await getDailyCount(userId, actionType);
  const limit = DAILY_LIMITS[actionType] || 50;
  if (dailyCount >= limit) {
    return { campaign: campaign.name, prospect: prospect.name, skipped: `daily_limit_${actionType} (${dailyCount}/${limit})` };
  }
  if (actionType === "message" && prospect.connection_status !== "accepted") {
    const connectionCheck = await checkConnectionStatus(session, slug);
    if (connectionCheck.status === "connected") {
      await supabase.from("prospects").update({ connection_status: "accepted" }).eq("id", prospect.id);
    } else {
      return { campaign: campaign.name, prospect: prospect.name, skipped: "not_connected_yet" };
    }
  }
  const { data: claimed } = await supabase.from("prospect_step_status").update({ status: "in_progress" }).eq("id", pss.id).eq("status", "pending").select("id");
  if (!claimed?.length) {
    return null;
  }
  let result = {
    success: false,
    error: "unknown"
  };
  try {
    switch (actionType) {
      case "visit": {
        result = await visitProfile(session, slug);
        break;
      }
      case "connect": {
        const profile = await visitProfile(session, slug);
        if (!profile.success || !profile.profileId) {
          result = { success: false, error: "profile_not_found" };
          break;
        }
        if (prospect.name && profile.name && !profileMatchesProspect2(profile.name, prospect.name)) {
          result = { success: false, error: `identity_mismatch: expected "${prospect.name}" got "${profile.name}"` };
          break;
        }
        await new Promise((r) => setTimeout(r, 2e3 + Math.random() * 3e3));
        const note = renderTemplate2(stepDef.message_template || "", prospect);
        result = await sendInvite(session, profile.profileId, note);
        break;
      }
      case "message": {
        const profile = await visitProfile(session, slug);
        if (!profile.success || !profile.profileId) {
          result = { success: false, error: "profile_not_found" };
          break;
        }
        if (prospect.name && profile.name && !profileMatchesProspect2(profile.name, prospect.name)) {
          result = { success: false, error: `identity_mismatch: expected "${prospect.name}" got "${profile.name}"` };
          break;
        }
        await new Promise((r) => setTimeout(r, 2e3 + Math.random() * 3e3));
        const urn = `urn:li:fsd_profile:${profile.profileId}`;
        const msg = renderTemplate2(stepDef.message_template || "", prospect);
        result = await sendMessage(session, urn, msg);
        break;
      }
      case "follow": {
        result = await followProfile(session, slug);
        break;
      }
    }
  } catch (e) {
    result = { success: false, error: e.message };
  }
  const finalStatus = result.success ? "completed" : "failed";
  await supabase.from("prospect_step_status").update({
    status: finalStatus,
    executed_at: (/* @__PURE__ */ new Date()).toISOString(),
    error_message: result.error || null
  }).eq("id", pss.id);
  await supabase.from("activity_logs").insert({
    user_id: userId,
    team_id: teamId,
    campaign_id: campaign.id,
    prospect_id: prospect.id,
    action_type: actionType,
    status: finalStatus === "completed" ? "success" : "failed",
    prospect_name: prospect.name || slug,
    linkedin_url: prospect.linkedin_url,
    error_message: result.error || null,
    executed_at: (/* @__PURE__ */ new Date()).toISOString()
  });
  if (result.success) {
    await unlockNextStep(pss, stepDef, campaign, prospect, actionType, userId, teamId);
  }
  if (!result.success && result.error?.includes("session_expired")) {
    await supabase.from("prospect_step_status").update({ status: "pending", error_message: "session_expired - will retry" }).eq("id", pss.id);
    const { data: recentLogs } = await supabase.from("activity_logs").select("status, error_message").eq("campaign_id", campaign.id).order("executed_at", { ascending: false }).limit(5);
    const allSessionExpired = recentLogs?.every(
      (l) => l.status === "failed" && l.error_message?.includes("session_expired")
    );
    if (recentLogs?.length === 5 && allSessionExpired) {
      await supabase.from("campaigns").update({ status: "paused" }).eq("id", campaign.id);
      console.log(`[Cron] \u26A0\uFE0F Auto-paused campaign "${campaign.name}" after 5 consecutive session_expired errors. User needs to refresh LinkedIn cookies.`);
    } else {
      console.log(`[Cron] Session may be expired for user ${userId.slice(0, 8)}\u2026 \u2014 will retry on next run`);
    }
  }
  return {
    campaign: campaign.name,
    prospect: prospect.name || slug,
    action: actionType,
    step: stepDef.step_number,
    success: result.success,
    error: result.error || null
  };
}
async function unlockNextStep(pss, stepDef, campaign, prospect, actionType, userId, teamId) {
  const currentStepNumber = stepDef.step_number;
  const { data: nextStepDef } = await supabase.from("campaign_steps").select("id, step_number, step_type, delay_days").eq("campaign_id", campaign.id).eq("step_number", currentStepNumber + 1).single();
  if (!nextStepDef) return;
  const nextActionType = stepTypeToActionType(nextStepDef.step_type);
  if (actionType === "connect" && nextActionType === "message") {
    await supabase.from("prospects").update({ connection_status: "pending" }).eq("id", pss.prospect_id);
    const { data: nextPss } = await supabase.from("prospect_step_status").select("id").eq("prospect_id", pss.prospect_id).eq("campaign_id", campaign.id).eq("step_id", nextStepDef.id).single();
    if (nextPss) {
      const nextCheckAt = new Date(Date.now() + 6 * 60 * 60 * 1e3).toISOString();
      await supabase.from("acceptance_check_jobs").insert({
        prospect_step_status_id: nextPss.id,
        prospect_id: pss.prospect_id,
        campaign_id: campaign.id,
        next_check_at: nextCheckAt,
        checks_remaining: 56
        // 14 days × 4 checks/day
      });
      console.log(`[Cron] Created acceptance check job for ${prospect.name} (step ${currentStepNumber}\u2192${currentStepNumber + 1})`);
    }
    return;
  }
  if (actionType === "connect") {
    await supabase.from("prospects").update({ connection_status: "pending" }).eq("id", pss.prospect_id);
  }
  const delayDays = nextStepDef.delay_days || 0;
  const scheduledAt = delayDays > 0 ? new Date(Date.now() + delayDays * 864e5).toISOString() : (/* @__PURE__ */ new Date()).toISOString();
  const { data: unlocked } = await supabase.from("prospect_step_status").update({ status: "pending", scheduled_at: scheduledAt }).eq("prospect_id", pss.prospect_id).eq("campaign_id", campaign.id).eq("step_id", nextStepDef.id).eq("status", "waiting").select("id");
  console.log(`[Cron] Step ${currentStepNumber}\u2192${currentStepNumber + 1} for ${prospect.name}: unlocked=${unlocked?.length || 0}, scheduled=${scheduledAt}`);
}
async function autoEnrollProspects(campaignId) {
  const { data: prospects } = await supabase.from("prospects").select("id").eq("campaign_id", campaignId);
  const { data: steps } = await supabase.from("campaign_steps").select("id, step_number").eq("campaign_id", campaignId).order("step_number", { ascending: true });
  if (!prospects?.length || !steps?.length) return;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const rows = [];
  for (const p of prospects) {
    for (const s of steps) {
      rows.push({
        prospect_id: p.id,
        campaign_id: campaignId,
        step_id: s.id,
        status: s.step_number === 1 ? "pending" : "waiting",
        scheduled_at: s.step_number === 1 ? now : null
      });
    }
  }
  for (let i = 0; i < rows.length; i += 50) {
    await supabase.from("prospect_step_status").insert(rows.slice(i, i + 50));
  }
  console.log(`[Cron] Auto-enrolled ${prospects.length} prospects \xD7 ${steps.length} steps for campaign ${campaignId}`);
}
async function processAcceptanceChecks(startTime) {
  const results = [];
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const { data: jobs } = await supabase.from("acceptance_check_jobs").select(`
      id,
      prospect_step_status_id,
      prospect_id,
      campaign_id,
      checks_remaining,
      prospects!inner (
        linkedin_url,
        name,
        connection_status
      )
    `).lte("next_check_at", now).gt("checks_remaining", 0).limit(5);
  if (!jobs?.length) return results;
  const { data: anySession } = await supabase.from("linkedin_sessions").select("user_id").eq("status", "active").limit(1).single();
  if (!anySession) return results;
  const session = await getUserSession2(anySession.user_id);
  if (!session) return results;
  for (const job of jobs) {
    if (Date.now() - startTime > 8500) break;
    const prospect = job.prospects;
    if (!prospect?.linkedin_url) continue;
    const slug = extractSlug(prospect.linkedin_url);
    if (!slug) continue;
    try {
      const connectionCheck = await checkConnectionStatus(session, slug);
      if (connectionCheck.status === "connected") {
        await supabase.from("prospects").update({ connection_status: "accepted" }).eq("id", job.prospect_id);
        const { data: pss } = await supabase.from("prospect_step_status").select("id, step_id").eq("id", job.prospect_step_status_id).single();
        if (pss) {
          const { data: stepDef } = await supabase.from("campaign_steps").select("delay_days").eq("id", pss.step_id).single();
          const delayDays = stepDef?.delay_days || 0;
          const scheduledAt = delayDays > 0 ? new Date(Date.now() + delayDays * 864e5).toISOString() : (/* @__PURE__ */ new Date()).toISOString();
          await supabase.from("prospect_step_status").update({ status: "pending", scheduled_at: scheduledAt }).eq("id", job.prospect_step_status_id).eq("status", "waiting");
          console.log(`[AcceptanceCheck] ${prospect.name} ACCEPTED \u2192 message step unlocked, scheduled for ${scheduledAt}`);
        }
        await supabase.from("acceptance_check_jobs").delete().eq("id", job.id);
        results.push({ prospect: prospect.name, status: "accepted", unlocked: true });
      } else if (connectionCheck.status === "error" && connectionCheck.error?.includes("session_expired")) {
        await supabase.from("acceptance_check_jobs").update({ next_check_at: new Date(Date.now() + 30 * 60 * 1e3).toISOString() }).eq("id", job.id);
      } else {
        const checksRemaining = job.checks_remaining - 1;
        if (checksRemaining <= 0) {
          await supabase.from("prospect_step_status").update({ status: "skipped", error_message: "invite_not_accepted_14d" }).eq("id", job.prospect_step_status_id);
          await supabase.from("prospect_step_status").update({ status: "skipped", error_message: "invite_not_accepted_cascade" }).eq("prospect_id", job.prospect_id).eq("campaign_id", job.campaign_id).eq("status", "waiting");
          await supabase.from("acceptance_check_jobs").delete().eq("id", job.id);
          results.push({ prospect: prospect.name, status: "expired", skipped: true });
          console.log(`[AcceptanceCheck] ${prospect.name} NOT ACCEPTED after 14 days \u2192 skipped`);
        } else {
          const nextCheck = new Date(Date.now() + 6 * 60 * 60 * 1e3).toISOString();
          await supabase.from("acceptance_check_jobs").update({ checks_remaining: checksRemaining, next_check_at: nextCheck }).eq("id", job.id);
          results.push({ prospect: prospect.name, status: "still_pending", checksRemaining });
        }
      }
    } catch (err) {
      console.error(`[AcceptanceCheck] Error for ${prospect.name}:`, err.message);
    }
  }
  return results;
}
var campaignCron_default = router18;

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router19 = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "super_admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router19({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/db.ts
async function getUserTeamId2(userId) {
  try {
    const { data, error } = await supabase.from("team_members").select("team_id").eq("user_id", userId).limit(1).single();
    if (error) {
      console.warn("[Database] Failed to get user team:", error);
      return null;
    }
    return data?.team_id || null;
  } catch (error) {
    console.error("[Database] Error getting user team:", error);
    return null;
  }
}

// server/routers/auth.ts
import { z as z2 } from "zod";
import { randomUUID } from "crypto";
var authRouter = router19({
  /**
   * Get current user from Supabase Auth
   * Returns null if not authenticated
   */
  me: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user?.id) return null;
    try {
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", ctx.user.id).single();
      return profile || null;
    } catch (error) {
      console.error("Failed to fetch user profile:", error);
      return null;
    }
  }),
  /**
   * Auto-onboard user on first login
   * Creates profile + default team + team membership
   */
  onboard: protectedProcedure.input(z2.object({
    email: z2.string().email(),
    fullName: z2.string().optional()
  })).mutation(async ({ ctx, input }) => {
    if (!ctx.user?.id) {
      throw new Error("User not authenticated");
    }
    const userId = ctx.user.id;
    try {
      const { data: existingProfile } = await supabase.from("profiles").select("id").eq("id", userId).single();
      if (existingProfile) {
        const { data: profile2 } = await supabase.from("profiles").select("*").eq("id", userId).single();
        return { profile: profile2, team: null, isNewUser: false };
      }
      const { error: profileError } = await supabase.from("profiles").insert({
        id: userId,
        email: input.email,
        full_name: input.fullName || "\u0645\u0633\u062A\u062E\u062F\u0645 \u062C\u062F\u064A\u062F",
        timezone: "Asia/Riyadh",
        locale: "ar",
        subscription_tier: "free",
        subscription_status: "active",
        credits_remaining: 25,
        monthly_credits: 25
      });
      if (profileError) {
        throw new Error(`Failed to create profile: ${profileError.message}`);
      }
      const teamId = randomUUID();
      const { error: teamError } = await supabase.from("teams").insert({
        id: teamId,
        name: "\u0641\u0631\u064A\u0642\u064A \u0627\u0644\u0627\u0641\u062A\u0631\u0627\u0636\u064A",
        slug: `team-${userId.slice(0, 8)}-${Date.now()}`,
        owner_id: userId,
        subscription_tier: "free",
        credits_remaining: 25
      });
      if (teamError) {
        throw new Error(`Failed to create team: ${teamError.message}`);
      }
      const { error: memberError } = await supabase.from("team_members").insert({
        id: randomUUID(),
        team_id: teamId,
        user_id: userId,
        role: "owner"
      });
      if (memberError) {
        throw new Error(`Failed to add user to team: ${memberError.message}`);
      }
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).single();
      const { data: team } = await supabase.from("teams").select("*").eq("id", teamId).single();
      return {
        profile,
        team,
        isNewUser: true
      };
    } catch (error) {
      console.error("Onboarding failed:", error);
      throw error;
    }
  }),
  /**
   * Get user's primary team
   */
  getTeam: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user?.id) return null;
    try {
      const { data: teamMember } = await supabase.from("team_members").select("team_id").eq("user_id", ctx.user.id).limit(1).single();
      if (!teamMember) return null;
      const { data: team } = await supabase.from("teams").select("*").eq("id", teamMember.team_id).single();
      return team || null;
    } catch (error) {
      console.error("Failed to fetch team:", error);
      return null;
    }
  }),
  /**
   * Logout (clear session)
   */
  logout: publicProcedure.mutation(async ({ ctx }) => {
    try {
      return { success: true };
    } catch (error) {
      console.error("Logout failed:", error);
      throw error;
    }
  })
});

// server/routers/demo.ts
import { randomUUID as randomUUID2 } from "crypto";
var demoRouter = router19({
  /**
   * Create demo campaign for the user's team
   */
  createDemoCampaign: protectedProcedure.mutation(async ({ ctx }) => {
    if (!ctx.user?.id) {
      throw new Error("User not authenticated");
    }
    try {
      const teamId = await getUserTeamId2(ctx.user.id);
      if (!teamId) {
        throw new Error("User has no team");
      }
      const campaignId = randomUUID2();
      const { data: campaign, error } = await supabase.from("campaigns").insert({
        id: campaignId,
        team_id: teamId,
        name: "\u062D\u0645\u0644\u0629 LinkedIn \u0627\u0644\u062A\u062C\u0631\u064A\u0628\u064A\u0629 - Q1 2026",
        description: "\u062D\u0645\u0644\u0629 \u062A\u062C\u0631\u064A\u0628\u064A\u0629 \u0644\u0644\u062A\u0648\u0627\u0635\u0644 \u0645\u0639 \u0635\u0646\u0627\u0639 \u0627\u0644\u0642\u0631\u0627\u0631 \u0641\u064A \u0645\u062C\u0627\u0644 \u0627\u0644\u062A\u0643\u0646\u0648\u0644\u0648\u062C\u064A\u0627",
        status: "active",
        type: "invitation_message",
        configuration: {
          target_industry: "Technology",
          target_title: "CTO, VP Engineering, Engineering Manager",
          message_template: "\u0645\u0631\u062D\u0628\u0627\u064B {{firstName}}\u060C \u0644\u0627\u062D\u0638\u062A \u0639\u0645\u0644\u0643 \u0627\u0644\u0645\u0645\u062A\u0627\u0632 \u0641\u064A {{company}}..."
        },
        stats: {
          total_leads: 0,
          completed: 0,
          pending: 0,
          failed: 0
        },
        created_by: ctx.user.id
      }).select().single();
      if (error) {
        throw new Error(`Failed to create campaign: ${error.message}`);
      }
      return campaign;
    } catch (error) {
      console.error("Demo campaign creation failed:", error);
      throw error;
    }
  }),
  /**
   * Create demo leads for the user's team
   */
  createDemoLeads: protectedProcedure.mutation(async ({ ctx }) => {
    if (!ctx.user?.id) {
      throw new Error("User not authenticated");
    }
    try {
      const teamId = await getUserTeamId2(ctx.user.id);
      if (!teamId) {
        throw new Error("User has no team");
      }
      const { data: campaigns } = await supabase.from("campaigns").select("id").eq("team_id", teamId).limit(1);
      const campaignId = campaigns?.[0]?.id || randomUUID2();
      const demoLeads = [
        {
          id: randomUUID2(),
          team_id: teamId,
          campaign_id: campaignId,
          linkedin_id: `lead-001-${Date.now()}`,
          linkedin_url: "https://linkedin.com/in/ahmed-mohammad",
          first_name: "\u0623\u062D\u0645\u062F",
          last_name: "\u0645\u062D\u0645\u062F",
          headline: "CTO \u0641\u064A TechCorp",
          company: "TechCorp",
          industry: "Technology",
          location: "\u0627\u0644\u0631\u064A\u0627\u0636\u060C \u0627\u0644\u0645\u0645\u0644\u0643\u0629 \u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u0627\u0644\u0633\u0639\u0648\u062F\u064A\u0629",
          email: "ahmad@techcorp.com",
          status: "new",
          priority: 8,
          profile_data: {
            connections: 500,
            followers: 1200,
            endorsements: ["\u0627\u0644\u0642\u064A\u0627\u062F\u0629", "\u0627\u0644\u062A\u0643\u0646\u0648\u0644\u0648\u062C\u064A\u0627"]
          }
        },
        {
          id: randomUUID2(),
          team_id: teamId,
          campaign_id: campaignId,
          linkedin_id: `lead-002-${Date.now()}`,
          linkedin_url: "https://linkedin.com/in/fatima-ali",
          first_name: "\u0641\u0627\u0637\u0645\u0629",
          last_name: "\u0639\u0644\u064A",
          headline: "VP Engineering \u0641\u064A InnovateLabs",
          company: "InnovateLabs",
          industry: "Technology",
          location: "\u062F\u0628\u064A\u060C \u0627\u0644\u0625\u0645\u0627\u0631\u0627\u062A \u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u0627\u0644\u0645\u062A\u062D\u062F\u0629",
          email: "fatima@innovatelabs.com",
          status: "in_progress",
          priority: 9,
          profile_data: {
            connections: 800,
            followers: 2100,
            endorsements: ["\u0627\u0644\u0647\u0646\u062F\u0633\u0629", "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u0646\u062A\u062C"]
          }
        },
        {
          id: randomUUID2(),
          team_id: teamId,
          campaign_id: campaignId,
          linkedin_id: `lead-003-${Date.now()}`,
          linkedin_url: "https://linkedin.com/in/mohammad-salem",
          first_name: "\u0645\u062D\u0645\u062F",
          last_name: "\u0633\u0627\u0644\u0645",
          headline: "Engineering Manager \u0641\u064A CloudFirst",
          company: "CloudFirst",
          industry: "Cloud Computing",
          location: "\u062C\u062F\u0629\u060C \u0627\u0644\u0645\u0645\u0644\u0643\u0629 \u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u0627\u0644\u0633\u0639\u0648\u062F\u064A\u0629",
          email: "mohammad@cloudfirst.com",
          status: "completed",
          priority: 7,
          profile_data: {
            connections: 650,
            followers: 1500,
            endorsements: ["\u0645\u0639\u0645\u0627\u0631\u064A\u0629 \u0627\u0644\u0633\u062D\u0627\u0628\u0629", "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0641\u0631\u064A\u0642"]
          }
        }
      ];
      const { data: leads, error } = await supabase.from("leads").insert(demoLeads).select();
      if (error) {
        throw new Error(`Failed to create leads: ${error.message}`);
      }
      return leads || [];
    } catch (error) {
      console.error("Demo leads creation failed:", error);
      throw error;
    }
  }),
  /**
   * Create demo queue items for the user's team
   */
  createDemoQueueItems: protectedProcedure.mutation(async ({ ctx }) => {
    if (!ctx.user?.id) {
      throw new Error("User not authenticated");
    }
    try {
      const teamId = await getUserTeamId2(ctx.user.id);
      if (!teamId) {
        throw new Error("User has no team");
      }
      const { data: campaigns } = await supabase.from("campaigns").select("id").eq("team_id", teamId).limit(1);
      const { data: leads } = await supabase.from("leads").select("id").eq("team_id", teamId).limit(3);
      if (!campaigns || !leads || campaigns.length === 0 || leads.length === 0) {
        throw new Error("No campaigns or leads found");
      }
      const campaignId = campaigns[0].id;
      const leadIds = leads.map((l) => l.id);
      const queueItems = [
        {
          id: randomUUID2(),
          team_id: teamId,
          campaign_id: campaignId,
          lead_id: leadIds[0],
          step_id: null,
          action_type: "send_message",
          content: "\u0645\u0631\u062D\u0628\u0627\u064B \u0623\u062D\u0645\u062F\u060C \u0644\u0627\u062D\u0638\u062A \u0639\u0645\u0644\u0643 \u0627\u0644\u0645\u0645\u062A\u0627\u0632 \u0641\u064A TechCorp \u0648\u0623\u0648\u062F \u0627\u0644\u062A\u062D\u062F\u062B \u0645\u0639\u0643 \u0639\u0646 \u0641\u0631\u0635\u0629 \u062A\u0639\u0627\u0648\u0646...",
          priority: "important",
          confidence: "high",
          status: "pending"
        },
        {
          id: randomUUID2(),
          team_id: teamId,
          campaign_id: campaignId,
          lead_id: leadIds[1],
          step_id: null,
          action_type: "send_invitation",
          content: "\u0625\u0636\u0627\u0641\u0629 \u0641\u0627\u0637\u0645\u0629 \u0643\u0645\u062A\u0627\u0628\u0639 \u0639\u0644\u0649 LinkedIn",
          priority: "normal",
          confidence: "medium",
          status: "pending"
        },
        {
          id: randomUUID2(),
          team_id: teamId,
          campaign_id: campaignId,
          lead_id: leadIds[2],
          step_id: null,
          action_type: "send_message",
          content: "\u0645\u062A\u0627\u0628\u0639\u0629 \u0645\u0639 \u0645\u062D\u0645\u062F \u0628\u062E\u0635\u0648\u0635 \u0641\u0631\u0635\u0629 \u062A\u0639\u0627\u0648\u0646 \u0641\u064A \u0645\u062C\u0627\u0644 \u0627\u0644\u0628\u0646\u064A\u0629 \u0627\u0644\u062A\u062D\u062A\u064A\u0629 \u0627\u0644\u0633\u062D\u0627\u0628\u064A\u0629",
          priority: "normal",
          confidence: "high",
          status: "pending"
        }
      ];
      const { data: items, error } = await supabase.from("action_queue").insert(queueItems).select();
      if (error) {
        throw new Error(`Failed to create queue items: ${error.message}`);
      }
      return items || [];
    } catch (error) {
      console.error("Demo queue items creation failed:", error);
      throw error;
    }
  })
});

// server/routers/campaigns.ts
import { z as z3 } from "zod";
import { randomUUID as randomUUID3 } from "crypto";
var campaignsRouter = router19({
  /**
   * Get all unique clients for the user's team
   */
  getClients: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user?.id) return [];
    const teamId = await getUserTeamId2(ctx.user.id);
    if (!teamId) return [];
    const { data } = await supabase.from("campaigns").select("client_id, client_name").eq("team_id", teamId).not("client_id", "is", null).order("client_name", { ascending: true });
    const clientMap = /* @__PURE__ */ new Map();
    (data || []).forEach((item) => {
      if (item.client_id && !clientMap.has(item.client_id)) {
        clientMap.set(item.client_id, {
          id: item.client_id,
          name: item.client_name || `\u0639\u0645\u064A\u0644 #${item.client_id.slice(0, 8)}`
        });
      }
    });
    return Array.from(clientMap.values());
  }),
  /**
   * List campaigns for the user's team, optionally filtered by client_id
   */
  list: protectedProcedure.input(z3.object({ clientId: z3.string().optional() }).optional()).query(async ({ ctx, input }) => {
    if (!ctx.user?.id) {
      return [];
    }
    try {
      const teamId = await getUserTeamId2(ctx.user.id);
      if (!teamId) {
        return [];
      }
      let query = supabase.from("campaigns").select("*").eq("team_id", teamId);
      if (input?.clientId) {
        query = query.eq("client_id", input.clientId);
      }
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) {
        console.error("Failed to fetch campaigns:", error);
        return [];
      }
      return data || [];
    } catch (error) {
      console.error("Campaign list error:", error);
      return [];
    }
  }),
  /**
   * Create a new campaign
   */
  create: protectedProcedure.input(
    z3.object({
      name: z3.string().min(1, "\u0627\u0633\u0645 \u0627\u0644\u062D\u0645\u0644\u0629 \u0645\u0637\u0644\u0648\u0628").max(255),
      description: z3.string().optional(),
      type: z3.string().default("combined")
    })
  ).mutation(async ({ ctx, input }) => {
    if (!ctx.user?.id) {
      throw new Error("\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u063A\u064A\u0631 \u0645\u0635\u0631\u062D");
    }
    try {
      const teamId = await getUserTeamId2(ctx.user.id);
      if (!teamId) {
        throw new Error("\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0641\u0631\u064A\u0642");
      }
      const campaignId = randomUUID3();
      const { data, error } = await supabase.from("campaigns").insert({
        id: campaignId,
        team_id: teamId,
        name: input.name,
        description: input.description || null,
        status: "draft",
        type: input.type
      }).select().single();
      if (error) {
        throw new Error(`\u0641\u0634\u0644 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u062D\u0645\u0644\u0629: ${error.message}`);
      }
      return data;
    } catch (error) {
      console.error("Campaign creation error:", error);
      throw error;
    }
  }),
  /**
   * Get a single campaign
   */
  get: protectedProcedure.input(z3.object({ id: z3.string() })).query(async ({ ctx, input }) => {
    if (!ctx.user?.id) {
      return null;
    }
    try {
      const teamId = await getUserTeamId2(ctx.user.id);
      if (!teamId) {
        return null;
      }
      const { data, error } = await supabase.from("campaigns").select("*").eq("id", input.id).eq("team_id", teamId).single();
      if (error) {
        return null;
      }
      return data || null;
    } catch (error) {
      console.error("Campaign get error:", error);
      return null;
    }
  }),
  /**
   * Update campaign status
   */
  updateStatus: protectedProcedure.input(
    z3.object({
      id: z3.string(),
      status: z3.enum(["draft", "active", "paused", "completed", "archived"])
    })
  ).mutation(async ({ ctx, input }) => {
    if (!ctx.user?.id) {
      throw new Error("\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u063A\u064A\u0631 \u0645\u0635\u0631\u062D");
    }
    try {
      const teamId = await getUserTeamId2(ctx.user.id);
      if (!teamId) {
        throw new Error("\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0641\u0631\u064A\u0642");
      }
      const { data, error } = await supabase.from("campaigns").update({ status: input.status }).eq("id", input.id).eq("team_id", teamId).select().single();
      if (error) {
        throw new Error(`\u0641\u0634\u0644 \u062A\u062D\u062F\u064A\u062B \u0627\u0644\u062D\u0645\u0644\u0629: ${error.message}`);
      }
      return data;
    } catch (error) {
      console.error("Campaign update error:", error);
      throw error;
    }
  }),
  /**
   * Delete a campaign
   */
  delete: protectedProcedure.input(z3.object({ id: z3.string() })).mutation(async ({ ctx, input }) => {
    if (!ctx.user?.id) {
      throw new Error("\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u063A\u064A\u0631 \u0645\u0635\u0631\u062D");
    }
    try {
      const teamId = await getUserTeamId2(ctx.user.id);
      if (!teamId) {
        throw new Error("\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0641\u0631\u064A\u0642");
      }
      const { error } = await supabase.from("campaigns").delete().eq("id", input.id).eq("team_id", teamId);
      if (error) {
        throw new Error(`\u0641\u0634\u0644 \u062D\u0630\u0641 \u0627\u0644\u062D\u0645\u0644\u0629: ${error.message}`);
      }
      return { success: true };
    } catch (error) {
      console.error("Campaign delete error:", error);
      throw error;
    }
  })
});

// server/routers/leads.ts
import { z as z4 } from "zod";
var leadsRouter = router19({
  list: protectedProcedure.input(z4.object({ campaignId: z4.string().optional() }).optional()).query(async ({ ctx, input }) => {
    if (!ctx.user?.id) return [];
    const teamId = await getUserTeamId2(ctx.user.id);
    if (!teamId) return [];
    let query = supabase.from("leads").select("*").eq("team_id", teamId);
    if (input?.campaignId) {
      query = query.eq("campaign_id", input.campaignId);
    }
    const { data } = await query.order("created_at", { ascending: false });
    return data || [];
  }),
  importLeads: protectedProcedure.input(
    z4.object({
      campaignId: z4.string(),
      leads: z4.array(
        z4.object({
          linkedin_url: z4.string().url(),
          first_name: z4.string().optional(),
          last_name: z4.string().optional(),
          company: z4.string().optional(),
          headline: z4.string().optional(),
          email: z4.string().email().optional()
        })
      )
    })
  ).mutation(async ({ ctx, input }) => {
    if (!ctx.user?.id) {
      throw new Error("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D");
    }
    const teamId = await getUserTeamId2(ctx.user.id);
    if (!teamId) {
      throw new Error("\u0641\u0631\u064A\u0642 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    }
    const { data: campaign } = await supabase.from("campaigns").select("id").eq("id", input.campaignId).eq("team_id", teamId).single();
    if (!campaign) {
      throw new Error("\u0627\u0644\u062D\u0645\u0644\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629");
    }
    const leadsToInsert = input.leads.map((lead) => ({
      team_id: teamId,
      campaign_id: input.campaignId,
      linkedin_url: lead.linkedin_url,
      first_name: lead.first_name || "",
      last_name: lead.last_name || "",
      company: lead.company || "",
      headline: lead.headline || "",
      email: lead.email || "",
      profile_data: {
        first_name: lead.first_name,
        last_name: lead.last_name,
        company: lead.company,
        headline: lead.headline
      },
      imported_by: ctx.user.id,
      imported_at: (/* @__PURE__ */ new Date()).toISOString()
    }));
    const { data: inserted, error } = await supabase.from("leads").upsert(leadsToInsert, {
      onConflict: "team_id,linkedin_url"
    }).select();
    if (error) {
      console.error("Import error:", error);
      throw new Error(`\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u0627\u0633\u062A\u064A\u0631\u0627\u062F: ${error.message}`);
    }
    const duplicates = leadsToInsert.length - (inserted?.length || 0);
    if (inserted && inserted.length > 0) {
      const queueItems = inserted.map((lead) => ({
        team_id: teamId,
        campaign_id: input.campaignId,
        lead_id: lead.id,
        action_type: "invitation",
        status: "pending",
        requires_approval: true,
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      }));
      await supabase.from("action_queue").insert(queueItems);
    }
    const { data: stats } = await supabase.from("leads").select("id", { count: "exact" }).eq("campaign_id", input.campaignId);
    if (stats) {
      await supabase.from("campaigns").update({
        stats: {
          total_leads: stats.length || 0,
          completed: 0,
          pending: inserted?.length || 0,
          failed: 0
        },
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }).eq("id", input.campaignId);
    }
    return {
      imported: inserted?.length || 0,
      duplicates,
      message: `\u062A\u0645 \u0627\u0633\u062A\u064A\u0631\u0627\u062F ${inserted?.length || 0} \u0639\u0645\u064A\u0644 \u0645\u062D\u062A\u0645\u0644`
    };
  }),
  updateStatus: protectedProcedure.input(z4.object({ leadId: z4.string(), status: z4.string() })).mutation(async ({ ctx, input }) => {
    if (!ctx.user?.id) return null;
    const teamId = await getUserTeamId2(ctx.user.id);
    if (!teamId) return null;
    const { data } = await supabase.from("leads").update({ status: input.status, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", input.leadId).eq("team_id", teamId).select().single();
    return data || null;
  }),
  delete: protectedProcedure.input(z4.object({ leadId: z4.string() })).mutation(async ({ ctx, input }) => {
    if (!ctx.user?.id) return null;
    const teamId = await getUserTeamId2(ctx.user.id);
    if (!teamId) return null;
    const { data } = await supabase.from("leads").delete().eq("id", input.leadId).eq("team_id", teamId).select().single();
    return data || null;
  })
});

// server/routers/templates.ts
import { z as z5 } from "zod";
var templatesRouter = router19({
  list: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user?.id) return [];
    const teamId = await getUserTeamId2(ctx.user.id);
    if (!teamId) return [];
    const { data } = await supabase.from("message_templates").select("*").eq("team_id", teamId).order("created_at", { ascending: false });
    return data || [];
  }),
  create: protectedProcedure.input(
    z5.object({
      name: z5.string().min(1, "\u0627\u0633\u0645 \u0627\u0644\u0642\u0627\u0644\u0628 \u0645\u0637\u0644\u0648\u0628"),
      category: z5.string().optional(),
      subject: z5.string().optional(),
      content: z5.string().min(1, "\u0645\u062D\u062A\u0648\u0649 \u0627\u0644\u0642\u0627\u0644\u0628 \u0645\u0637\u0644\u0648\u0628"),
      variables: z5.array(z5.string()).optional()
    })
  ).mutation(async ({ ctx, input }) => {
    if (!ctx.user?.id) {
      throw new Error("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D");
    }
    const teamId = await getUserTeamId2(ctx.user.id);
    if (!teamId) {
      throw new Error("\u0641\u0631\u064A\u0642 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    }
    const variableRegex = /\{\{(\w+)\}\}/g;
    const variables = [];
    let match;
    while ((match = variableRegex.exec(input.content)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }
    const { data, error } = await supabase.from("message_templates").insert({
      team_id: teamId,
      name: input.name,
      category: input.category || "\u0639\u0627\u0645",
      subject: input.subject || "",
      content: input.content,
      variables: [...input.variables || [], ...variables],
      created_by: ctx.user.id,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    }).select().single();
    if (error) {
      throw new Error(`\u062E\u0637\u0623 \u0641\u064A \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0642\u0627\u0644\u0628: ${error.message}`);
    }
    return data;
  }),
  update: protectedProcedure.input(
    z5.object({
      templateId: z5.string(),
      name: z5.string().optional(),
      category: z5.string().optional(),
      subject: z5.string().optional(),
      content: z5.string().optional()
    })
  ).mutation(async ({ ctx, input }) => {
    if (!ctx.user?.id) {
      throw new Error("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D");
    }
    const teamId = await getUserTeamId2(ctx.user.id);
    if (!teamId) {
      throw new Error("\u0641\u0631\u064A\u0642 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    }
    const { data: template } = await supabase.from("message_templates").select("id").eq("id", input.templateId).eq("team_id", teamId).single();
    if (!template) {
      throw new Error("\u0627\u0644\u0642\u0627\u0644\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    }
    let variables = [];
    if (input.content) {
      const variableRegex = /\{\{(\w+)\}\}/g;
      let match;
      while ((match = variableRegex.exec(input.content)) !== null) {
        if (!variables.includes(match[1])) {
          variables.push(match[1]);
        }
      }
    }
    const updateData = {};
    if (input.name) updateData.name = input.name;
    if (input.category) updateData.category = input.category;
    if (input.subject) updateData.subject = input.subject;
    if (input.content) updateData.content = input.content;
    if (variables.length > 0) updateData.variables = variables;
    const { data, error } = await supabase.from("message_templates").update(updateData).eq("id", input.templateId).eq("team_id", teamId).select().single();
    if (error) {
      throw new Error(`\u062E\u0637\u0623 \u0641\u064A \u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0642\u0627\u0644\u0628: ${error.message}`);
    }
    return data;
  }),
  delete: protectedProcedure.input(z5.object({ templateId: z5.string() })).mutation(async ({ ctx, input }) => {
    if (!ctx.user?.id) {
      throw new Error("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D");
    }
    const teamId = await getUserTeamId2(ctx.user.id);
    if (!teamId) {
      throw new Error("\u0641\u0631\u064A\u0642 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    }
    const { data, error } = await supabase.from("message_templates").delete().eq("id", input.templateId).eq("team_id", teamId).select().single();
    if (error) {
      throw new Error(`\u062E\u0637\u0623 \u0641\u064A \u062D\u0630\u0641 \u0627\u0644\u0642\u0627\u0644\u0628: ${error.message}`);
    }
    return data;
  }),
  preview: protectedProcedure.input(
    z5.object({
      content: z5.string(),
      variables: z5.record(z5.string(), z5.any()).optional()
    })
  ).query(async ({ input }) => {
    let preview = input.content;
    if (input.variables) {
      Object.entries(input.variables).forEach(([key, value]) => {
        preview = preview.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), String(value));
      });
    }
    preview = preview.replace(/\{\{(\w+)\}\}/g, "[[$1]]");
    return { preview };
  }),
  linkToCampaign: protectedProcedure.input(
    z5.object({
      templateId: z5.string(),
      campaignId: z5.string()
    })
  ).mutation(async ({ ctx, input }) => {
    if (!ctx.user?.id) {
      throw new Error("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D");
    }
    const teamId = await getUserTeamId2(ctx.user.id);
    if (!teamId) {
      throw new Error("\u0641\u0631\u064A\u0642 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    }
    const { data: template } = await supabase.from("message_templates").select("id").eq("id", input.templateId).eq("team_id", teamId).single();
    if (!template) {
      throw new Error("\u0627\u0644\u0642\u0627\u0644\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    }
    const { data: campaign } = await supabase.from("campaigns").select("id, configuration").eq("id", input.campaignId).eq("team_id", teamId).single();
    if (!campaign) {
      throw new Error("\u0627\u0644\u062D\u0645\u0644\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629");
    }
    const config = campaign.configuration || {};
    config.template_id = input.templateId;
    const { data, error } = await supabase.from("campaigns").update({
      configuration: config,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", input.campaignId).select().single();
    if (error) {
      throw new Error(`\u062E\u0637\u0623 \u0641\u064A \u0631\u0628\u0637 \u0627\u0644\u0642\u0627\u0644\u0628: ${error.message}`);
    }
    return data;
  })
});

// server/routers/extension.ts
import { z as z6 } from "zod";
var extensionRouter = router19({
  // Campaign: list all campaigns for team
  campaignsList: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user?.id) {
      throw new Error("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D");
    }
    const teamId = await getUserTeamId2(ctx.user.id);
    if (!teamId) {
      throw new Error("\u0641\u0631\u064A\u0642 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    }
    const { data } = await supabase.from("campaigns").select("id, name, type, status, stats, created_at, updated_at").eq("team_id", teamId).order("created_at", { ascending: false });
    return {
      success: true,
      data: data || []
    };
  }),
  // Campaign: create new campaign
  campaignCreate: protectedProcedure.input(
    z6.object({
      name: z6.string().min(1, "\u0627\u0633\u0645 \u0627\u0644\u062D\u0645\u0644\u0629 \u0645\u0637\u0644\u0648\u0628"),
      type: z6.enum(["invitation", "message", "sequence"]),
      configuration: z6.record(z6.string(), z6.unknown()).optional()
    })
  ).mutation(async ({ ctx, input }) => {
    if (!ctx.user?.id) {
      throw new Error("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D");
    }
    const teamId = await getUserTeamId2(ctx.user.id);
    if (!teamId) {
      throw new Error("\u0641\u0631\u064A\u0642 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    }
    const { data, error } = await supabase.from("campaigns").insert({
      team_id: teamId,
      name: input.name,
      type: input.type,
      configuration: input.configuration || {},
      status: "draft"
    }).select().single();
    if (error) {
      throw new Error(`\u062E\u0637\u0623 \u0641\u064A \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u062D\u0645\u0644\u0629: ${error.message}`);
    }
    return {
      success: true,
      data: data?.[0] || null
    };
  }),
  // Campaign: get specific campaign
  campaignGet: protectedProcedure.input(z6.object({ campaignId: z6.string() })).query(async ({ ctx, input }) => {
    if (!ctx.user?.id) {
      throw new Error("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D");
    }
    const teamId = await getUserTeamId2(ctx.user.id);
    if (!teamId) {
      throw new Error("\u0641\u0631\u064A\u0642 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    }
    const { data } = await supabase.from("campaigns").select("*").eq("id", input.campaignId).eq("team_id", teamId);
    if (!data) {
      throw new Error("\u0627\u0644\u062D\u0645\u0644\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629");
    }
    return {
      success: true,
      data
    };
  }),
  // Leads: list leads for campaign
  leadsList: protectedProcedure.input(z6.object({ campaignId: z6.string() })).query(async ({ ctx, input }) => {
    if (!ctx.user?.id) {
      throw new Error("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D");
    }
    const teamId = await getUserTeamId2(ctx.user.id);
    if (!teamId) {
      throw new Error("\u0641\u0631\u064A\u0642 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    }
    const { data } = await supabase.from("leads").select("id, first_name, last_name, company, headline, linkedin_url, status, created_at").eq("campaign_id", input.campaignId).eq("team_id", teamId).order("created_at", { ascending: false });
    return {
      success: true,
      data: data || []
    };
  }),
  // Leads: add single lead
  leadsAdd: protectedProcedure.input(
    z6.object({
      campaignId: z6.string(),
      linkedin_url: z6.string().url(),
      first_name: z6.string().optional(),
      last_name: z6.string().optional(),
      company: z6.string().optional(),
      headline: z6.string().optional()
    })
  ).mutation(async ({ ctx, input }) => {
    if (!ctx.user?.id) {
      throw new Error("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D");
    }
    const teamId = await getUserTeamId2(ctx.user.id);
    if (!teamId) {
      throw new Error("\u0641\u0631\u064A\u0642 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    }
    const { data: campaign } = await supabase.from("campaigns").select("id").eq("id", input.campaignId).eq("team_id", teamId);
    if (!campaign) {
      throw new Error("\u0627\u0644\u062D\u0645\u0644\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629");
    }
    const { data: leadArray, error } = await supabase.from("leads").insert({
      team_id: teamId,
      campaign_id: input.campaignId,
      linkedin_url: input.linkedin_url,
      first_name: input.first_name || "",
      last_name: input.last_name || "",
      company: input.company || "",
      headline: input.headline || "",
      profile_data: {
        first_name: input.first_name,
        last_name: input.last_name,
        company: input.company,
        headline: input.headline
      },
      imported_by: ctx.user.id,
      imported_at: (/* @__PURE__ */ new Date()).toISOString()
    }).select("id, first_name, last_name, company, linkedin_url, created_at");
    if (error) {
      throw new Error(`\u062E\u0637\u0623 \u0641\u064A \u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u0639\u0645\u064A\u0644: ${error.message}`);
    }
    const lead = leadArray?.[0];
    if (!lead) {
      throw new Error("\u0641\u0634\u0644 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0639\u0645\u064A\u0644");
    }
    await supabase.from("action_queue").insert({
      team_id: teamId,
      campaign_id: input.campaignId,
      lead_id: lead.id,
      action_type: "invitation",
      status: "pending",
      requires_approval: true,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    });
    return {
      success: true,
      data: lead
    };
  }),
  // Queue: list queue items
  queueList: protectedProcedure.input(z6.object({ status: z6.enum(["pending", "approved", "rejected"]).optional() })).query(async ({ ctx, input }) => {
    if (!ctx.user?.id) {
      throw new Error("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D");
    }
    const teamId = await getUserTeamId2(ctx.user.id);
    if (!teamId) {
      throw new Error("\u0641\u0631\u064A\u0642 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    }
    let query = supabase.from("action_queue").select("id, campaign_id, lead_id, action_type, status, requires_approval, created_at, approved_at").eq("team_id", teamId);
    if (input?.status) {
      query = query.eq("status", input.status);
    }
    const { data } = await query.order("created_at", { ascending: false });
    return {
      success: true,
      data: data || []
    };
  }),
  // Queue: approve item
  queueApprove: protectedProcedure.input(z6.object({ itemId: z6.string() })).mutation(async ({ ctx, input }) => {
    if (!ctx.user?.id) {
      throw new Error("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D");
    }
    const teamId = await getUserTeamId2(ctx.user.id);
    if (!teamId) {
      throw new Error("\u0641\u0631\u064A\u0642 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    }
    const { data, error } = await supabase.from("action_queue").update({
      status: "approved",
      approved_by: ctx.user.id,
      approved_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", input.itemId).eq("team_id", teamId).select("id, status, approved_at");
    if (error) {
      throw new Error(`\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629: ${error.message}`);
    }
    return {
      success: true,
      data
    };
  }),
  // Queue: reject item
  queueReject: protectedProcedure.input(z6.object({ itemId: z6.string() })).mutation(async ({ ctx, input }) => {
    if (!ctx.user?.id) {
      throw new Error("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D");
    }
    const teamId = await getUserTeamId2(ctx.user.id);
    if (!teamId) {
      throw new Error("\u0641\u0631\u064A\u0642 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    }
    const { data, error } = await supabase.from("action_queue").update({
      status: "rejected",
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", input.itemId).eq("team_id", teamId).select("id, status, updated_at");
    if (error) {
      throw new Error(`\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u0631\u0641\u0636: ${error.message}`);
    }
    return {
      success: true,
      data
    };
  }),
  // Templates: list templates
  templatesList: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user?.id) {
      throw new Error("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D");
    }
    const teamId = await getUserTeamId2(ctx.user.id);
    if (!teamId) {
      throw new Error("\u0641\u0631\u064A\u0642 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    }
    const { data } = await supabase.from("message_templates").select("id, name, category, subject, content, variables, created_at").eq("team_id", teamId).order("created_at", { ascending: false });
    return {
      success: true,
      data: data || []
    };
  }),
  // Templates: get specific template
  templatesGet: protectedProcedure.input(z6.object({ templateId: z6.string() })).query(async ({ ctx, input }) => {
    if (!ctx.user?.id) {
      throw new Error("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D");
    }
    const teamId = await getUserTeamId2(ctx.user.id);
    if (!teamId) {
      throw new Error("\u0641\u0631\u064A\u0642 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    }
    const { data } = await supabase.from("message_templates").select("*").eq("id", input.templateId).eq("team_id", teamId);
    if (!data) {
      throw new Error("\u0627\u0644\u0642\u0627\u0644\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    }
    return {
      success: true,
      data
    };
  }),
  // Health check
  health: protectedProcedure.query(async ({ ctx }) => {
    return {
      success: true,
      data: {
        authenticated: !!ctx.user?.id,
        userId: ctx.user?.id,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }
    };
  })
});

// server/routers/billing.ts
import { z as z7 } from "zod";

// shared/plans.ts
var PLANS = {
  starter: {
    id: "starter",
    name: "Starter",
    nameAr: "\u0627\u0644\u0645\u0628\u062A\u062F\u0626",
    description: "Perfect for testing Wassel",
    descriptionAr: "\u0645\u062B\u0627\u0644\u064A \u0644\u0627\u062E\u062A\u0628\u0627\u0631 \u0648\u0635\u0644",
    monthlyLeadLimit: 100,
    maxCampaigns: 3,
    price: 0,
    priceAr: "\u0645\u062C\u0627\u0646\u064A",
    features: [
      "Up to 100 leads/month",
      "3 campaigns",
      "Basic analytics",
      "Email support"
    ],
    featuresAr: [
      "\u062D\u062A\u0649 100 \u0639\u0645\u064A\u0644 \u0634\u0647\u0631\u064A\u0627\u064B",
      "3 \u062D\u0645\u0644\u0627\u062A",
      "\u062A\u062D\u0644\u064A\u0644\u0627\u062A \u0623\u0633\u0627\u0633\u064A\u0629",
      "\u062F\u0639\u0645 \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A"
    ],
    color: "blue",
    badge: "\u0645\u0628\u062A\u062F\u0626"
  },
  pro: {
    id: "pro",
    name: "Pro",
    nameAr: "\u0627\u062D\u062A\u0631\u0627\u0641\u064A",
    description: "For growing teams",
    descriptionAr: "\u0644\u0644\u0641\u0631\u0642 \u0627\u0644\u0645\u062A\u0646\u0627\u0645\u064A\u0629",
    monthlyLeadLimit: 500,
    maxCampaigns: 10,
    price: 99,
    priceAr: "99 \u0631.\u0633/\u0634\u0647\u0631",
    features: [
      "Up to 500 leads/month",
      "10 campaigns",
      "Advanced analytics",
      "Priority support",
      "Multi-client view",
      "Bulk operations"
    ],
    featuresAr: [
      "\u062D\u062A\u0649 500 \u0639\u0645\u064A\u0644 \u0634\u0647\u0631\u064A\u0627\u064B",
      "10 \u062D\u0645\u0644\u0627\u062A",
      "\u062A\u062D\u0644\u064A\u0644\u0627\u062A \u0645\u062A\u0642\u062F\u0645\u0629",
      "\u062F\u0639\u0645 \u0623\u0648\u0644\u0648\u064A",
      "\u0639\u0631\u0636 \u0645\u062A\u0639\u062F\u062F \u0627\u0644\u0639\u0645\u0644\u0627\u0621",
      "\u0627\u0644\u0639\u0645\u0644\u064A\u0627\u062A \u0627\u0644\u062C\u0645\u0627\u0639\u064A\u0629"
    ],
    color: "purple",
    badge: "\u0627\u062D\u062A\u0631\u0627\u0641\u064A"
  },
  agency: {
    id: "agency",
    name: "Agency",
    nameAr: "\u0648\u0643\u0627\u0644\u0629",
    description: "For agencies & enterprises",
    descriptionAr: "\u0644\u0644\u0648\u0643\u0627\u0644\u0627\u062A \u0648\u0627\u0644\u0645\u0624\u0633\u0633\u0627\u062A",
    monthlyLeadLimit: 5e3,
    maxCampaigns: 100,
    price: 499,
    priceAr: "499 \u0631.\u0633/\u0634\u0647\u0631",
    features: [
      "Up to 5000 leads/month",
      "Unlimited campaigns",
      "Custom analytics",
      "24/7 support",
      "Multi-client management",
      "API access",
      "Custom integrations",
      "Dedicated account manager"
    ],
    featuresAr: [
      "\u062D\u062A\u0649 5000 \u0639\u0645\u064A\u0644 \u0634\u0647\u0631\u064A\u0627\u064B",
      "\u062D\u0645\u0644\u0627\u062A \u063A\u064A\u0631 \u0645\u062D\u062F\u0648\u062F\u0629",
      "\u062A\u062D\u0644\u064A\u0644\u0627\u062A \u0645\u062E\u0635\u0635\u0629",
      "\u062F\u0639\u0645 24/7",
      "\u0625\u062F\u0627\u0631\u0629 \u0645\u062A\u0639\u062F\u062F\u0629 \u0627\u0644\u0639\u0645\u0644\u0627\u0621",
      "\u0648\u0635\u0648\u0644 API",
      "\u062A\u0643\u0627\u0645\u0644\u0627\u062A \u0645\u062E\u0635\u0635\u0629",
      "\u0645\u062F\u064A\u0631 \u062D\u0633\u0627\u0628 \u0645\u062E\u0635\u0635"
    ],
    color: "gold",
    badge: "\u0648\u0643\u0627\u0644\u0629"
  }
};
function getPlan(planId) {
  return PLANS[planId] || PLANS.starter;
}
function getRemainingLeads(usedLeads, plan) {
  return Math.max(0, plan.monthlyLeadLimit - usedLeads);
}
function getUsagePercentage(usedLeads, plan) {
  return Math.min(100, usedLeads / plan.monthlyLeadLimit * 100);
}

// server/routers/billing.ts
var billingRouter = router19({
  /**
   * Get current plan and usage for user's team
   */
  getUsage: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user?.id) {
      return {
        plan: "starter",
        usedLeads: 0,
        monthlyLimit: 100,
        percentageUsed: 0,
        remainingLeads: 100
      };
    }
    try {
      const teamId = await getUserTeamId2(ctx.user.id);
      if (!teamId) {
        return {
          plan: "starter",
          usedLeads: 0,
          monthlyLimit: 100,
          percentageUsed: 0,
          remainingLeads: 100
        };
      }
      const { data: team } = await supabase.from("teams").select("plan").eq("id", teamId).single();
      const planId = team?.plan || "starter";
      const plan = getPlan(planId);
      const now = /* @__PURE__ */ new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { data: leads } = await supabase.from("leads").select("id").eq("team_id", teamId).gte("created_at", monthStart);
      const usedLeads = leads?.length || 0;
      const percentageUsed = getUsagePercentage(usedLeads, plan);
      const remainingLeads = getRemainingLeads(usedLeads, plan);
      return {
        plan: planId,
        usedLeads,
        monthlyLimit: plan.monthlyLeadLimit,
        percentageUsed,
        remainingLeads
      };
    } catch (error) {
      console.error("[Wassel] BILLING_USAGE_01 - Failed to get usage:", error);
      return {
        plan: "starter",
        usedLeads: 0,
        monthlyLimit: 100,
        percentageUsed: 0,
        remainingLeads: 100
      };
    }
  }),
  /**
   * Check if user can add more leads
   */
  canAddLead: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user?.id) return false;
    try {
      const teamId = await getUserTeamId2(ctx.user.id);
      if (!teamId) return false;
      const { data: team } = await supabase.from("teams").select("plan").eq("id", teamId).single();
      const planId = team?.plan || "starter";
      const plan = getPlan(planId);
      const now = /* @__PURE__ */ new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { data: leads } = await supabase.from("leads").select("id").eq("team_id", teamId).gte("created_at", monthStart);
      const usedLeads = leads?.length || 0;
      return usedLeads < plan.monthlyLeadLimit;
    } catch (error) {
      console.error("[Wassel] BILLING_CHECK_01 - Failed to check lead limit:", error);
      return true;
    }
  }),
  /**
   * Get all available plans
   */
  getPlans: protectedProcedure.query(async () => {
    return {
      starter: {
        id: "starter",
        nameAr: "\u0627\u0644\u0645\u0628\u062A\u062F\u0626",
        monthlyLeadLimit: 100,
        maxCampaigns: 3,
        priceAr: "\u0645\u062C\u0627\u0646\u064A",
        features: ["\u062D\u062A\u0649 100 \u0639\u0645\u064A\u0644 \u0634\u0647\u0631\u064A\u0627\u064B", "3 \u062D\u0645\u0644\u0627\u062A", "\u062A\u062D\u0644\u064A\u0644\u0627\u062A \u0623\u0633\u0627\u0633\u064A\u0629"]
      },
      pro: {
        id: "pro",
        nameAr: "\u0627\u062D\u062A\u0631\u0627\u0641\u064A",
        monthlyLeadLimit: 500,
        maxCampaigns: 10,
        priceAr: "99 \u0631.\u0633/\u0634\u0647\u0631",
        features: ["\u062D\u062A\u0649 500 \u0639\u0645\u064A\u0644 \u0634\u0647\u0631\u064A\u0627\u064B", "10 \u062D\u0645\u0644\u0627\u062A", "\u062A\u062D\u0644\u064A\u0644\u0627\u062A \u0645\u062A\u0642\u062F\u0645\u0629"]
      },
      agency: {
        id: "agency",
        nameAr: "\u0648\u0643\u0627\u0644\u0629",
        monthlyLeadLimit: 5e3,
        maxCampaigns: 100,
        priceAr: "499 \u0631.\u0633/\u0634\u0647\u0631",
        features: ["\u062D\u062A\u0649 5000 \u0639\u0645\u064A\u0644 \u0634\u0647\u0631\u064A\u0627\u064B", "\u062D\u0645\u0644\u0627\u062A \u063A\u064A\u0631 \u0645\u062D\u062F\u0648\u062F\u0629", "\u062F\u0639\u0645 24/7"]
      }
    };
  }),
  /**
   * Request upgrade (logs request for founder follow-up)
   */
  requestUpgrade: protectedProcedure.input(z7.object({ targetPlan: z7.enum(["pro", "agency"]) })).mutation(async ({ ctx, input }) => {
    if (!ctx.user?.id) {
      throw new Error("\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u063A\u064A\u0631 \u0645\u0635\u0631\u062D");
    }
    try {
      const teamId = await getUserTeamId2(ctx.user.id);
      if (!teamId) {
        throw new Error("\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0641\u0631\u064A\u0642");
      }
      console.log(
        `[Wassel] UPGRADE_REQUEST - User ${ctx.user.id} requested upgrade to ${input.targetPlan}`
      );
      return {
        success: true,
        message: "\u062A\u0645 \u0627\u0633\u062A\u0642\u0628\u0627\u0644 \u0637\u0644\u0628\u0643. \u0633\u064A\u062A\u0648\u0627\u0635\u0644 \u0645\u0639\u0643 \u0641\u0631\u064A\u0642\u0646\u0627 \u0642\u0631\u064A\u0628\u0627\u064B.",
        messageEn: "Your upgrade request has been received. Our team will contact you soon."
      };
    } catch (error) {
      console.error("[Wassel] UPGRADE_REQUEST_01 - Failed to request upgrade:", error);
      throw error;
    }
  })
});

// server/routers.ts
import { z as z8 } from "zod";
var appRouter = router19({
  system: systemRouter,
  auth: authRouter,
  demo: demoRouter,
  campaigns: campaignsRouter,
  leads: leadsRouter,
  templates: templatesRouter,
  extension: extensionRouter,
  billing: billingRouter,
  queue: router19({
    list: protectedProcedure.input(z8.object({ status: z8.enum(["all", "new", "approved"]).optional() }).optional()).query(async ({ ctx, input }) => {
      if (!ctx.user?.id) return [];
      const teamId = await getUserTeamId2(ctx.user.id);
      if (!teamId) return [];
      let query = supabase.from("action_queue").select(`
            id,
            lead_id,
            campaign_id,
            status,
            created_at,
            updated_at,
            campaigns:campaign_id(name)
          `).eq("team_id", teamId);
      if (input?.status === "new") {
        query = query.eq("status", "pending");
      } else if (input?.status === "approved") {
        query = query.eq("status", "ready");
      } else {
        query = query.in("status", ["pending", "ready", "skipped"]);
      }
      const { data } = await query.order("created_at", { ascending: false });
      return data || [];
    }),
    approve: protectedProcedure.input(z8.object({ itemId: z8.string() })).mutation(async ({ ctx, input }) => {
      if (!ctx.user?.id) return null;
      const teamId = await getUserTeamId2(ctx.user.id);
      if (!teamId) return null;
      const { data } = await supabase.from("action_queue").update({
        status: "ready",
        approved_by: ctx.user.id,
        approved_at: (/* @__PURE__ */ new Date()).toISOString(),
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }).eq("id", input.itemId).eq("team_id", teamId).select().single();
      return data || null;
    }),
    reject: protectedProcedure.input(z8.object({ itemId: z8.string() })).mutation(async ({ ctx, input }) => {
      if (!ctx.user?.id) return null;
      const teamId = await getUserTeamId2(ctx.user.id);
      if (!teamId) return null;
      const { data } = await supabase.from("action_queue").update({
        status: "skipped",
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }).eq("id", input.itemId).eq("team_id", teamId).select().single();
      return data || null;
    }),
    // Bulk operations
    bulkApprove: protectedProcedure.input(z8.object({ itemIds: z8.array(z8.string()) })).mutation(async ({ ctx, input }) => {
      if (!ctx.user?.id || input.itemIds.length === 0) return null;
      const teamId = await getUserTeamId2(ctx.user.id);
      if (!teamId) return null;
      const { data } = await supabase.from("action_queue").update({
        status: "ready",
        approved_by: ctx.user.id,
        approved_at: (/* @__PURE__ */ new Date()).toISOString(),
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }).in("id", input.itemIds).eq("team_id", teamId).select();
      return { count: data?.length || 0, items: data || [] };
    }),
    bulkReject: protectedProcedure.input(z8.object({ itemIds: z8.array(z8.string()) })).mutation(async ({ ctx, input }) => {
      if (!ctx.user?.id || input.itemIds.length === 0) return null;
      const teamId = await getUserTeamId2(ctx.user.id);
      if (!teamId) return null;
      const { data } = await supabase.from("action_queue").update({
        status: "skipped",
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }).in("id", input.itemIds).eq("team_id", teamId).select();
      return { count: data?.length || 0, items: data || [] };
    })
  })
});

// server/_core/context.ts
import { createClient as createClient5 } from "@supabase/supabase-js";
function getServiceSupabase() {
  const supabaseUrl2 = process.env.SUPABASE_URL || "";
  const supabaseServiceKey2 = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return createClient5(supabaseUrl2, supabaseServiceKey2, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}
async function getSupabaseUser(authHeader) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.slice(7);
  try {
    const supabase3 = getServiceSupabase();
    const { data: { user }, error } = await supabase3.auth.getUser(token);
    if (error || !user) {
      return null;
    }
    let role = "client_user";
    const { data: profile } = await supabase3.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role === "super_admin") {
      role = "super_admin";
    }
    let teamId = null;
    const { data: membership } = await supabase3.from("team_members").select("team_id").eq("user_id", user.id).limit(1).single();
    if (membership?.team_id) {
      teamId = membership.team_id;
    }
    return {
      id: user.id,
      email: user.email,
      role,
      teamId
    };
  } catch (error) {
    console.error("Failed to verify Supabase token:", error);
    return null;
  }
}
async function createContext(opts) {
  let user = null;
  try {
    const authHeader = opts.req.headers.authorization;
    user = await getSupabaseUser(authHeader);
  } catch (error) {
    console.error("Context creation error:", error);
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}
function verifyExtensionToken(token) {
  try {
    const crypto3 = __require("crypto");
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [payloadBase64, signature] = parts;
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || "wassel-ext-secret";
    const expectedSig = crypto3.createHmac("sha256", secret).update(payloadBase64).digest("base64url");
    if (signature !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(payloadBase64, "base64url").toString());
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1e3)) return null;
    if (payload.iss !== "wassel-ext") return null;
    return {
      id: payload.userId,
      email: payload.email,
      role: payload.role || "client_user",
      teamId: payload.targetClientId ? null : payload.teamId
      // If operating as client, use target context
    };
  } catch {
    return null;
  }
}
async function expressAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  let user = await getSupabaseUser(authHeader);
  if (!user && authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    user = verifyExtensionToken(token);
  }
  req.user = user;
  next();
}
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    if (req.user.role !== role && role === "super_admin") {
      return res.status(403).json({ error: "Super admin access required" });
    }
    next();
  };
}

// server/_core/userRoutes.ts
import { Router as Router19 } from "express";
import { createClient as createClient6 } from "@supabase/supabase-js";
var router20 = Router19();
function getSupabase3() {
  return createClient6(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );
}
router20.patch("/profile", async (req, res) => {
  const supabase3 = getSupabase3();
  try {
    const authHeader = req.headers.authorization;
    console.log("[UserProfile] PATCH /profile called, auth header present:", !!authHeader);
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("[UserProfile] Missing or invalid authorization header");
      return res.status(401).json({ error: "Missing authorization header" });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase3.auth.getUser(token);
    if (authError || !user) {
      console.error("[UserProfile] Auth error:", authError?.message || "No user found");
      return res.status(401).json({ error: "Invalid token: " + (authError?.message || "user not found") });
    }
    console.log("[UserProfile] User authenticated:", user.id, user.email);
    const allowedFields = ["extension_installed", "linkedin_connected", "full_name"];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== void 0) {
        updates[field] = req.body[field];
      }
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No valid fields to update. Allowed: " + allowedFields.join(", ") });
    }
    console.log("[UserProfile] Updating fields:", JSON.stringify(updates), "for user:", user.id);
    const { data, error: updateError } = await supabase3.from("profiles").update(updates).eq("id", user.id).select().single();
    if (updateError) {
      console.error("[UserProfile] Supabase update error:", updateError);
      return res.status(500).json({ error: "Database update failed: " + updateError.message });
    }
    console.log("[UserProfile] Update successful:", JSON.stringify(data));
    return res.json({ success: true, profile: data });
  } catch (err) {
    console.error("[UserProfile] Unexpected error:", err);
    return res.status(500).json({ error: "Server error: " + err.message });
  }
});
router20.get("/profile", async (req, res) => {
  const supabase3 = getSupabase3();
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing authorization header" });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error } = await supabase3.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: "Invalid token" });
    }
    const { data: profile } = await supabase3.from("profiles").select("*").eq("id", user.id).single();
    return res.json({ profile });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
var userRoutes_default = router20;

// server/_core/vercel.ts
var app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.get("/api/debug-env", (_req, res) => {
  res.json({
    hasApify: !!process.env.APIFY_API_TOKEN,
    apifyPrefix: process.env.APIFY_API_TOKEN?.slice(0, 15) || "NOT SET",
    nodeEnv: process.env.NODE_ENV,
    version: "v3-2026-03-30"
  });
});
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", process.env.VITE_FRONTEND_URL || "*");
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin,X-Requested-With,Content-Type,Accept,Authorization");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
});
registerOAuthRoutes(app);
app.use("/api/auth", authRoutes_default);
app.use("/api/auth/linkedin", linkedinAuth_default);
app.use("/api/linkedin", linkedinOAuthRoutes_default);
app.use("/api/invites", expressAuthMiddleware, requireRole("super_admin"), inviteRoutes_default);
app.use("/api/clients", expressAuthMiddleware, requireRole("super_admin"), inviteRoutes_default);
app.use("/api/admin/clients", expressAuthMiddleware, requireRole("super_admin"), clientRoutes_default);
app.use("/api/admin", expressAuthMiddleware, requireRole("super_admin"), adminRoutes_default);
app.use("/api/ext", expressAuthMiddleware, extensionRoutes_default);
app.use("/api/sequence", expressAuthMiddleware, sequenceRoutes_default);
app.use("/api/activity-log", expressAuthMiddleware, activityRoutes_default);
app.use("/api/ai", expressAuthMiddleware, aiRoutes_default);
app.use("/api/prospects", expressAuthMiddleware, apolloRoutes_default);
app.use("/api/posts", expressAuthMiddleware, postRoutes_default);
app.use("/api/messages", expressAuthMiddleware, messageRoutes_default);
app.use("/api/session", expressAuthMiddleware, sessionRoutes_default);
app.use("/api/automation", expressAuthMiddleware, automationRoutes_default);
app.use("/api/cloud", expressAuthMiddleware, cloudCampaignRoutes_default);
app.use("/api/cron", campaignCron_default);
app.use("/api/stripe", stripeRoutes_default);
app.use("/api/user", userRoutes_default);
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, version: "v3-2026-03-30", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
});
app.get("/api/proxy-image", async (req, res) => {
  const url = req.query.url;
  if (!url || !url.includes("licdn.com") && !url.includes("linkedin.com") && !url.includes("lnkd.in")) {
    return res.status(400).json({ error: "Invalid or disallowed URL" });
  }
  try {
    const imgRes = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "image/*" }
    });
    if (!imgRes.ok) return res.status(imgRes.status).end();
    const contentType = imgRes.headers.get("content-type") || "image/jpeg";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    res.send(buffer);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.get("/api/linkedin-test", (_req, res) => {
  res.json({
    linkedinRoutes: "ACTIVE \u2705",
    clientId: process.env.LINKEDIN_CLIENT_ID ? "SET \u2705" : "MISSING \u274C",
    secret: process.env.LINKEDIN_CLIENT_SECRET ? "SET \u2705" : "MISSING \u274C",
    redirectUri: process.env.LINKEDIN_REDIRECT_URI || "MISSING \u274C",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext
  })
);
var vercel_default = app;
export {
  vercel_default as default
};
