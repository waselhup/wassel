import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { automationQueue } from './queue.js';
import './worker.js'; // Start the worker

const app = express();
app.use(cors());
app.use(express.json());

// Auth middleware — shared secret for server-to-server calls
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!config.automationApiKey) {
    // No key configured — allow all (dev mode)
    return next();
  }
  if (auth !== `Bearer ${config.automationApiKey}`) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  next();
}

// POST /jobs/enqueue — Add a job to the queue
app.post('/jobs/enqueue', authMiddleware, async (req, res) => {
  try {
    const { type, userId, teamId, prospectStepId, linkedinUrl, name, message, campaignId } = req.body;

    if (!type || !userId || !linkedinUrl) {
      return res.status(400).json({ error: 'type, userId, and linkedinUrl are required' });
    }

    const job = await automationQueue.add('linkedin-action', {
      type,
      userId,
      teamId,
      prospectStepId,
      linkedinUrl,
      name: name || '',
      message: message || '',
      campaignId,
    }, {
      delay: Math.floor(Math.random() * 5000) + 2000, // 2-7s random delay
    });

    res.json({ success: true, jobId: job.id });
  } catch (err) {
    console.error('[API] Enqueue error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /jobs/campaign — Bulk enqueue for campaign launch
app.post('/jobs/campaign', authMiddleware, async (req, res) => {
  try {
    const { jobs } = req.body;
    if (!Array.isArray(jobs) || jobs.length === 0) {
      return res.status(400).json({ error: 'jobs array required' });
    }

    let queued = 0;
    for (let i = 0; i < jobs.length; i++) {
      const j = jobs[i];
      await automationQueue.add('linkedin-action', j, {
        delay: (i * 60000) + Math.floor(Math.random() * 10000) + 2000, // stagger by ~1 min each
      });
      queued++;
    }

    res.json({ success: true, queued });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /jobs/status/:id — Check job status
app.get('/jobs/status/:id', authMiddleware, async (req, res) => {
  try {
    const job = await automationQueue.getJob(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const state = await job.getState();
    res.json({
      id: job.id,
      state,
      data: job.data,
      progress: job.progress(),
      returnvalue: job.returnvalue,
      failedReason: job.failedReason,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /queue/status — Queue overview
app.get('/queue/status', authMiddleware, async (req, res) => {
  const waiting = await automationQueue.getWaitingCount();
  const active = await automationQueue.getActiveCount();
  const completed = await automationQueue.getCompletedCount();
  const failed = await automationQueue.getFailedCount();
  const delayed = await automationQueue.getDelayedCount();
  res.json({ waiting, active, completed, failed, delayed });
});

// GET /health — Health check
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'wassel-automation', timestamp: new Date().toISOString() });
});

app.listen(config.port, () => {
  console.log(`[Wassel Automation] Running on port ${config.port}`);
});
