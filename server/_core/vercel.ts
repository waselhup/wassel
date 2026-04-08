import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { appRouter } from './trpc';
import { createContext } from './context';

const app: Express = express();

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? [
        'https://wassel.vercel.app',
        'https://wassel-alpha.vercel.app',
        'https://wassel-waselhupsas-projects.vercel.app',
        'https://wassel-git-master-waselhupsas-projects.vercel.app',
        'https://wassel.sa',
      ]
    : 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json());

app.get('/api/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '2.0.0',
  });
});

app.use(
  '/api/trpc',
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Vercel serverless handler
export default app;
