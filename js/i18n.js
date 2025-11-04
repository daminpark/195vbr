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
  const urlParams = new URLSearchParams(window.location.search);
  const langOverride = urlParams.get('lang');
  const savedLang = localStorage.getItem('selectedLanguage');
  const browserLang = (navigator.language || navigator.userLanguage).split('-')[0];

  let targetLang = 'en'; // Default

  // **MODIFICATION: New language detection priority**
  if (langOverride && I18nState.supportedLanguages.includes(langOverride)) {
    targetLang = langOverride;
  } else if (savedLang && I18nState.supportedLanguages.includes(savedLang)) {
    targetLang = savedLang;
  } else if (I18nState.supportedLanguages.includes(browserLang)) {
    targetLang = browserLang;
  }

  I18nState.currentLanguage = targetLang;
  
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
 * (No changes to this function)
 */
function t(key, replacements = {}, forceLang = null) {
  const resolveKey = (obj, keyPath) => {
    return keyPath.split('.').reduce((acc, part) => acc && acc[part], obj);
  };
  
  let translation;
  if (forceLang === 'en') {
    translation = resolveKey(I18nState.fallbackTranslations, key);
  } else {
    translation = resolveKey(I18nState.translations, key);
    if (!translation) {
      translation = resolveKey(I18nState.fallbackTranslations, key);
    }
  }

  if (!translation) {
    console.warn(`Translation key not found in any language: "${key}"`);
    return key;
  }

  if (replacements && typeof replacements === 'object') {
    Object.keys(replacements).forEach(placeholder => {
      const regex = new RegExp(`{${placeholder}}`, 'g');
      translation = translation.replace(regex, replacements[placeholder]);
    });
  }
  
  return translation;
}