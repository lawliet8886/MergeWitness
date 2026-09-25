# MergeWitness working agreement

- This is the IBM Bob 2.0 hackathon implementation repository for Signal Foundry. Keep it separate from `IBMBob2026` preparation and all neighboring projects.
- Use only synthetic fixtures and newly authored code. Record any reused template or dependency with its source and license in the README.
- Preserve a working public demo, reproducible CLI evidence, a short presentation, and submission material. Do not claim Bob performed work unless its real task/session evidence exists.
- For every relevant IBM Bob IDE task, save its consumption-summary screenshot as PNG under the exact `bob_sessions/` directory. Record task goal, input commit, outputs, validation, and output commit.
- Never commit secrets, private account information, unrelated personal data, or raw authentication state. Preserve source and evidence hashes.
- Core/MCP owner works under `src/core`, `src/cli`, `src/mcp`, `fixtures`, and `tests`. UI owner works under `web`. Root agent owns repository configuration, integration, Bob IDE, evidence, docs, and submission. Coordinate shared files before editing.
- Treat the fixture code as trusted input only. A fresh process or worker is not a security sandbox for arbitrary repositories.
