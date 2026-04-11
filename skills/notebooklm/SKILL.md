# NotebookLM Integration for Wassel

## Overview
NotebookLM (notebooklm.google.com) is Google's AI-powered research tool.
Wassel integrates with it by exporting user data as structured JSON that
can be uploaded to NotebookLM as a source document.

## How It Works
1. User clicks "Export for NotebookLM" on /app/knowledge page
2. Wassel exports all user data: LinkedIn analyses, campaign results, CV versions, market insights
3. User uploads the JSON file to NotebookLM
4. User can then ask NotebookLM questions about their data

## What Gets Exported
- LinkedIn profile analyses (scores, suggestions, keywords)
- Campaign results (messages sent, open rates, replies)
- CV versions (tailored content for different roles)
- Knowledge items (user-saved insights)
- Saudi market tips (curated LinkedIn best practices for GCC)

## Documents to Upload to NotebookLM
For best results, upload these alongside your Wassel export:
1. Your exported wassel-knowledge-YYYY-MM-DD.json file
2. Saudi job market reports from Jadarat or HRSD
3. Your company's LinkedIn page analytics export
4. Industry-specific salary surveys from GulfTalent or Bayt
5. Vision 2030 sector-specific strategy documents

## Using Insights in Wassel
After querying NotebookLM, save useful insights back to Wassel:
- Go to /app/knowledge
- The insights will improve future AI-generated content
- Campaign messages will be more targeted
- LinkedIn suggestions will be more market-relevant

## API Endpoint
POST /api/trpc/knowledge.export — returns all user data as JSON
POST /api/trpc/knowledge.save — saves an insight to the knowledge base
GET /api/trpc/knowledge.list — lists all saved knowledge items

## Database Table
knowledge_items: id, user_id, type, title, content (jsonb), tags, created_at
Types: linkedin_analysis, campaign_result, market_insight
RLS: users can only access their own items
