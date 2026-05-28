// Pure ID → static asset URL mapping for War Room agent portraits.
//
// The SVG files are pre-generated at build time by:
//   node scripts/build-agent-avatars.mjs
//
// They live in client/public/agents/*.svg and are served as static
// assets — keeping @dicebear out of the runtime bundle (saves ~120 KB
// gzipped from the WarRoom chunk).
//
// To re-generate (e.g. when tweaking personalities): run the script
// above and commit the resulting .svg files alongside the change.

export type AgentId =
  | 'faris'
  | 'sayed'
  | 'al_mukhadram'
  | 'hassan'
  | 'fatima'
  | 'dhai'
  | 'hussein'
  | 'mohammed';

const AGENT_IDS: AgentId[] = [
  'faris', 'sayed', 'al_mukhadram', 'hassan',
  'fatima', 'dhai', 'hussein', 'mohammed',
];

export function isAgentId(s: string): s is AgentId {
  return (AGENT_IDS as string[]).includes(s);
}

/** URL to the agent's static SVG portrait. */
export function getAgentAvatarUrl(agentId: AgentId): string {
  return `/agents/${agentId}.svg`;
}
