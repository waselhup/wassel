import Queue from 'bull';
import { config } from './config.js';

export const automationQueue = new Queue('linkedin-automation', config.redisUrl, {
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 60000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

automationQueue.on('error', (err) => {
  console.error('[Queue] Error:', err.message);
});

automationQueue.on('failed', (job, err) => {
  console.error(`[Queue] Job ${job.id} failed:`, err.message);
});

automationQueue.on('completed', (job, result) => {
  console.log(`[Queue] Job ${job.id} completed:`, result?.ok ? 'OK' : result?.error);
});
