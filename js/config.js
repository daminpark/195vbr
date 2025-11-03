// js/config.js

// --- SINGLE SOURCE OF TRUTH FOR BACKEND URL ---

const PRODUCTION_BACKEND_URL = 'https://guidebook-chatbot-backend.vercel.app';
const PREVIEW_BACKEND_URL = 'https://guidebook-chatbot-backend-git-ical-auth-pierre-parks-projects.vercel.app';

let BACKEND_API_BASE_URL;

// Automatically select the backend URL based on the frontend's hostname.
const PRODUCTION_HOSTNAME = 'manual.195vbr.com'; 
const PREVIEW_HOSTNAME = '195vbr-git-ical-auth-pierre-parks-projects.vercel.app';

const currentHostname = window.location.hostname;

if (currentHostname === PRODUCTION_HOSTNAME) {
  BACKEND_API_BASE_URL = PRODUCTION_BACKEND_URL;
  console.log("Environment: PRODUCTION");
} else if (currentHostname === PREVIEW_HOSTNAME) {
  BACKEND_API_BASE_URL = PREVIEW_BACKEND_URL;
  console.log("Environment: PREVIEW");
} else {
  // Fallback for local development or other preview branches
  BACKEND_API_BASE_URL = PREVIEW_BACKEND_URL;
  console.log(`Environment: DEVELOPMENT/OTHER (${currentHostname})`);
}