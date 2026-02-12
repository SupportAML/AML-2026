<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# ApexMedLaw - Medical-Legal Platform

A comprehensive medical-legal platform with AI-powered features for case management, document analysis, and report generation.

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up your Claude API key:
   - Get your API key from: https://console.anthropic.com/settings/keys
   - Add it to [.env.local](.env.local):
     ```bash
     CLAUDE_API_KEY=your-claude-api-key-here
     VITE_CLAUDE_API_KEY=your-claude-api-key-here
     ```

3. Run the app:
   ```bash
   npm run dev
   ```

## AI Features

All AI features now use **Claude API** for consistent, reliable responses:
- Timeline organization and chronology cleanup
- Clinical notes refinement
- Medical-legal report generation
- Research gap analysis
- Deposition coaching
- Admin intelligence

See [CLAUDE_MIGRATION.md](CLAUDE_MIGRATION.md) for detailed migration information.

