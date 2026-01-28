
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testRefine() {
    console.log("🚀 Starting AI Refinement Test...");

    // 1. Load API key from .env.local
    const envPath = path.join(__dirname, '.env.local');
    if (!fs.existsSync(envPath)) {
        console.error("❌ .env.local not found!");
        return;
    }

    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/GEMINI_API_KEY=(.*)/);
    const apiKey = match ? match[1].trim() : null;

    if (!apiKey || apiKey === 'your_actual_api_key_here' || apiKey === '') {
        console.error("❌ Valid API key not found in .env.local. Please ensure GEMINI_API_KEY is set correctly.");
        return;
    }

    console.log("✅ API Key found (matches pattern)");

    // 2. Initialize Gemini
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        generationConfig: {
            responseMimeType: "application/json",
        }
    });

    const rawText = "patient has fever on jan 20";
    const prompt = `
    TASK: Refine the clinical observation into an authoritative medical-legal statement and strictly extract any mentioned dates/times.
    Today's year is 2026.
    
    RAW INPUT: "${rawText}"
    
    RETURN JSON with:
    {
      "refinedText": "Professional version",
      "extractedDate": "YYYY-MM-DD",
      "extractedTime": "HH:mm or null"
    }
  `;

    try {
        console.log(`📝 Testing with input: "${rawText}"`);
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        console.log("\n✨ AI RESPONSE:");
        console.log(JSON.parse(text));
        console.log("\n✅ SUCCESS: The AI service is integrated and responding correctly!");
    } catch (error) {
        console.error("\n❌ AI ERROR:", error.message);
        if (error.message.includes("API_KEY_INVALID")) {
            console.error("The API key provided is invalid. Please double-check it.");
        }
    }
}

testRefine();
