
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { Annotation, Case, Document, ChatMessage, StrategyAnalysis, StructuredChronology, DepoFeedback } from "../types";

// Initialize the API with the key defined in vite.config.ts via process.env.API_KEY
const API_KEY = process.env.API_KEY || "";

// Log API key status (first 10 chars only for security)
if (!API_KEY) {
  console.error("❌ GEMINI API KEY IS MISSING! Check your .env.local file.");
} else {
  // console.log("✅ Gemini API Key loaded:", API_KEY.substring(0, 10) + "...");
}

const genAI = new GoogleGenerativeAI(API_KEY);

/**
 * Helper to get a model instance
 */
const getModel = (modelName: string = "gemini-2.0-flash", systemInstruction?: string) => {
  return genAI.getGenerativeModel({
    model: modelName,
    systemInstruction
  });
};

/**
 * Analyze document metadata for legal relevance.
 */
export const analyzeDocument = async (doc: Document) => {
  try {
    const model = getModel();
    const result = await model.generateContent(`Analyze this document metadata for legal relevance: ${JSON.stringify(doc)}`);
    return result.response.text() || "Analysis failed.";
  } catch (e) {
    console.error("analyzeDocument error:", e);
    return "Analysis failed.";
  }
};

/**
 * Draft a professional medical-legal report.
 */
export const draftMedicalLegalReport = async (
  caseData: Case,
  docs: Document[],
  annotations: Annotation[],
  additionalContext: string = '',
  qualifications: string = ''
): Promise<string> => {
  const model = getModel("gemini-2.0-flash", "You are a Physician Expert drafting a formal Medical-Legal Report. Your tone is authoritative, clinical, and precise.");

  // Group annotations by category
  const groupedAnnotations = annotations.reduce((acc, ann) => {
    const key = ann.documentId === 'research-notes' ? 'Research' : 'Medical Records';
    if (!acc[key]) acc[key] = [];
    acc[key].push(`- [${ann.category}] ${ann.text} ${ann.eventDate ? `(Date: ${ann.eventDate})` : ''}`);
    return acc;
  }, {} as Record<string, string[]>);

  // Create a comprehensive prompt
  const prompt = `
You are drafting a professional Medical-Legal Report for litigation purposes.

**CASE INFORMATION:**
- Title: "${caseData.title}"
- Description: ${caseData.description || 'No description provided'}

**EXPERT CREDENTIALS:**
${qualifications || 'Medical Expert'}

**DOCUMENTS REVIEWED:**
${docs.map((d, i) => `${i + 1}. ${d.name}`).join('\n') || 'No documents listed'}

**CLINICAL EVIDENCE:**
${Object.entries(groupedAnnotations).map(([category, items]) =>
    `\n### ${category}\n${items.join('\n')}`
  ).join('\n') || 'No annotations available'}

**ADDITIONAL CONTEXT:**
${additionalContext || 'None provided'}

---

**TASK:** Generate a complete, professional Medical-Legal Report.

If a template is provided below, follow its structure exactly. If not, use the standard professional format.

**REPORT STRUCTURE/TEMPLATE:**
${caseData.reportTemplate || `
1. HEADER: Case name, date, and expert identification.
2. INTRODUCTION: Brief case overview and purpose of the report.
3. DOCUMENTS REVIEWED: Detailed list of all materials examined.
4. PATIENT HISTORY & TIMELINE: Chronological clinical summary.
5. MEDICAL ANALYSIS: Clinical findings, standard of care, and causation.
6. PROFESSIONAL OPINION: Final conclusions and recommendations.
`}

