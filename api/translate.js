import { Redis } from '@upstash/redis';
import { GoogleGenerativeAI } from '@google/generative-ai';

// --- Initialize Redis Client for Vercel KV ---
const kv = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// --- Initialize Gemini AI ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); // Using a powerful model for accurate JSON translation

const TRANSLATION_CACHE_VERSION = 'v1'; // Increment this to force re-translation of all languages

// A map of friendly language names for the AI prompt
const languageMap = {
    'es': 'Spanish', 'fr': 'French', 'de': 'German', 'it': 'Italian',
    'pt': 'Portuguese', 'ru': 'Russian', 'ja': 'Japanese', 'ko': 'Korean',
    'zh': 'Chinese (Simplified)', 'ar': 'Arabic', 'hi': 'Hindi'
};


export default async function handler(req, res) {

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { content, targetLang } = req.body;
    if (!content || !targetLang || !languageMap[targetLang]) {
      return res.status(400).json({ error: 'Invalid request body. Requires "content" object and a valid "targetLang" code.' });
    }

    const cacheKey = `translations_${TRANSLATION_CACHE_VERSION}_${targetLang}`;
    
    // 1. Check cache first
    const cachedTranslation = await kv.get(cacheKey);
    if (cachedTranslation) {
      console.log(`[Cache] HIT for language: ${targetLang}`);
      return res.status(200).json(cachedTranslation);
    }

    console.log(`[Cache] MISS for language: ${targetLang}. Translating with AI...`);

    // 2. If not in cache, perform translation
    const prompt = `
      Translate the text values in the following JSON object into ${languageMap[targetLang]}.
      - IMPORTANT: Preserve the original JSON structure, all keys, and all HTML tags (like <p>, <a>, <strong>, <ul>, <li>) exactly as they are.
      - Only translate the user-visible text content. Do not translate URLs or HTML attributes.
      - Ensure the output is a valid JSON object.

      Here is the JSON to translate:
      ${JSON.stringify(content, null, 2)}
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const rawText = response.text();
    
    // Clean the response to ensure it's valid JSON
    const jsonString = rawText.replace(/^```json\s*|```\s*$/g, '').trim();
    const translatedContent = JSON.parse(jsonString);

    // 3. Store the new translation in the cache
    // Cache for 24 hours (86400 seconds)
    await kv.set(cacheKey, translatedContent, { ex: 86400 }); 
    console.log(`[Cache] SET for language: ${targetLang}`);

    // 4. Return the new translation
    return res.status(200).json(translatedContent);

  } catch (error) {
    console.error('[translate.js] Error:', error);
    // It's better to return the original content than nothing if translation fails
    return res.status(500).json({ error: 'Failed to translate content.', originalContent: req.body.content });
  }
}