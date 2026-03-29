# Wassel Development Workflow

## Branches
- `master` → Production (wassel-alpha.vercel.app)
- `staging` → Staging (wassel-staging.vercel.app)

## How to use

### Working on new features:

1. Create feature branch from staging:
   ```bash
   git checkout staging
   git checkout -b feature/my-feature
   ```

2. Build and test locally

3. Merge to staging for testing:
   ```bash
   git checkout staging
   git merge feature/my-feature
   git push origin staging
   ```
   → Auto-deploys to wassel-staging.vercel.app

4. Test on staging URL

5. When happy, merge to master:
   ```bash
   git checkout master
   git merge staging
   git push origin master
   ```
   → Auto-deploys to wassel-alpha.vercel.app (PRODUCTION)

## Quick commands
```bash
npm run deploy:staging      # Push to staging
npm run deploy:production   # Push to production
npm run branch:feature --name=my-feature  # Create feature branch
```

## Build commands
```bash
# Server
npx esbuild server/_core/vercel.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/api/index.js

# Client
npx vite build
```

## Vercel Setup for Staging
See instructions in README or run:
```
vercel --prod false --token YOUR_TOKEN
```
