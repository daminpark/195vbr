// js/i18n.js

// --- GLOBAL I18N STATE ---
const I18nState = {
  supportedLanguages: ['en', 'ar', 'zh', 'cs', 'nl', 'fr', 'de', 'hi', 'it', 'ja', 'ko', 'pl', 'pt', 'ru', 'es', 'th', 'tr'],
  translations: {},
  fallbackTranslations: {},
  currentLanguage: 'en'
};

/**
 * Loads the translation files for the detected and fallback languages.
 * This function should be called once when the application starts.
 */
async function loadTranslations() {
  // 1. Detect user's preferred language
  const userLang = navigator.language || navigator.userLanguage; // e.g., "fr-CA", "es-ES", "en-US"
  const primaryLanguage = userLang.split('-')[0]; // "fr", "es", "en"

  // 2. Find the best matching supported language or default to 'en'
  I18nState.currentLanguage = I18nState.supportedLanguages.includes(primaryLanguage)
    ? primaryLanguage
    : 'en';

  // 3. Fetch the JSON files for the current language and the English fallback
  try {
    const [langResponse, fallbackResponse] = await Promise.all([
      fetch(`/lang/${I18nState.currentLanguage}.json`),
      fetch('/lang/en.json')
    ]);

    if (!langResponse.ok) {
      console.warn(`Could not load translation file for "${I18nState.currentLanguage}".`);
      I18nState.currentLanguage = 'en'; // Force fallback if file is missing
      I18nState.translations = await fallbackResponse.json();
    } else {
      I18nState.translations = await langResponse.json();
    }
    
    // Always load English for fallback purposes
    if (I18nState.currentLanguage !== 'en' && fallbackResponse.ok) {
       I18nState.fallbackTranslations = await fallbackResponse.json();
    } else {
       I18nState.fallbackTranslations = I18nState.translations; // They are the same
    }
    
    console.log(`Successfully loaded translations for "${I18nState.currentLanguage}".`);
    
  } catch (error) {
    console.error('Fatal error loading translation files. Defaulting to empty.', error);
    // In case of a network error, etc., we prevent the app from crashing
    I18nState.translations = {};
    I18nState.fallbackTranslations = {};
  }
}

/**
 * The main translation function.
 * Gets a translated string for a given key.
 * Supports dot notation for nested keys (e.g., "welcome.header").
 * Supports dynamic value replacement (e.g., t('welcome.header', { guestName: 'John' })).
 * Falls back to English if a key is missing in the current language.
 *
 * @param {string} key - The key for the translation string (e.g., "chat.header").
 * @param {object} [replacements={}] - An object with keys and values for replacement.
 * @param {string|null} [forceLang=null] - Optional: force a specific language ('en') for the lookup.
 * @returns {string} The translated (and formatted) string.
 */
function t(key, replacements = {}, forceLang = null) {
  // Helper function to resolve dot notation keys
  const resolveKey = (obj, keyPath) => {
    return keyPath.split('.').reduce((acc, part) => acc && acc[part], obj);
  };
  
  let translation;
  // **MODIFICATION: Allow forcing a language**
  if (forceLang === 'en') {
    translation = resolveKey(I18nState.fallbackTranslations, key);
  } else {
    // 1. Try to get the string from the current language
    translation = resolveKey(I18nState.translations, key);
    
    // 2. If not found, try the fallback language (English)
    if (!translation) {
      translation = resolveKey(I18nState.fallbackTranslations, key);
    }
  }

  if (!translation) {
    console.warn(`Translation key not found in any language: "${key}"`);
    return key; // Return the key itself as a last resort
  }

  // 3. Perform replacements for dynamic values
  if (replacements && typeof replacements === 'object') {
    Object.keys(replacements).forEach(placeholder => {
      const regex = new RegExp(`{${placeholder}}`, 'g');
      translation = translation.replace(regex, replacements[placeholder]);
    });
  }
  
  return translation;
}