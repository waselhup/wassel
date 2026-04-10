// server/_core/vercel.ts
import express from "express";
import cors from "cors";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// server/_core/trpc.ts
import { TRPCError as TRPCError7 } from "@trpc/server";

// server/_core/trpc-init.ts
import { initTRPC, TRPCError } from "@trpc/server";
var t = initTRPC.context().create();
var router = t.router;
var publicProcedure = t.procedure;
var protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Not authenticated"
    });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});

// server/_core/routes/linkedin.ts
import { z } from "zod";
import { TRPCError as TRPCError2 } from "@trpc/server";
var APIFY_TOKEN = process.env.APIFY_TOKEN || process.env.APIFY_API_TOKEN || "";
var ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
var CLAUDE_MODEL = "claude-sonnet-4-6";
async function scrapeLinkedInProfile(profileUrl) {
  console.log("[APIFY] Starting scrape for:", profileUrl);
  const runRes = await fetch(
    `https://api.apify.com/v2/acts/dev_fusion~Linkedin-Profile-Scraper/runs?token=${APIFY_TOKEN}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileUrls: [profileUrl] })
    }
  );
  if (!runRes.ok) {
    const errText = await runRes.text();
    console.error("[APIFY] Run failed:", runRes.status, errText);
    throw new Error(`Apify run failed: ${runRes.status}`);
  }
  const runData = await runRes.json();
  const runId = runData?.data?.id;
  console.log("[APIFY] Run started, ID:", runId);
  let status = runData?.data?.status;
  let attempts = 0;
  while (status !== "SUCCEEDED" && status !== "FAILED" && status !== "ABORTED" && attempts < 40) {
    await new Promise((r) => setTimeout(r, 3e3));
    const pollRes = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`
    );
    const pollData = await pollRes.json();
    status = pollData?.data?.status;
    attempts++;
    console.log("[APIFY] Poll attempt", attempts, "- status:", status);
  }
  if (status !== "SUCCEEDED") {
    throw new Error(`Apify run did not succeed: ${status}`);
  }
  const datasetId = runData?.data?.defaultDatasetId;
  const itemsRes = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}`
  );
  const items = await itemsRes.json();
  console.log("[APIFY] Got", Array.isArray(items) ? items.length : 0, "profile(s)");
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("No profile data returned from Apify");
  }
  return items[0];
}
async function analyzeWithClaude(profileData) {
  const name = profileData.fullName || profileData.firstName + " " + profileData.lastName || "Unknown";
  const headline = profileData.headline || "";
  const summary = profileData.summary || profileData.about || "";
  const location = profileData.location || profileData.addressCountryFull || "";
  const connections = profileData.connectionsCount || profileData.connections || 0;
  const experiences = (profileData.experience || profileData.positions || []).slice(0, 5).map((e) => `- ${e.title || e.role || ""} at ${e.companyName || e.company || ""} (${e.duration || e.timePeriod || ""})`).join("\n");
  const education = (profileData.education || []).slice(0, 3).map((e) => `- ${e.degree || e.degreeName || ""} from ${e.schoolName || e.school || ""}`).join("\n");
  const skills = (profileData.skills || []).slice(0, 15).map((s) => typeof s === "string" ? s : s.name || s.skill || "").filter(Boolean).join(", ");
  const profileText = `
Name: ${name}
Headline: ${headline}
Location: ${location}
Connections: ${connections}
Summary: ${summary}

Experience:
${experiences || "None listed"}

Education:
${education || "None listed"}

Skills: ${skills || "None listed"}
`.trim();
  console.log("[CLAUDE] Sending analysis request, model:", CLAUDE_MODEL);
  console.log("[CLAUDE] Profile text length:", profileText.length);
  const claudeBody = {
    model: CLAUDE_MODEL,
    max_tokens: 2e3,
    messages: [
      {
        role: "user",
        content: `You are an expert LinkedIn profile optimizer specializing in the Saudi/GCC job market. Analyze this LinkedIn profile and return a JSON object with EXACTLY this structure (no markdown, no code blocks, just raw JSON):
{
  "score": <number 0-100>,
  "headlineCurrent": "<current headline>",
  "headlineSuggestion": "<improved headline>",
  "summaryCurrent": "<current summary or 'No summary provided'>",
  "summarySuggestion": "<improved professional summary in 2-3 sentences>",
  "keywords": ["keyword1", "keyword2", ...up to 8 relevant keywords],
  "experienceSuggestions": [{"role": "<role>", "suggestion": "<specific improvement tip>"}],
  "strengths": ["<strength1>", "<strength2>", "<strength3>"],
  "weaknesses": ["<weakness1>", "<weakness2>", "<weakness3>"]
}

