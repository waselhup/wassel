# Wassel Extension Changelog

## v1.1.6 — 2026-03-20
- Fixed: activity log token retrieval and POST reliability
- Files modified: background.js


## v1.1.5 — 2026-03-20
- Added activity log reporting after each action execution
- Files modified: background.js


## v1.1.4 — 2026-03-20
- New icon: custom illustrated avatar. Fixed infinite loading on dashboard redirect. Added 8s timeout fallback in popup.
- Files modified: manifest.json, popup.html, popup.js, background.js, icons/*


## v1.1.3 — 2026-03-20
- Fixed Could not establish connection - Receiving end does not exist. Added safeSendMessage wrapper, PING health check, and programmatic content script injection.
- Files modified: background.js, content.js, manifest.json


## v1.1.2 — 2026-03-20
- Fixed Not authenticated import error - added postMessage token bridge from web app to extension. Fixed No prospects found - replaced single-selector extractProspects with 5-strategy fallback
- Files modified: background.js, content.js, popup.js, manifest.json, AuthContext.tsx


## v1.1.1 — 2026-03-20
- Fixed ERR_FILE_NOT_FOUND in campaign execution - added URL validation/normalization, removed non-existent sidebar.html from manifest, added version banner
- Files modified: background.js, content.js, manifest.json, popup.html, popup.js

