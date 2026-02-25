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

2. Set up your OpenAI API key:
   - Get your API key from: https://platform.openai.com/api-keys
   - Add it to [.env.local](.env.local):
     ```bash
     OPENAI_API_KEY=your-openai-api-key-here
     VITE_OPENAI_API_KEY=your-openai-api-key-here
     OPENAI_MODEL=gpt-4o
     VITE_OPENAI_MODEL=gpt-4o
     ```

3. Run the app:
   ```bash
   npm run dev
   ```

## AI Features

All AI features now use **OpenAI API** for consistent, reliable responses:
- Timeline organization and chronology cleanup
- Clinical notes refinement
- Medical-legal report generation
- Research gap analysis
- Deposition coaching
- Admin intelligence