Score criteria:
- Photo/banner: +10 if likely present (connections > 100 suggests active profile)
- Headline quality: up to 15 points
- Summary quality: up to 15 points
- Experience detail: up to 20 points
- Skills: up to 10 points
- Education: up to 10 points
- Connections: up to 10 points
- Keywords/SEO: up to 10 points

Profile data:
${profileText}`
      }
    ]
  };
  console.log("[CLAUDE] Request body model:", claudeBody.model);
  const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify(claudeBody)
  });
  if (!claudeRes.ok) {
    const errText = await claudeRes.text();
    console.error("[CLAUDE] API error:", claudeRes.status, errText);
    throw new Error(`Claude API error: ${claudeRes.status} - ${errText}`);
  }
  const claudeData = await claudeRes.json();
  console.log("[CLAUDE] Response received, stop_reason:", claudeData.stop_reason);
  const text = claudeData.content?.[0]?.text || "";
  let jsonStr = text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    jsonStr = jsonMatch[0];
  }
  try {
    const analysis = JSON.parse(jsonStr);
    return analysis;
  } catch (parseErr) {
    console.error("[CLAUDE] Failed to parse JSON response:", text.substring(0, 500));
    throw new Error("Failed to parse Claude analysis response");
  }
}
var linkedinRouter = router({
  analyze: protectedProcedure.input(z.object({ profileUrl: z.string() })).mutation(async ({ input, ctx }) => {
    try {
      console.log("[LINKEDIN] Analyze request for:", input.profileUrl);
      const { data: profile } = await ctx.supabase.from("profiles").select("token_balance").eq("id", ctx.user.id).single();
      console.log("[LINKEDIN] User token balance:", profile?.token_balance);
      if (!profile || profile.token_balance < 5) {
        throw new TRPCError2({
          code: "BAD_REQUEST",
          message: "Insufficient tokens. Need 5 tokens for analysis."
        });
      }
      const profileData = await scrapeLinkedInProfile(input.profileUrl);
      console.log("[LINKEDIN] Profile scraped:", profileData?.fullName || profileData?.firstName);
      const analysis = await analyzeWithClaude(profileData);
      console.log("[LINKEDIN] Analysis score:", analysis?.score);
      const { error: updateError } = await ctx.supabase.from("profiles").update({ token_balance: (profile.token_balance || 0) - 5 }).eq("id", ctx.user.id);
      if (updateError) {
        console.error("[LINKEDIN] Token deduction error:", updateError);
        throw updateError;
      }
      const { error: insertError } = await ctx.supabase.from("linkedin_analyses").insert([
        {
          user_id: ctx.user.id,
          profile_url: input.profileUrl,
          score: analysis.score || 0,
          headline_current: analysis.headlineCurrent || "",
          headline_suggestion: analysis.headlineSuggestion || "",
          summary_current: analysis.summaryCurrent || "",
          summary_suggestion: analysis.summarySuggestion || "",
          keywords_suggestions: analysis.keywords || [],
          experience_suggestions: analysis.experienceSuggestions || []
        }
      ]);
      if (insertError) {
        console.error("[LINKEDIN] Insert error:", insertError);
      }
      return analysis;
    } catch (err) {
      console.error("[LINKEDIN] Error:", err?.message || err);
      if (err instanceof TRPCError2) throw err;
      throw new TRPCError2({
        code: "INTERNAL_SERVER_ERROR",
        message: err?.message || "Failed to analyze LinkedIn profile"
      });
    }
  }),
  history: protectedProcedure.query(async ({ ctx }) => {
    try {
      const { data } = await ctx.supabase.from("linkedin_analyses").select("*").eq("user_id", ctx.user.id).order("created_at", { ascending: false });
      return data || [];
    } catch (err) {
      throw new TRPCError2({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch LinkedIn analysis history"
      });
    }
  })
});

// server/_core/routes/cv.ts
import { z as z2 } from "zod";
import { TRPCError as TRPCError3 } from "@trpc/server";
var callClaudeAPI = async (field) => {
  console.log(`[CLAUDE] Starting API call for field: ${field}`);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[CLAUDE] ANTHROPIC_API_KEY not set");
    throw new TRPCError3({
      code: "INTERNAL_SERVER_ERROR",
      message: "Claude API key not configured"
    });
  }
  const prompt = `You are a professional CV optimizer. Generate a tailored CV version for someone specializing in: ${field}

