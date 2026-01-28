
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function listModels() {
    const envPath = path.join(__dirname, '.env.local');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/GEMINI_API_KEY=(.*)/);
    const apiKey = match ? match[1].trim() : null;

    const genAI = new GoogleGenerativeAI(apiKey);

    try {
        // There isn't a direct listModels in the client SDK usually, 
        // it's usually via a specific endpoint or just trying models.
        // But we can try the most common ones.
        const models = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash-exp", "gemini-2.0-flash"];

        for (const modelName of models) {
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent("test");
                console.log(`✅ Model ${modelName} is working!`);
                break;
            } catch (e) {
                console.log(`❌ Model ${modelName} failed: ${e.message}`);
            }
        }
    } catch (error) {
        console.error("General error:", error);
    }
}

listModels();