Format the report professionally with proper sections and clinical terminology.
`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    if (!text || text.trim() === '') {
      console.error("Empty response from Gemini API");
      return "Error: Received empty response from AI. Please try again.";
    }
    return text;
  } catch (error: any) {
    console.error("draftMedicalLegalReport error:", error);
    console.error("Error details:", {
      message: error?.message,
      status: error?.status,
      statusText: error?.statusText
    });

    // Provide more specific error messages
    if (error?.message?.includes('API key')) {
      return "Error: Invalid API key. Please check your configuration.";
    }
    if (error?.message?.includes('quota')) {
      return "Error: API quota exceeded. Please try again later.";
    }
    if (error?.status === 429) {
      return "Error: Too many requests. Please wait a moment and try again.";
    }

    return `Error: Unable to generate report. ${error?.message || 'Unknown error'}`;
  }
};

/**
 * Organizes annotations into a structured timeline.
 */
export const cleanupChronology = async (annotations: Annotation[], userNotes: string = ''): Promise<StructuredChronology | null> => {
  const schema = {
    type: SchemaType.OBJECT,
    properties: {
      years: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            year: { type: SchemaType.STRING },
            months: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  month: { type: SchemaType.STRING },
                  events: {
                    type: SchemaType.ARRAY,
                    items: {
                      type: SchemaType.OBJECT,
                      properties: {
                        id: { type: SchemaType.STRING },
                        date: { type: SchemaType.STRING },
                        formattedText: { type: SchemaType.STRING }
                      },
                      required: ["id", "date", "formattedText"]
                    }
                  }
                },
                required: ["month", "events"]
              }
            }
          },
          required: ["year", "months"]
        }
      },
      irrelevantFacts: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            id: { type: SchemaType.STRING },
            date: { type: SchemaType.STRING },
            formattedText: { type: SchemaType.STRING }
          },
          required: ["id", "date", "formattedText"]
        }
      }
    },
    required: ["years", "irrelevantFacts"]
  };

  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: schema as any
    }
  });

  const input = annotations.filter(a => a.eventDate).map(a => ({
    id: a.id,
    text: a.text,
    date: a.eventDate
  }));

  const prompt = `
    TASK: Organize the provided medical data into a structured chronology.
    DATA: ANNOTATIONS: ${JSON.stringify(input)} NOTES: "${userNotes}"
    
    INSTRUCTIONS:
    1. PRESERVE IDs: For every event derived from the ANNOTATIONS list, you MUST use its original "id". This is critical for document linking.
    2. NEW IDs: For any new facts extracted solely from the "NOTES", assign them a new unique string ID (e.g., "manual-01").
    3. FORMAT: Each event's formattedText should be professional and clinical.
    4. STRUCTURE: Group by Year and then by Month. Put undated facts in irrelevantFacts.
  `;

  try {
    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text());
  } catch (e) {
    console.error("cleanupChronology error:", e);
    return null;
  }
};

/**
 * Extracts structured facts from raw user notes.
 */
export const extractFactsFromNotes = async (userNotes: string): Promise<Partial<Annotation>[]> => {
  const schema = {
    type: SchemaType.ARRAY,
    items: {
      type: SchemaType.OBJECT,
      properties: {
        text: { type: SchemaType.STRING },
        eventDate: { type: SchemaType.STRING, nullable: true },
        category: { type: SchemaType.STRING }
      },
      required: ["text", "category"]
    }
  };

  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: schema as any
    }
  });

  const prompt = `Extract key clinical facts from these physician notes. eventDate should be YYYY-MM-DD. NOTES: "${userNotes}"`;

  try {
    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text());
  } catch (e) {
    console.error("extractFactsFromNotes error:", e);
    return [];
  }
};

/**
 * Analyzes case data for Deposition Preparation.
 */
export const runFullCaseStrategy = async (context: string): Promise<StrategyAnalysis | null> => {
  const schema = {
    type: SchemaType.OBJECT,
    properties: {
      overallAssessment: { type: SchemaType.STRING },
      scenarios: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            id: { type: SchemaType.STRING },
            title: { type: SchemaType.STRING },
            plaintiffArgument: { type: SchemaType.STRING },
            defenseArgument: { type: SchemaType.STRING },
            firstQuestion: { type: SchemaType.STRING },
            idealAnswer: { type: SchemaType.STRING }
          },
          required: ["id", "title", "plaintiffArgument", "defenseArgument", "firstQuestion", "idealAnswer"]
        }
      }
    },
    required: ["overallAssessment", "scenarios"]
  };

  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: schema as any
    },
    systemInstruction: "You are a Senior Trial Consultant specializing in Medical Malpractice. Your tone is strategic and clinical."
  });

  const prompt = `Perform a high-stakes clinical and legal "Battlefield Analysis" for a deposition. CONTEXT: ${context}`;

  try {
    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text());
  } catch (e) {
    console.error("runFullCaseStrategy error:", e);
    return null;
  }
};

/**
 * Rewords and refines raw notes into professional medical-legal language.
 */
export const rewordClinicalNotes = async (rawNotes: string, caseTitle: string): Promise<string> => {
  try {
    const model = getModel("gemini-2.0-flash", "You are a professional medical-legal scribe. Your task is to reword and refine clinical notes to be more professional, authoritative, and clinically precise. Maintain ALL original facts, dates, symptoms, and findings exactly as provided. Only improve the phrasing, vocabulary, and clarity. Do not add headers if they aren't there, and do not change the basic structure.");
    const prompt = `CASE: "${caseTitle}"\n\nNOTES TO REWORD:\n${rawNotes}`;
    const result = await model.generateContent(prompt);
    return result.response.text() || rawNotes;
  } catch (e) {
    console.error("rewordClinicalNotes error:", e);
    return rawNotes;
  }
};

/**
 * Refines raw annotation input text.
 */
export const processAnnotationInput = async (rawText: string) => {
  const schema = {
    type: SchemaType.OBJECT,
    properties: {
      refinedText: { type: SchemaType.STRING },
      extractedDate: { type: SchemaType.STRING, nullable: true },
      extractedTime: { type: SchemaType.STRING, nullable: true }
    },
    required: ["refinedText"]
  };

  if (!process.env.API_KEY && !process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is missing from environment.");
  }

  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: schema as any,
      temperature: 0.1,
    },
    systemInstruction: `You are a Senior Medical-Legal Consultant specializing in clinical documentation.
    DATE RULES:
    - Today's year is 2026.
    - If a specific date is mentioned (e.g., "Jan 22"), use 2026 as the year: "2026-01-22".
    - Always return dates as YYYY-MM-DD.
    - Always return times as HH:mm (24h format).
    - If not found, return null.`
  });

  const prompt = `
    TASK: Refine the clinical observation into an authoritative medical-legal statement and strictly extract any mentioned dates/times.
    
    RAW INPUT: 
    ---
    ${rawText}
    ---
    
    INSTRUCTIONS:
    1. REFINED TEXT: Rewrite the raw input into a professional, clinically precise medical-legal observation. 
       - Example: "patient has bad fever" -> "The patient presents with high-grade pyrexia."
       - Maintain all clinical facts (dates, values, symptoms).
    2. DATE EXTRACTION: Identify the primary date mentioned in the input. 
       - Format: YYYY-MM-DD.
       - If only "Jan 22" or "22nd Jan" is mentioned, assume 2026.
    3. TIME EXTRACTION: Identify any mentioned time. 
       - Format: HH:mm (24-hour).
       - Examples: "2pm" -> "14:00", "09:30" -> "09:30".
  `;

  try {
    const result = await model.generateContent(prompt);
    const parsed = JSON.parse(result.response.text());
    return {
      refinedText: parsed.refinedText || rawText,
      extractedDate: parsed.extractedDate || null,
      extractedTime: parsed.extractedTime || null
    };
  } catch (e) {
    console.error("processAnnotationInput error:", e);
    return { refinedText: rawText, extractedDate: null, extractedTime: null };
  }
};

/**
 * Chat with Deposition Coach.
 */
export const chatWithDepositionCoach = async (history: ChatMessage[], message: string, context: string) => {
  const schema = {
    type: SchemaType.OBJECT,
    properties: {
      coaching: {
        type: SchemaType.OBJECT,
        properties: {
          score: { type: SchemaType.NUMBER },
          critique: { type: SchemaType.STRING },
          questionIntent: { type: SchemaType.STRING },
          technique: { type: SchemaType.STRING },
          betterAnswer: { type: SchemaType.STRING }
        },
        required: ["score", "critique", "questionIntent", "technique", "betterAnswer"]
      },
      nextQuestion: { type: SchemaType.STRING }
    },
    required: ["coaching", "nextQuestion"]
  };

  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: schema as any
    },
    systemInstruction: `You are an aggressive opposing counsel deposition coach. 
    Your goal is to trap the physician expert with difficult clinical questions.
    After the user responds, analyze their answer:
    1. Score it (1-10).
    2. Provide a critique of why their answer might be dangerous or weak.
    3. Identify the 'trap' intent of your question.
    4. Provide a 'Golden Answer' (betterAnswer) that use a specific deposition technique (e.g. Pivot, Assertive Neutrality).
    5. Propose the 'nextQuestion' to continue the cross-examination.
    
    Context: ${context}.`
  });

  const contents = history.map(h => ({
    role: h.role === 'user' ? 'user' : 'model',
    parts: [{ text: h.text }]
  }));

  // The SDK expects rolls to alternate. If history is empty or last was model, next should be user.
  // We already added the user message in historyWithUser in UI, so history contains it.

  try {
    const result = await model.generateContent({ contents });
    const responseText = result.response.text();
    if (!responseText) throw new Error("Empty response from AI");

    return JSON.parse(responseText);
  } catch (e) {
    console.error("chatWithDepositionCoach error:", e);
    // Return a structured fallback so the UI handles it gracefully
    return {
      coaching: {
        score: 5,
        critique: "I'm having trouble analyzing that specific response due to a connection issue. However, in general, ensure you remain neutral and don't speculate.",
        questionIntent: "To clarify the clinical timeline.",
        technique: "Pivot to Standards",
        betterAnswer: "I followed the accepted standard of care based on the clinical presentation at that time."
      },
      nextQuestion: "Can you elaborate on the standard of care you applied in this instance?"
    };
  }
};

/**
 * Suggest Report Edits.
 */
export const suggestReportEdit = async (content: string, instruction: string) => {
  const schema = {
    type: SchemaType.OBJECT,
    properties: {
      newContent: { type: SchemaType.STRING },
      explanation: { type: SchemaType.STRING }
    },
    required: ["newContent", "explanation"]
  };

  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: schema as any
    },
    systemInstruction: "You are a thoroughly trained Medical-Legal Report Editor."
  });

  try {
    const result = await model.generateContent(`Report Content: ${content}\nInstruction: ${instruction}`);
    return JSON.parse(result.response.text());
  } catch (e) {
    console.error("suggestReportEdit error:", e);
    return { newContent: content, explanation: "Edit failed." };
  }
};

/**
 * Search medical research (Mocking for now as Search is a specialized capability).
 */
export const searchMedicalResearch = async (query: string, context: string) => {
  // In a real app, this would use the Google Search tool. 
  // For this environment, we will return a simulated high-quality response if search tool isn't available.
  return [
    {
      title: "Clinical Guidelines for Post-Operative Monitoring",
      source: "Journal of Clinical Medicine",
      summary: "Comprehensive review of vital sign monitoring frequencies in post-surgical wards.",
      url: "https://example.com/research1",
      citation: "J. Clin. Med. 2024; 12:45-67"
    }
  ];
};

/**
 * Analyze research gaps.
 */
export const analyzeReportForResearchGaps = async (content: string) => {
  const schema = {
    type: SchemaType.ARRAY,
    items: {
      type: SchemaType.OBJECT,
      properties: {
        topic: { type: SchemaType.STRING },
        reason: { type: SchemaType.STRING }
      },
      required: ["topic", "reason"]
    }
  };

  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: schema as any
    },
    systemInstruction: "You are a Senior Medical-Legal Researcher. Find critical search gaps in this report."
  });

  try {
    const result = await model.generateContent(`REPORT: ${content}`);
    return JSON.parse(result.response.text());
  } catch (e) {
    console.error("analyzeReportForResearchGaps error:", e);
    return [];
  }
};

/**
 * Smart citation insertion.
 */
export const insertSmartCitation = async (content: string, article: any) => {
  const schema = {
    type: SchemaType.OBJECT,
    properties: {
      newContent: { type: SchemaType.STRING },
      explanation: { type: SchemaType.STRING }
    },
    required: ["newContent", "explanation"]
  };

  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: schema as any
    }
  });

  try {
    const result = await model.generateContent(`Propose citation insertion. Article: ${JSON.stringify(article)}\nReport: ${content}`);
    return JSON.parse(result.response.text());
  } catch (e) {
    console.error("insertSmartCitation error:", e);
    return { newContent: content, explanation: "Citation addition failed." };
  }
};

/**
 * Finalizes the report into a client-ready format.
 */
export const finalizeLegalReport = async (content: string): Promise<string> => {
  try {
    const model = getModel("gemini-2.0-flash", "You are a senior medical-legal editor. Your task is to convert a draft report into a final, client-ready format. Remove all markdown artifacts (like double asterisks or hashtags) if they interfere with professional look, ensure consistent typography, and remove any 'working' tags or AI markers. The output should be a clean, perfectly formatted professional report ready for signature.");
    const prompt = `FINAL EDIT REQUEST:\n\n${content}\n\n--- \nPlease provide the finalized text below:`;
    const result = await model.generateContent(prompt);
    return result.response.text() || content;
  } catch (e) {
    console.error("finalizeLegalReport error:", e);
    return content;
  }
};