Return a JSON object with EXACTLY this structure (no markdown, just JSON):
{
  "headline": "A professional headline (max 10 words)",
  "summary": "A 2-3 sentence professional summary tailored to ${field}",
  "skills": ["skill1", "skill2", "skill3", "skill4", "skill5"],
  "experience": [
    {
      "title": "Job title",
      "company": "Company name",
      "duration": "Duration string",
      "description": "1-2 sentence description of relevant achievements"
    }
  ]
}

Make the content specific to ${field} and professional.`;
  try {
    console.log("[CLAUDE] Sending request to api.anthropic.com");
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }]
      })
    });
    console.log(`[CLAUDE] Response status: ${response.status}`);
    if (!response.ok) {
      const errorData = await response.json();
      console.error("[CLAUDE] API error:", errorData);
      throw new TRPCError3({
        code: "INTERNAL_SERVER_ERROR",
        message: `Claude API error: ${errorData.error?.message || "Unknown error"}`
      });
    }
    const data = await response.json();
    console.log("[CLAUDE] Successfully received response");
    const textContent = data.content.find((c) => c.type === "text");
    if (!textContent || !textContent.text) {
      console.error("[CLAUDE] No text content in response");
      throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR", message: "Invalid response format from Claude API" });
    }
    console.log(`[CLAUDE] Parsing JSON response for field: ${field}`);
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[CLAUDE] Could not extract JSON from response");
      throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR", message: "Failed to parse Claude API response" });
    }
    const parsedData = JSON.parse(jsonMatch[0]);
    const versionData = {
      fieldName: field,
      headline: parsedData.headline || "Professional",
      summary: parsedData.summary || "Experienced professional",
      skills: Array.isArray(parsedData.skills) ? parsedData.skills : [],
      experience: Array.isArray(parsedData.experience) ? parsedData.experience : []
    };
    console.log(`[CLAUDE] Successfully parsed CV data for field: ${field}`);
    return versionData;
  } catch (error) {
    console.error(`[CLAUDE] Error calling API for field ${field}:`, error);
    if (error instanceof TRPCError3) throw error;
    throw new TRPCError3({
      code: "INTERNAL_SERVER_ERROR",
      message: error instanceof Error ? error.message : "Failed to call Claude API"
    });
  }
};
var cvRouter = router({
  generate: protectedProcedure.input(z2.object({ fields: z2.array(z2.string()).min(1).max(3) })).mutation(async ({ input, ctx }) => {
    console.log(`[CV] Starting CV generation for user: ${ctx.user.id}`);
    console.log(`[CV] Requested fields: ${input.fields.join(", ")}`);
    try {
      console.log("[CV] Checking token balance");
      const { data: profile, error: selectError } = await ctx.supabase.from("profiles").select("token_balance").eq("id", ctx.user.id).single();
      if (selectError) {
        console.error("[CV] Error fetching profile:", selectError);
        throw selectError;
      }
      if (!profile) {
        throw new TRPCError3({ code: "NOT_FOUND", message: "User profile not found" });
      }
      console.log(`[CV] Current token balance: ${profile.token_balance}`);
      if (profile.token_balance < 10) {
        throw new TRPCError3({ code: "BAD_REQUEST", message: "Insufficient tokens. Need 10 tokens, have " + profile.token_balance });
      }
      console.log(`[CV] Calling Claude API for ${input.fields.length} field(s)`);
      const versions = [];
      for (const field of input.fields) {
        console.log(`[CV] Processing field: ${field}`);
        const versionData = await callClaudeAPI(field);
        versions.push(versionData);
        console.log(`[CV] Successfully generated CV for field: ${field}`);
      }
      console.log("[CV] Deducting 10 tokens from balance");
      const newBalance = (profile.token_balance || 0) - 10;
      const { error: updateError } = await ctx.supabase.from("profiles").update({ token_balance: newBalance }).eq("id", ctx.user.id);
      if (updateError) {
        console.error("[CV] Error updating token balance:", updateError);
        throw updateError;
      }
      console.log(`[CV] Token balance updated to: ${newBalance}`);
      console.log("[CV] Saving CV versions to database");
      for (const version of versions) {
        const { error: insertError } = await ctx.supabase.from("cv_versions").insert([{
          user_id: ctx.user.id,
          field_name: version.fieldName,
          cv_content: version
        }]);
        if (insertError) {
          console.error("[CV] Error saving CV version for field:", version.fieldName, insertError);
        }
      }
      console.log(`[CV] Successfully saved CV versions for user: ${ctx.user.id}`);
      return { versions, tokensRemaining: newBalance };
    } catch (err) {
      console.error("[CV] Mutation error:", err);
      if (err instanceof TRPCError3) throw err;
      throw new TRPCError3({
        code: "INTERNAL_SERVER_ERROR",
        message: err instanceof Error ? err.message : "Failed to generate CV versions"
      });
    }
  }),
  history: protectedProcedure.query(async ({ ctx }) => {
    console.log(`[CV] Fetching history for user: ${ctx.user.id}`);
    try {
      const { data, error } = await ctx.supabase.from("cv_versions").select("*").eq("user_id", ctx.user.id).order("created_at", { ascending: false });
      if (error) {
        console.error("[CV] Error fetching history:", error);
        throw error;
      }
      console.log(`[CV] Found ${(data || []).length} CV versions in history`);
      return data || [];
    } catch (err) {
      console.error("[CV] Query error:", err);
      throw new TRPCError3({
        code: "INTERNAL_SERVER_ERROR",
        message: err instanceof Error ? err.message : "Failed to fetch CV history"
      });
    }
  })
});

// server/_core/routes/campaign.ts
import { z as z3 } from "zod";
import { TRPCError as TRPCError4 } from "@trpc/server";
async function generateEmailsWithClaude(companies, jobTitle, language) {
  console.log("[CAMPAIGN] Starting Claude API email generation for", companies.length, "companies");
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }
  const companiesJson = JSON.stringify(companies);
  const systemPrompt = language === "ar" ? `\u0623\u0646\u062A \u062E\u0628\u064A\u0631 \u062A\u0633\u0648\u064A\u0642 \u0628\u0631\u064A\u062F \u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0645\u062A\u062E\u0635\u0635 \u0641\u064A \u0643\u062A\u0627\u0628\u0629 \u0631\u0633\u0627\u0626\u0644 B2B \u0627\u062D\u062A\u0631\u0627\u0641\u064A\u0629 \u0645\u0648\u062C\u0647\u0629 \u0634\u062E\u0635\u064A\u0627\u064B. 
       \u0627\u0643\u062A\u0628 \u0631\u0633\u0627\u0626\u0644 \u0627\u062D\u062A\u0631\u0627\u0641\u064A\u0629 \u0628\u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u0648\u0627\u0636\u062D\u0629 \u0648\u0645\u0648\u062C\u0632\u0629 \u0648\u0641\u0639\u0627\u0644\u0629.       \u0627\u0644\u0631\u062F \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 JSON \u0641\u0642\u0637 \u0628\u062F\u0648\u0646 \u0623\u064A \u0646\u0635 \u0625\u0636\u0627\u0641\u064A.` : `You are an expert B2B email marketing specialist. Write professional, personalized outreach emails in English.
       Keep emails concise, professional, and engaging.
       Response must be valid JSON only, no additional text.`;
  const userPrompt = language === "ar" ? `\u0623\u0646\u0634\u0626 \u0631\u0633\u0627\u0626\u0644 \u0628\u0631\u064A\u062F \u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0645\u0648\u062C\u0647\u0629 \u0634\u062E\u0635\u064A\u0627\u064B \u0644\u0643\u0644 \u0634\u0631\u0643\u0629 \u0645\u0646 \u0647\u0630\u0647 \u0627\u0644\u0634\u0631\u0643\u0627\u062A:
${companiesJson}

\u0627\u0644\u0645\u0648\u0636\u0648\u0639 \u0627\u0644\u0648\u0638\u064A\u0641\u064A: ${jobTitle}

\u0644\u0643\u0644 \u0634\u0631\u0643\u0629\u060C \u0623\u0646\u0634\u0626:
- subject: \u0633\u0637\u0631 \u0627\u0644\u0645\u0648\u0636\u0648\u0639 (25-50 \u0643\u0644\u0645\u0629 \u0628\u0627\u0644\u0639\u0631\u0628\u064A\u0629)
- body: \u0646\u0635 \u0627\u0644\u0631\u0633\u0627\u0644\u0629 (150-250 \u0643\u0644\u0645\u0629\u060C \u0627\u062D\u062A\u0631\u0627\u0641\u064A\u0629 \u0648\u0645\u0648\u062C\u0647\u0629 \u0644\u0644\u0634\u0631\u0643\u0629)

\u0627\u0644\u0631\u062F JSON:
{
  "CompanyName": {
    "subject": "...",
    "body": "..."
  }
}` : `Generate personalized B2B outreach emails for these companies:
${companiesJson}

Target job title: ${jobTitle}

For each company, create:
- subject: Email subject line (25-50 words)
- body: Email body (150-250 words, professional and company-specific)
Response as JSON only:
{
  "CompanyName": {
    "subject": "...",
    "body": "..."
  }
}`;
  try {
    console.log("[CLAUDE] Calling claude-sonnet-4-6 model");
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: userPrompt
          }
        ]
      })
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[CLAUDE] API error:", response.status, errorText);
      throw new Error(`Claude API error: ${response.status}`);
    }
    const result = await response.json();
    console.log("[CLAUDE] API response received");
    if (!result.content || result.content.length === 0) {
      throw new Error("Empty response from Claude");
    }
    const textContent = result.content[0];
    if (textContent.type !== "text") {
      throw new Error("Unexpected response type from Claude");
    }
    let emailData;
    try {
      let jsonStr = textContent.text;
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }
      emailData = JSON.parse(jsonStr);
      console.log("[CAMPAIGN] Successfully parsed", Object.keys(emailData).length, "emails from Claude");
    } catch (parseErr) {
      console.error("[CAMPAIGN] Failed to parse Claude response:", textContent.text.substring(0, 500));
      throw new Error("Invalid JSON response from Claude");
    }
    const emailMap = /* @__PURE__ */ new Map();
    for (const [company, message] of Object.entries(emailData)) {
      if (message && typeof message === "object" && "subject" in message && "body" in message) {
        emailMap.set(company, {
          subject: String(message.subject),
          body: String(message.body)
        });
      }
    }
    console.log("[CAMPAIGN] Email generation complete:", emailMap.size, "emails generated");
    return emailMap;
  } catch (err) {
    console.error("[CLAUDE] Email generation failed:", err);
    throw err;
  }
}
var campaignRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    try {
      console.log("[CAMPAIGN] Fetching campaigns for user", ctx.user.id);
      const { data } = await ctx.supabase.from("email_campaigns").select("*").eq("user_id", ctx.user.id).order("created_at", { ascending: false });
      console.log("[CAMPAIGN] Found", data?.length || 0, "campaigns");
      return data || [];
    } catch (err) {
      console.error("[CAMPAIGN] List error:", err);
      throw new TRPCError4({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch campaigns"
      });
    }
  }),
  get: protectedProcedure.input(z3.object({ id: z3.string().uuid() })).query(async ({ input, ctx }) => {
    try {
      console.log("[CAMPAIGN] Fetching campaign", input.id);
      const { data: campaign } = await ctx.supabase.from("email_campaigns").select("*").eq("id", input.id).eq("user_id", ctx.user.id).single();
      if (!campaign) {
        throw new TRPCError4({
          code: "NOT_FOUND",
          message: "Campaign not found"
        });
      }
      const { data: recipients } = await ctx.supabase.from("email_recipients").select("*").eq("campaign_id", input.id);
      console.log("[CAMPAIGN] Fetched campaign with", recipients?.length || 0, "recipients");
      return { campaign, recipients: recipients || [] };
    } catch (err) {
      if (err instanceof TRPCError4) throw err;
      console.error("[CAMPAIGN] Get error:", err);
      throw new TRPCError4({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch campaign"
      });
    }
  }),
  create: protectedProcedure.input(
    z3.object({
      campaignName: z3.string().min(1),
      jobTitle: z3.string().min(1),
      targetCompanies: z3.array(z3.string()).min(1),
      recipientCount: z3.number().int().positive().max(20),
      language: z3.enum(["ar", "en"])
    })
  ).mutation(async ({ input, ctx }) => {
    try {
      console.log("[CAMPAIGN] Creating campaign:", input.campaignName);
      console.log("[CAMPAIGN] User ID:", ctx.user.id);
      console.log("[CAMPAIGN] Input:", JSON.stringify(input));
      if (input.recipientCount > 20) {
        throw new TRPCError4({
          code: "BAD_REQUEST",
          message: "Maximum 20 recipients per campaign"
        });
      }
      console.log("[CAMPAIGN] Step 1: Checking token balance");
      const { data: profile, error: profileError } = await ctx.supabase.from("profiles").select("token_balance").eq("id", ctx.user.id).single();
      if (profileError) {
        console.error("[CAMPAIGN] Profile fetch error:", profileError);
        throw new TRPCError4({
          code: "BAD_REQUEST",
          message: `Profile error: ${profileError.message}`
        });
      }
      const tokensNeeded = input.recipientCount;
      if (!profile || profile.token_balance < tokensNeeded) {
        console.log("[CAMPAIGN] Insufficient tokens:", profile?.token_balance || 0, "needed:", tokensNeeded);
        throw new TRPCError4({
          code: "BAD_REQUEST",
          message: "Insufficient tokens"
        });
      }
      console.log("[CAMPAIGN] Step 2: Token balance OK:", profile.token_balance);
      console.log("[CAMPAIGN] Step 3: Inserting campaign into DB");
      const { data: campaign, error: createError } = await ctx.supabase.from("email_campaigns").insert([
        {
          user_id: ctx.user.id,
          campaign_name: input.campaignName,
          job_title: input.jobTitle,
          target_companies: input.targetCompanies,
          status: "draft",
          total_recipients: input.recipientCount
        }
      ]).select().single();
      if (createError || !campaign) {
        console.error("[CAMPAIGN] Campaign creation failed:", JSON.stringify(createError));
        throw new TRPCError4({
          code: "INTERNAL_SERVER_ERROR",
          message: `DB insert failed: ${createError?.message || "No data returned"}`
        });
      }
      console.log("[CAMPAIGN] Step 4: Campaign created with ID:", campaign.id);
      let emailMap;
      try {
        console.log("[CAMPAIGN] Step 5: Calling Claude API");
        emailMap = await generateEmailsWithClaude(
          input.targetCompanies,
          input.jobTitle,
          input.language
        );
        console.log("[CAMPAIGN] Step 6: Claude returned", emailMap.size, "emails");
      } catch (claudeErr) {
        console.error("[CAMPAIGN] Claude API call failed:", claudeErr?.message);
        await ctx.supabase.from("email_campaigns").delete().eq("id", campaign.id);
        throw new TRPCError4({
          code: "INTERNAL_SERVER_ERROR",
          message: `Claude failed: ${claudeErr?.message || "Unknown"}`
        });
      }
      const recipients = [];
      for (let i = 0; i < input.recipientCount; i++) {
        const company = input.targetCompanies[i % input.targetCompanies.length];
        const email = emailMap.get(company);
        if (email) {
          recipients.push({
            campaign_id: campaign.id,
            full_name: `${company} - ${input.jobTitle}`,
            company,
            email: `contact@${company.toLowerCase().replace(/\s+/g, "-")}.com`,
            job_title: input.jobTitle,
            status: "pending",
            email_body: `Subject: ${email.subject}

${email.body}`
          });
        }
      }
      console.log("[CAMPAIGN] Step 7: Generated", recipients.length, "recipient records");
      if (recipients.length > 0) {
        const { error: insertError } = await ctx.supabase.from("email_recipients").insert(recipients);
        if (insertError) {
          console.error("[CAMPAIGN] Failed to insert recipients:", JSON.stringify(insertError));
          await ctx.supabase.from("email_campaigns").delete().eq("id", campaign.id);
          throw new TRPCError4({
            code: "INTERNAL_SERVER_ERROR",
            message: `Recipients insert failed: ${insertError.message}`
          });
        }
      }
      console.log("[CAMPAIGN] Step 8: Recipients inserted");
      const { error: updateError } = await ctx.supabase.from("email_campaigns").update({ status: "completed" }).eq("id", campaign.id);
      if (updateError) {
        console.error("[CAMPAIGN] Failed to update campaign status:", updateError);
        throw new TRPCError4({
          code: "INTERNAL_SERVER_ERROR",
          message: `Status update failed: ${updateError.message}`
        });
      }
      console.log("[CAMPAIGN] Step 9: Status updated to completed");
      const { error: deductError } = await ctx.supabase.from("profiles").update({ token_balance: (profile.token_balance || 0) - tokensNeeded }).eq("id", ctx.user.id);
      if (deductError) {
        console.error("[CAMPAIGN] Failed to deduct tokens:", deductError);
        throw new TRPCError4({
          code: "INTERNAL_SERVER_ERROR",
          message: `Token deduction failed: ${deductError.message}`
        });
      }
      console.log("[CAMPAIGN] Step 10: Tokens deducted. Campaign complete!");
      return campaign;
    } catch (err) {
      if (err instanceof TRPCError4) throw err;
      console.error("[CAMPAIGN] Create error:", err);
      throw new TRPCError4({
        code: "INTERNAL_SERVER_ERROR",
        message: `Campaign error: ${err?.message || err?.code || JSON.stringify(err)?.substring(0, 300) || "Unknown"}`
      });
    }
  })
});

// server/_core/routes/tokens.ts
import { z as z4 } from "zod";
import { TRPCError as TRPCError5 } from "@trpc/server";
var tokenRouter = router({
  balance: protectedProcedure.query(async ({ ctx }) => {
    try {
      const { data: profile } = await ctx.supabase.from("profiles").select("token_balance").eq("id", ctx.user.id).single();
      return { balance: profile?.token_balance || 0 };
    } catch (err) {
      throw new TRPCError5({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch token balance"
      });
    }
  }),
  history: protectedProcedure.query(async ({ ctx }) => {
    try {
      const { data } = await ctx.supabase.from("token_transactions").select("*").eq("user_id", ctx.user.id).order("created_at", { ascending: false });
      return data || [];
    } catch (err) {
      throw new TRPCError5({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch transaction history"
      });
    }
  }),
  spend: protectedProcedure.input(
    z4.object({
      amount: z4.number().int().positive(),
      description: z4.string().min(1)
    })
  ).mutation(async ({ input, ctx }) => {
    try {
      const { data: profile } = await ctx.supabase.from("profiles").select("token_balance").eq("id", ctx.user.id).single();
      if (!profile || profile.token_balance < input.amount) {
        throw new TRPCError5({
          code: "BAD_REQUEST",
          message: "Insufficient tokens"
        });
      }
      const { error: updateError } = await ctx.supabase.from("profiles").update({ token_balance: (profile.token_balance || 0) - input.amount }).eq("id", ctx.user.id);
      if (updateError) throw updateError;
      const { error: transError } = await ctx.supabase.from("token_transactions").insert([
        {
          user_id: ctx.user.id,
          type: "spend",
          amount: -input.amount,
          description: input.description
        }
      ]);
      if (transError) throw transError;
      return { success: true };
    } catch (err) {
      if (err instanceof TRPCError5) throw err;
      throw new TRPCError5({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to spend tokens"
      });
    }
  })
});

// server/_core/routes/admin.ts
import { z as z5 } from "zod";
import { TRPCError as TRPCError6 } from "@trpc/server";
var adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  try {
    const { data: profile } = await ctx.supabase.from("profiles").select("is_admin").eq("id", ctx.user.id).single();
    if (!profile?.is_admin) {
      throw new TRPCError6({
        code: "FORBIDDEN",
        message: "Admin access required"
      });
    }
    return next({ ctx });
  } catch (err) {
    if (err instanceof TRPCError6) throw err;
    throw new TRPCError6({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to verify admin status"
    });
  }
});
var adminRouter = router({
  stats: adminProcedure.query(async ({ ctx }) => {
    try {
      const { data: users } = await ctx.supabase.from("profiles").select("id, created_at, plan");
      const sevenDaysAgo = /* @__PURE__ */ new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const activeUsers = users?.filter(
        (u) => new Date(u.created_at) > sevenDaysAgo
      ).length || 0;
      const { data: campaigns } = await ctx.supabase.from("email_campaigns").select("id, emails_sent");
      const emailsSent = campaigns?.reduce((sum, c) => sum + (c.emails_sent || 0), 0) || 0;
      const { data: transactions } = await ctx.supabase.from("token_transactions").select("amount").eq("type", "purchase");
      const tokensPurchased = transactions?.reduce((sum, t2) => sum + Math.max(0, t2.amount || 0), 0) || 0;
      const planPrices = { free: 0, starter: 99, pro: 199, elite: 299 };
      const mrr = users?.reduce(
        (sum, u) => sum + (planPrices[u.plan] || 0),
        0
      ) || 0;
      return {
        totalUsers: users?.length || 0,
        activeUsers,
        totalCampaigns: campaigns?.length || 0,
        emailsSent,
        tokensPurchased,
        mrr
      };
    } catch (err) {
      throw new TRPCError6({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch stats"
      });
    }
  }),
  users: adminProcedure.query(async ({ ctx }) => {
    try {
      const { data } = await ctx.supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(50);
      return data || [];
    } catch (err) {
      throw new TRPCError6({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch users"
      });
    }
  }),
  addTokens: adminProcedure.input(
    z5.object({
      userId: z5.string().uuid(),
      amount: z5.number().int().positive(),
      reason: z5.string().min(1)
    })
  ).mutation(async ({ input, ctx }) => {
    try {
      const { data: profile } = await ctx.supabase.from("profiles").select("token_balance").eq("id", input.userId).single();
      if (!profile) {
        throw new TRPCError6({
          code: "NOT_FOUND",
          message: "User not found"
        });
      }
      const { error: updateError } = await ctx.supabase.from("profiles").update({
        token_balance: (profile.token_balance || 0) + input.amount
      }).eq("id", input.userId);
      if (updateError) throw updateError;
      const { error: transError } = await ctx.supabase.from("token_transactions").insert([
        {
          user_id: input.userId,
          type: "admin_add",
          amount: input.amount,
          description: input.reason
        }
      ]);
      if (transError) throw transError;
      return { success: true };
    } catch (err) {
      if (err instanceof TRPCError6) throw err;
      throw new TRPCError6({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to add tokens"
      });
    }
  }),
  toggleBan: adminProcedure.input(z5.object({ userId: z5.string().uuid() })).mutation(async ({ input, ctx }) => {
    try {
      const { data: profile } = await ctx.supabase.from("profiles").select("is_banned").eq("id", input.userId).single();
      if (!profile) {
        throw new TRPCError6({
          code: "NOT_FOUND",
          message: "User not found"
        });
      }
      const { error } = await ctx.supabase.from("profiles").update({ is_banned: !profile.is_banned }).eq("id", input.userId);
      if (error) throw error;
      return { success: true, banned: !profile.is_banned };
    } catch (err) {
      if (err instanceof TRPCError6) throw err;
      throw new TRPCError6({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to toggle ban"
      });
    }
  }),
  campaigns: adminProcedure.query(async ({ ctx }) => {
    try {
      const { data: campaigns } = await ctx.supabase.from("email_campaigns").select("*").order("created_at", { ascending: false });
      if (!campaigns || campaigns.length === 0) return [];
      const userIds = Array.from(new Set(campaigns.map((c) => c.user_id).filter(Boolean)));
      const { data: profiles } = await ctx.supabase.from("profiles").select("id, full_name, email").in("id", userIds);
      const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
      return campaigns.map((c) => ({
        ...c,
        profiles: profileMap.get(c.user_id) || null
      }));
    } catch (err) {
      throw new TRPCError6({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch campaigns"
      });
    }
  }),
  updateSettings: adminProcedure.input(
    z5.object({
      key: z5.string().min(1),
      value: z5.any()
    })
  ).mutation(async ({ input, ctx }) => {
    try {
      const { data: existing } = await ctx.supabase.from("system_settings").select("id").eq("key", input.key).maybeSingle();
      if (existing?.id) {
        const { error } = await ctx.supabase.from("system_settings").update({ value: input.value, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await ctx.supabase.from("system_settings").insert([{ key: input.key, value: input.value }]);
        if (error) throw error;
      }
      return { success: true };
    } catch (err) {
      throw new TRPCError6({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to update settings"
      });
    }
  })
});

// server/_core/trpc.ts
var appRouter = router({
  health: publicProcedure.query(async () => {
    return {
      status: "ok",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
  }),
  auth: router({
    profile: protectedProcedure.query(async ({ ctx }) => {
      const { data, error } = await ctx.supabase.from("profiles").select("*").eq("id", ctx.user.id).single();
      if (error) throw new TRPCError7({ code: "NOT_FOUND" });
      return data;
    })
  }),
  linkedin: linkedinRouter,
  cv: cvRouter,
  campaign: campaignRouter,
  token: tokenRouter,
  admin: adminRouter
});

// server/_core/context.ts
import { createClient } from "@supabase/supabase-js";
var supabaseUrl = process.env.VITE_SUPABASE_URL || "https://hiqotmimlgsrsnovtopd.supabase.co";
var supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
var supabase = createClient(supabaseUrl, supabaseServiceKey);
async function createContext({ req }) {
  let user = null;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      const {
        data: { user: authUser }
      } = await supabase.auth.getUser(token);
      user = authUser;
    } catch (err) {
      console.error("Token verification failed:", err);
    }
  }
  return {
    user,
    supabase
  };
}

// server/_core/vercel.ts
var app = express();
app.use(cors({
  origin: process.env.NODE_ENV === "production" ? [
    "https://wassel.vercel.app",
    "https://wassel-alpha.vercel.app",
    "https://wassel-waselhupsas-projects.vercel.app",
    "https://wassel-git-master-waselhupsas-projects.vercel.app",
    "https://wassel.sa"
  ] : "http://localhost:5173",
  credentials: true
}));
app.use(express.json());
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    version: "2.0.0"
  });
});
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext
  })
);
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});
module.exports = (req, res) => {
  return app(req, res);
};
