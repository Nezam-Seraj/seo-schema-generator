/* ============================================================
   Schema Architect — Dental Practice Engine
   ============================================================
   Generates Dentist + MedicalWebPage + FAQPage JSON-LD
   with dental-specific entity extraction and AEO optimization.
   ============================================================ */

import './style.css';
import STANDARDS from './standards.md?raw';

// ─── DOM References ────────────────────────────────────────
const urlInput = document.getElementById('urlInput');
const analyzeBtn = document.getElementById('analyzeBtn');
const btnText = analyzeBtn.querySelector('.btn-analyze__text');
const btnLoader = analyzeBtn.querySelector('.btn-analyze__loader');
const errorMsg = document.getElementById('errorMsg');
const loadingSkeleton = document.getElementById('loadingSkeleton');
const resultsSection = document.getElementById('resultsSection');
const entityCards = document.getElementById('entityCards');
const jsonOutput = document.getElementById('jsonOutput').querySelector('code');
const schemaCount = document.getElementById('schemaCount');
const gapCards = document.getElementById('gapCards');
const copyBtn = document.getElementById('copyBtn');
const downloadBtn = document.getElementById('downloadBtn');
const practiceNameInput = document.getElementById('practiceNameInput');
const dentistNameInput = document.getElementById('dentistNameInput');
const cityStateInput = document.getElementById('cityStateInput');
const streetInput = document.getElementById('streetInput');
const zipInput = document.getElementById('zipInput');
const serviceNameInput = document.getElementById('serviceNameInput');
const serviceNameRow = document.getElementById('serviceNameRow');
const hoursInput = document.getElementById('hoursInput');
const phoneInput = document.getElementById('phoneInput');
const pageTypeButtons = document.getElementById('pageTypeButtons');
const autoDetectBadge = document.getElementById('autoDetectBadge');

// AI Refinement DOM elements
const aiSettingsToggle = document.getElementById('aiSettingsToggle');
const aiSettingsPanel = document.getElementById('aiSettingsPanel');
const aiStatus = document.getElementById('aiStatus');
const geminiKeyInput = document.getElementById('geminiKeyInput');
const aiBadge = document.getElementById('aiBadge');
const aiReportSection = document.getElementById('aiReportSection');
const aiScore = document.getElementById('aiScore');
const aiReportCards = document.getElementById('aiReportCards');

let currentJsonLd = null;
let currentPageType = 'homepage'; // homepage | service | about | contact
let pageTypeManuallySet = false;

// ─── AI Settings Management ───────────────────────────────
// Priority: .env file → localStorage → manual entry
const ENV_KEY = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GEMINI_API_KEY) || '';

(function initAiSettings() {
  const savedKey = ENV_KEY || localStorage.getItem('gemini_api_key') || '';
  if (savedKey) {
    geminiKeyInput.value = savedKey;
    if (ENV_KEY) localStorage.setItem('gemini_api_key', savedKey); // sync .env → localStorage
    aiStatus.textContent = 'ON';
    aiStatus.classList.add('ai-settings__status--on');
  }

  aiSettingsToggle.addEventListener('click', () => {
    aiSettingsPanel.hidden = !aiSettingsPanel.hidden;
  });

  geminiKeyInput.addEventListener('input', () => {
    const key = geminiKeyInput.value.trim();
    if (key.length > 10) {
      localStorage.setItem('gemini_api_key', key);
      aiStatus.textContent = 'ON';
      aiStatus.classList.add('ai-settings__status--on');
    } else {
      localStorage.removeItem('gemini_api_key');
      aiStatus.textContent = 'OFF';
      aiStatus.classList.remove('ai-settings__status--on');
    }
  });
})();

// ─── Known Dental Services (for H2 → Service mapping) ─────
const DENTAL_SERVICES = [
  { pattern: /implant/i, name: 'Dental Implants', desc: 'Permanent tooth replacement using biocompatible titanium posts.' },
  { pattern: /invisalign|clear\s*aligner/i, name: 'Invisalign / Clear Aligners', desc: 'Removable clear aligner therapy for orthodontic correction.' },
  { pattern: /whiten/i, name: 'Teeth Whitening', desc: 'Professional teeth whitening treatments for a brighter smile.' },
  { pattern: /veneer/i, name: 'Porcelain Veneers', desc: 'Custom porcelain shells bonded to teeth for cosmetic enhancement.' },
  { pattern: /crown/i, name: 'Dental Crowns', desc: 'Custom-fitted caps to restore damaged or decayed teeth.' },
  { pattern: /bridge/i, name: 'Dental Bridges', desc: 'Fixed prosthetic devices to replace missing teeth.' },
  { pattern: /root\s*canal/i, name: 'Root Canal Therapy', desc: 'Endodontic treatment to save infected or damaged teeth.' },
  { pattern: /clean|hygien|prophylax/i, name: 'Dental Cleaning', desc: 'Professional teeth cleaning and preventive care.' },
  { pattern: /orthodon|brace/i, name: 'Orthodontics', desc: 'Comprehensive orthodontic treatment for teeth alignment.' },
  { pattern: /extract/i, name: 'Tooth Extraction', desc: 'Surgical and simple tooth removal procedures.' },
  { pattern: /wisdom/i, name: 'Wisdom Teeth Removal', desc: 'Surgical extraction of third molars.' },
  { pattern: /denture/i, name: 'Dentures', desc: 'Removable prosthetic devices for missing teeth.' },
  { pattern: /filling|cavit/i, name: 'Dental Fillings', desc: 'Composite or amalgam restorations for cavities.' },
  { pattern: /periodon|gum\s*(disease|treat)/i, name: 'Periodontal Treatment', desc: 'Treatment for gum disease and periodontal conditions.' },
  { pattern: /cosmetic/i, name: 'Cosmetic Dentistry', desc: 'Aesthetic dental procedures to improve smile appearance.' },
  { pattern: /emergency/i, name: 'Emergency Dentistry', desc: 'Urgent dental care for pain, trauma, and emergencies.' },
  { pattern: /pediatric|child|kid/i, name: 'Pediatric Dentistry', desc: 'Dental care specialized for children and adolescents.' },
  { pattern: /sedation/i, name: 'Sedation Dentistry', desc: 'Sedation options for anxious patients during dental procedures.' },
  { pattern: /x-ray|radiograph/i, name: 'Dental X-Rays', desc: 'Digital radiographic imaging for diagnosis.' },
  { pattern: /tmj|jaw/i, name: 'TMJ Treatment', desc: 'Treatment for temporomandibular joint disorders.' },
  { pattern: /sleep\s*apnea|snor/i, name: 'Sleep Apnea Treatment', desc: 'Oral appliance therapy for sleep-disordered breathing.' },
  { pattern: /bonding/i, name: 'Dental Bonding', desc: 'Composite resin bonding for cosmetic tooth repair.' },
  { pattern: /all.on.(4|four|six|6)/i, name: 'All-on-4 Implants', desc: 'Full-arch restoration using four strategically placed implants.' },
];

// ─── Dental Specialties ───────────────────────────────────
// NOTE: schema.org MedicalSpecialty enum only accepts specific values.
// All dental specialties map to 'http://schema.org/Dentistry'.
const DENTAL_SPECIALTIES = [
  { pattern: /cosmetic/i, value: 'http://schema.org/Dentistry' },
  { pattern: /orthodon/i, value: 'http://schema.org/Dentistry' },
  { pattern: /endodon|root\s*canal/i, value: 'http://schema.org/Dentistry' },
  { pattern: /periodon|gum/i, value: 'http://schema.org/Dentistry' },
  { pattern: /oral\s*surg/i, value: 'http://schema.org/Dentistry' },
  { pattern: /pediatric|child/i, value: 'http://schema.org/Dentistry' },
  { pattern: /prosthodon/i, value: 'http://schema.org/Dentistry' },
  { pattern: /implant/i, value: 'http://schema.org/Dentistry' },
  { pattern: /general|family/i, value: 'http://schema.org/Dentistry' },
];

// ─── Amenity Patterns ─────────────────────────────────────
const AMENITY_PATTERNS = [
  { pattern: /wheelchair|accessible|ada\s*complian/i, name: 'Wheelchair Accessible' },
  { pattern: /free\s*parking|parking\s*available/i, name: 'Free Parking' },
  { pattern: /wi-?fi|wifi|internet/i, name: 'Free WiFi' },
  { pattern: /tv|television|netflix/i, name: 'In-Room Entertainment' },
  { pattern: /blanket|comfort/i, name: 'Comfort Amenities' },
  { pattern: /nitrous|laughing\s*gas/i, name: 'Nitrous Oxide Available' },
  { pattern: /same.?day/i, name: 'Same-Day Appointments' },
  { pattern: /evening|weekend|saturday|sunday/i, name: 'Extended Hours' },
  { pattern: /virtual|telehealth|telemed/i, name: 'Virtual Consultations' },
];

// ─── Dental Conditions (for MedicalCondition entities) ────
const DENTAL_CONDITIONS = {
  'Dental Implants': {
    condition: 'Tooth Loss', alternateName: ['Missing Teeth', 'Edentulism'],
    description: 'Tooth loss occurs when one or more teeth fall out or must be extracted due to decay, gum disease, or trauma.',
    symptoms: ['Gaps in the smile', 'Difficulty chewing', 'Bone loss in the jaw', 'Shifting of remaining teeth'],
    treatments: [
      { name: 'Dental Implant', desc: 'A titanium post surgically placed in the jawbone to replace the root of a missing tooth.' },
      { name: 'Dental Bridge', desc: 'A fixed prosthetic anchored to adjacent teeth to replace one or more missing teeth.' }
    ],
    tests: [{ name: 'Dental X-Ray & CT Scan', desc: 'Imaging to evaluate jawbone density and determine implant placement.' }],
    progression: 'Without treatment, tooth loss leads to bone resorption, shifting of adjacent teeth, and difficulty eating.',
    complication: 'Untreated tooth loss can cause jawbone deterioration, facial structure changes, and increased risk of further tooth loss.'
  },
  'Teeth Whitening': {
    condition: 'Tooth Discoloration', alternateName: ['Stained Teeth', 'Yellowing Teeth'],
    description: 'Tooth discoloration occurs when the color of teeth changes due to staining from food, drinks, tobacco, aging, or medications.',
    symptoms: ['Yellow or brown staining on teeth', 'Uneven tooth color', 'Discoloration from coffee, tea, or wine'],
    treatments: [
      { name: 'Professional Teeth Whitening', desc: 'In-office bleaching using hydrogen peroxide gel with light activation.' },
      { name: 'Take-Home Whitening Trays', desc: 'Custom-fitted trays with professional-grade whitening gel for at-home use.' }
    ],
    tests: [{ name: 'Dental Examination', desc: 'Visual assessment to determine the cause and type of discoloration.' }],
    progression: 'Tooth discoloration worsens over time without treatment as stains accumulate and enamel thins with age.',
    complication: 'While primarily cosmetic, severe discoloration may indicate underlying enamel erosion or decay.'
  },
  'Dental Cleaning': {
    condition: 'Plaque and Tartar Buildup', alternateName: ['Dental Calculus', 'Biofilm Accumulation'],
    description: 'Plaque is a sticky film of bacteria that forms on teeth. When not removed, it hardens into tartar, which can only be removed by a dental professional.',
    symptoms: ['Visible tartar deposits', 'Bad breath', 'Swollen or bleeding gums', 'Tooth sensitivity'],
    treatments: [
      { name: 'Professional Dental Cleaning', desc: 'Removal of plaque and tartar using ultrasonic scaling and hand instruments.' },
      { name: 'Deep Cleaning (Scaling and Root Planing)', desc: 'Removal of tartar below the gumline and smoothing of tooth roots.' }
    ],
    tests: [{ name: 'Periodontal Probing', desc: 'Measurement of gum pocket depths to assess gum health.' }],
    progression: 'Without regular cleaning, plaque buildup leads to gingivitis, periodontitis, and eventual tooth loss.',
    complication: 'Advanced plaque accumulation causes gum disease, tooth decay, and has been linked to cardiovascular disease.'
  },
  'Root Canal Therapy': {
    condition: 'Tooth Pulp Infection', alternateName: ['Pulpitis', 'Dental Abscess'],
    description: 'Infection or inflammation of the dental pulp, the soft tissue inside the tooth containing nerves and blood vessels.',
    symptoms: ['Severe toothache', 'Prolonged sensitivity to hot or cold', 'Darkening of the tooth', 'Swelling near the affected tooth'],
    treatments: [
      { name: 'Root Canal Treatment', desc: 'Removal of infected pulp tissue, cleaning and shaping of root canals, and sealing with biocompatible material.' },
      { name: 'Dental Crown', desc: 'A custom-fitted cap placed after root canal treatment to restore the tooth.' }
    ],
    tests: [
      { name: 'Dental X-Ray', desc: 'Radiographic imaging to identify the extent of infection and root canal anatomy.' },
      { name: 'Pulp Vitality Test', desc: 'Testing the tooth nerve response to determine if the pulp is healthy or infected.' }
    ],
    progression: 'Untreated pulp infection leads to abscess formation, bone loss, and may spread to adjacent teeth or the bloodstream.',
    complication: 'A dental abscess can spread to the jaw, head, or neck and become life-threatening if not treated promptly.'
  },
  'Dental Fillings': {
    condition: 'Dental Cavities', alternateName: ['Tooth Decay', 'Dental Caries', 'Caries'],
    description: 'Dental cavities are areas of permanent damage on the hard surface of teeth caused by bacteria that produce acid from food consumption.',
    symptoms: ['Toothache or spontaneous pain', 'Sensitivity to sweet, hot, or cold', 'Visible holes or pits in teeth', 'Brown or black staining on tooth surfaces'],
    treatments: [
      { name: 'Dental Filling', desc: 'Removal of decayed tooth material and restoration with composite resin or amalgam.' },
      { name: 'Dental Crown', desc: 'A custom-fitted cap for severely decayed teeth to restore shape, size, and function.' }
    ],
    tests: [
      { name: 'Dental X-Rays', desc: 'Radiographic images to reveal cavities between teeth and below the gum line.' },
      { name: 'Physical Dental Examination', desc: 'Visual and tactile inspection of teeth and gums by a dentist.' }
    ],
    progression: 'If untreated, a cavity progresses through enamel into dentin, then into the pulp, requiring root canal or extraction.',
    complication: 'Untreated cavities can spread to adjacent teeth, cause severe toothache, and lead to dental abscess or infection.'
  },
  'Orthodontics': {
    condition: 'Malocclusion', alternateName: ['Crooked Teeth', 'Misaligned Bite', 'Dental Misalignment'],
    description: 'Malocclusion is a misalignment of teeth or incorrect relationship between the upper and lower dental arches.',
    symptoms: ['Crooked or crowded teeth', 'Overbite or underbite', 'Difficulty chewing', 'Speech difficulties', 'Jaw pain'],
    treatments: [
      { name: 'Traditional Braces', desc: 'Metal or ceramic brackets bonded to teeth with wires to gradually move teeth into alignment.' },
      { name: 'Clear Aligners', desc: 'Removable clear plastic trays that gradually shift teeth into proper position.' }
    ],
    tests: [{ name: 'Orthodontic Assessment', desc: 'Examination including X-rays, photos, and dental impressions to plan treatment.' }],
    progression: 'Untreated malocclusion can worsen over time, leading to increased tooth wear, jaw pain, and difficulty with oral hygiene.',
    complication: 'Severe malocclusion can cause TMJ disorders, chronic headaches, and increased risk of tooth decay and gum disease.'
  },
  'Porcelain Veneers': {
    condition: 'Cosmetic Tooth Damage', alternateName: ['Chipped Teeth', 'Worn Teeth', 'Uneven Teeth'],
    description: 'Cosmetic tooth damage includes chips, cracks, worn enamel, or uneven teeth that affect the appearance of the smile.',
    symptoms: ['Chipped or cracked tooth surface', 'Uneven tooth edges', 'Gaps between teeth', 'Worn or thin enamel'],
    treatments: [
      { name: 'Porcelain Veneers', desc: 'Custom porcelain shells bonded to the front of teeth for cosmetic enhancement.' },
      { name: 'Dental Bonding', desc: 'Composite resin applied and shaped to repair chipped or uneven teeth.' }
    ],
    tests: [{ name: 'Cosmetic Dental Consultation', desc: 'Assessment of tooth condition, bite, and smile aesthetics to plan treatment.' }],
    progression: 'Without treatment, cosmetic damage may worsen and lead to further chipping or structural compromise.',
    complication: 'Severely damaged teeth may require crowns or extraction if cosmetic issues are not addressed early.'
  },
  'Periodontal Treatment': {
    condition: 'Periodontal Disease', alternateName: ['Gum Disease', 'Gingivitis', 'Periodontitis'],
    description: 'Periodontal disease is a chronic inflammatory condition affecting the gums and bone supporting the teeth.',
    symptoms: ['Red, swollen, or bleeding gums', 'Persistent bad breath', 'Receding gums', 'Loose teeth', 'Pain when chewing'],
    treatments: [
      { name: 'Scaling and Root Planing', desc: 'Deep cleaning to remove tartar below the gumline and smooth tooth roots.' },
      { name: 'Periodontal Surgery', desc: 'Surgical intervention for advanced gum disease to reduce pocket depth and restore tissue.' }
    ],
    tests: [{ name: 'Periodontal Examination', desc: 'Probing of gum pockets, X-rays, and assessment of bone levels around teeth.' }],
    progression: 'Untreated gum disease progresses from gingivitis to periodontitis, causing irreversible bone loss and tooth loss.',
    complication: 'Advanced periodontal disease is linked to heart disease, diabetes complications, and systemic inflammation.'
  }
};

// ─── Dental Procedure Details (preparation & followup) ────
const DENTAL_PROCEDURE_DETAILS = {
  'Dental Implants': {
    preparation: 'A CT scan and dental X-rays are taken to evaluate jawbone density. A treatment plan is created and any necessary tooth extractions are performed prior to implant placement.',
    followup: 'Avoid hard foods for several weeks. Follow prescribed oral hygiene routine. Attend follow-up visits to monitor healing and osseointegration. Full healing typically takes 3-6 months.'
  },
  'Teeth Whitening': {
    preparation: 'No special preparation is required. A dental cleaning is recommended prior to whitening for optimal results. Existing cavities or gum disease should be treated first.',
    followup: 'Avoid staining foods and beverages (coffee, tea, red wine) for 48 hours after treatment. Use sensitivity toothpaste if needed. Results typically last 6-12 months with proper care.'
  },
  'Dental Cleaning': {
    preparation: 'No special preparation is required. Inform your hygienist of any changes to your health history or medications.',
    followup: 'Continue brushing twice daily and flossing. Schedule follow-up cleanings every six months. Report any persistent sensitivity or bleeding to your dentist.'
  },
  'Root Canal Therapy': {
    preparation: 'Dental X-rays are taken to assess the infection. A local anesthetic is administered. Antibiotics may be prescribed if infection is severe.',
    followup: 'Avoid chewing on the treated tooth until a permanent crown is placed. Take prescribed antibiotics and pain medication as directed. A follow-up appointment is needed to place the final restoration.'
  },
  'Dental Fillings': {
    preparation: 'A local anesthetic is administered to numb the area. No other special preparation is required.',
    followup: 'Avoid eating on the treated side for a few hours. Sensitivity to hot and cold may occur temporarily. Regular check-ups every six months to monitor the filling.'
  },
  'Orthodontics': {
    preparation: 'An orthodontic consultation includes X-rays, photographs, and dental impressions. A customized treatment plan is created.',
    followup: 'Regular adjustment appointments every 4-8 weeks. Maintain excellent oral hygiene around brackets or aligners. Wear retainers as prescribed after treatment to maintain results.'
  },
  'Porcelain Veneers': {
    preparation: 'A thin layer of enamel is removed from the front of the teeth. Dental impressions are taken and temporary veneers are placed while permanent veneers are crafted.',
    followup: 'Avoid biting hard objects. Maintain regular oral hygiene. Veneers typically last 10-15 years with proper care. Regular dental check-ups to monitor veneer integrity.'
  },
  'Periodontal Treatment': {
    preparation: 'A thorough periodontal examination with probing and X-rays. Local anesthesia is administered for deep cleaning procedures.',
    followup: 'Follow prescribed oral hygiene routine including antimicrobial rinse. Attend maintenance appointments every 3-4 months. Report any recurring symptoms to your dentist.'
  },
  'Tooth Extraction': {
    preparation: 'Dental X-rays are taken. Medical history is reviewed. Local or general anesthesia is administered.',
    followup: 'Apply gauze to control bleeding. Avoid drinking through a straw for 24 hours. Eat soft foods. Take prescribed pain medication. Attend follow-up appointment to check healing.'
  },
  'Invisalign / Clear Aligners': {
    preparation: 'Digital impressions or 3D scanning of teeth. A customized treatment plan with virtual modeling of tooth movement.',
    followup: 'Wear aligners 20-22 hours per day. Switch to new aligners as directed. Attend check-up appointments every 6-8 weeks. Wear retainers after treatment completion.'
  }
};
// ─── Event Listeners ───────────────────────────────────────
analyzeBtn.addEventListener('click', handleAnalyze);
urlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleAnalyze(); });
copyBtn.addEventListener('click', handleCopy);
downloadBtn.addEventListener('click', handleDownload);

// Page type selector
pageTypeButtons.addEventListener('click', (e) => {
  const btn = e.target.closest('.page-type-btn');
  if (!btn) return;
  pageTypeManuallySet = true;
  setPageType(btn.dataset.type);
  autoDetectBadge.hidden = true;
});

// Auto-detect page type when URL changes
urlInput.addEventListener('input', () => {
  if (pageTypeManuallySet) return;
  const url = urlInput.value.trim();
  if (!url || !isValidUrl(url)) return;
  const detected = detectPageType(url);
  setPageType(detected);
  autoDetectBadge.hidden = false;
});

function detectPageType(url) {
  try {
    const path = new URL(url).pathname.toLowerCase().replace(/\/$/, '');
    if (!path || path === '' || path === '/') return 'homepage';
    if (/\/(blog|news|article|post|journal|tips)\b/.test(path)) return 'blog';
    if (/\/(about|team|our-team|meet-the-doctor|meet-the-team|our-dentist|staff|providers|doctors?)\b/.test(path)) return 'about';
    if (/\/(contact|location|directions|find-us|office-location|hours|get-in-touch|appointment|schedule)\b/.test(path)) return 'contact';
    return 'service'; // Any other inner page defaults to service
  } catch { return 'homepage'; }
}

function setPageType(type) {
  currentPageType = type;
  pageTypeButtons.querySelectorAll('.page-type-btn').forEach(btn => {
    btn.classList.toggle('page-type-btn--active', btn.dataset.type === type);
  });
  serviceNameRow.hidden = (type !== 'service');
}

// ─── Main Handler ──────────────────────────────────────────
async function handleAnalyze() {
  const url = urlInput.value.trim();
  if (!url) { showError('Please enter a dental practice URL to analyze.'); return; }
  if (!isValidUrl(url)) { showError('Please enter a valid URL (e.g., https://smiledesignstudio.com).'); return; }

  hideError();
  setLoading(true);

  try {
    const html = await fetchPage(url);
    const entities = extractDentalEntities(html, url);

    // Apply manual overrides if user provided them
    const practiceOverride = practiceNameInput.value.trim();
    const dentistOverride = dentistNameInput.value.trim();
    if (practiceOverride) {
      entities.practiceName = practiceOverride;
      entities.practice.name = practiceOverride;
    }
    if (dentistOverride) {
      if (entities.doctors.length > 0) {
        entities.doctors[0].name = dentistOverride;
      } else {
        entities.doctors.push({ name: dentistOverride, jobTitle: null, url: null, sameAs: [], npi: null });
      }
    }
    const cityOverride = cityStateInput.value.trim();
    if (cityOverride) {
      entities.cityState = cityOverride;
    }
    const streetOverride = streetInput.value.trim();
    if (streetOverride) {
      entities.streetAddress = streetOverride;
    }
    const zipOverride = zipInput.value.trim();
    if (zipOverride) {
      entities.zipCode = zipOverride;
    }
    const serviceNameOverride = serviceNameInput.value.trim();
    if (serviceNameOverride) {
      entities.serviceNameOverride = serviceNameOverride;
    }

    // Hours override
    const hoursOverride = hoursInput.value.trim();
    if (hoursOverride) {
      const parsed = parseHoursText(hoursOverride);
      if (parsed.length > 0) entities.hours = parsed;
    }

    // Phone override
    const phoneOverride = phoneInput.value.trim();
    if (phoneOverride) {
      entities.practice.phone = phoneOverride;
    }

    // Auto-detect if not manually set
    if (!pageTypeManuallySet) {
      const detected = detectPageType(url);
      setPageType(detected);
    }
    entities.pageType = currentPageType;

    const jsonLd = generateDentalJsonLd(entities, url);
    const gaps = analyzeDentalGaps(entities, currentPageType);

    currentJsonLd = jsonLd;
    renderEntityCards(entities);
    renderJsonLd(jsonLd);
    renderGapCards(gaps);

    resultsSection.hidden = false;
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // --- AI Refinement Pass (if API key is configured) ---
    const geminiKey = localStorage.getItem('gemini_api_key');
    if (geminiKey) {
      try {
        analyzeBtn.textContent = '✨ AI Refining…';
        const aiResult = await refineWithGemini(geminiKey, jsonLd, entities, url);
        if (aiResult && aiResult.refinedSchema) {
          currentJsonLd = aiResult.refinedSchema;
          renderJsonLd(aiResult.refinedSchema);
          aiBadge.hidden = false;
        }
        if (aiResult && aiResult.report) {
          renderAiReport(aiResult.report);
        }
      } catch (aiErr) {
        console.warn('AI refinement failed (falling back to rule-based):', aiErr.message);
        // Silently fall back — rule-based output is already shown
      }
    } else {
      aiBadge.hidden = true;
      aiReportSection.hidden = true;
    }
  } catch (err) {
    console.error(err);
    showError(`Failed to analyze URL: ${err.message}. Ensure the URL is publicly accessible.`);
  } finally {
    setLoading(false);
  }
}

// ─── URL Validation ────────────────────────────────────────
function isValidUrl(str) {
  try { const u = new URL(str); return ['http:', 'https:'].includes(u.protocol); }
  catch { return false; }
}

// ─── Fetch Page via CORS Proxy (with fallbacks) ────────────
const CORS_PROXIES = [
  function (url) { return 'https://api.allorigins.win/get?url=' + encodeURIComponent(url); },
  function (url) { return 'https://corsproxy.io/?' + encodeURIComponent(url); },
  function (url) { return 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(url); }
];

async function fetchPage(url) {
  var lastError = null;
  for (var i = 0; i < CORS_PROXIES.length; i++) {
    var proxyUrl = CORS_PROXIES[i](url);
    try {
      var resp = await fetch(proxyUrl);
      if (!resp.ok) {
        lastError = new Error('Proxy ' + (i + 1) + ' returned status ' + resp.status);
        continue;
      }
      var data;
      // allorigins returns JSON with .contents, others return raw HTML
      var contentType = resp.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await resp.json();
        if (data.contents) return data.contents;
        lastError = new Error('No content from proxy ' + (i + 1));
        continue;
      } else {
        // corsproxy.io and codetabs return raw HTML
        var html = await resp.text();
        if (html && html.length > 100) return html;
        lastError = new Error('Empty response from proxy ' + (i + 1));
        continue;
      }
    } catch (e) {
      lastError = e;
      continue;
    }
  }
  throw lastError || new Error('All proxies failed');
}

// ─── Dental Entity Extraction ──────────────────────────────
function extractDentalEntities(html, pageUrl) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const parsed = new URL(pageUrl);
  const domain = parsed.origin;
  const bodyText = (doc.body ? doc.body.textContent : '').toLowerCase();

  // --- Existing JSON-LD ---
  const existingSchemas = [];
  doc.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
    try { existingSchemas.push(JSON.parse(s.textContent)); } catch { }
  });
  const flatSchemas = [];
  existingSchemas.forEach(s => {
    if (s['@graph']) flatSchemas.push(...s['@graph']);
    else flatSchemas.push(s);
  });

  // --- H1 ---
  const h1El = doc.querySelector('h1');
  const h1 = h1El ? h1El.textContent.trim() : null;

  // --- H2s ---
  const h2s = Array.from(doc.querySelectorAll('h2')).map(el => el.textContent.trim()).filter(Boolean).slice(0, 20);

  // --- Practice Name ---
  const practiceName = extractPracticeName(doc, flatSchemas, parsed.hostname);

  // --- Doctor / Dentist Person ---
  const doctors = extractDoctors(doc, flatSchemas, bodyText);

  // --- Dates ---
  const dates = extractDates(doc, flatSchemas);

  // --- Description ---
  const description = extractDescription(doc, flatSchemas);

  // --- Image ---
  const image = extractImage(doc, flatSchemas, domain);

  // --- Organization / Practice Details ---
  const practice = extractPracticeDetails(doc, flatSchemas, domain, parsed.hostname, practiceName, bodyText);

  // --- Medical Specialty ---
  const specialties = detectSpecialties(h1, h2s, bodyText, flatSchemas);

  // --- Dental Services (mapped from H2s & page content) ---
  const services = mapDentalServices(h2s, bodyText);

  // --- FAQs ---
  const faqs = extractFaqs(doc, flatSchemas);

  // --- Amenities ---
  const amenities = detectAmenities(bodyText);

  // --- Languages ---
  const languages = detectLanguages(bodyText);

  // --- Insurance / Payment ---
  const payment = detectPayment(bodyText);

  // --- isAcceptingNewPatients ---
  const acceptingPatients = detectAcceptingPatients(bodyText);

  // --- Opening Hours ---
  const hours = extractHours(doc, flatSchemas, bodyText);

  // --- Emergency Hours ---
  const hasEmergency = /emergency/i.test(bodyText);

  // --- Before/After (Experience signal) ---
  const hasBeforeAfter = /before\s*(and|&|\/)\s*after/i.test(bodyText);

  // --- External / Authority Links ---
  const externalLinks = extractExternalLinks(doc, domain);

  // --- Last Reviewed ---
  const lastReviewed = detectLastReviewed(doc, bodyText);

  // --- Page Content ---
  const answerText = extractAnswerText(doc);
  const wordCount = bodyText.split(/\s+/).filter(Boolean).length;
  const lang = doc.documentElement.getAttribute('lang') || 'en';

  // --- memberOf ---
  const memberships = detectMemberships(bodyText);

  // --- Price Range ---
  const priceRange = detectPriceRange(bodyText, flatSchemas);

  // --- Aggregate Rating ---
  const aggregateRating = extractAggregateRating(doc, flatSchemas);

  // --- Individual Reviews ---
  const reviews = extractReviews(doc, flatSchemas);

  // --- Videos ---
  const videos = extractVideos(doc, flatSchemas, domain);

  // --- Article / Blog Post Data ---
  const articleData = extractArticleData(doc, flatSchemas, bodyText);

  // --- HowTo Steps ---
  const howToSteps = extractHowToSteps(doc);

  return {
    pageUrl, domain, h1, h2s, practiceName, doctors, dates, description, image,
    practice, specialties, services, faqs, amenities, languages, payment,
    acceptingPatients, hours, hasEmergency, hasBeforeAfter, externalLinks,
    lastReviewed, answerText, bodyText, wordCount, lang, memberships, priceRange,
    aggregateRating, reviews, videos, articleData, howToSteps,
    existingSchemas: flatSchemas
  };
}

// --- Practice Name ---
function extractPracticeName(doc, schemas, hostname) {
  for (const s of schemas) {
    if (['Dentist', 'LocalBusiness', 'Organization', 'MedicalBusiness'].includes(s['@type'])) {
      if (s.name) return s.name;
    }
  }
  const ogSite = doc.querySelector('meta[property="og:site_name"]');
  if (ogSite && ogSite.content) return ogSite.content.trim();
  const titleEl = doc.querySelector('title');
  if (titleEl) {
    const title = titleEl.textContent.trim().split(/\s*[\|–—-]\s*/)[0];
    if (title.length < 80) return title;
  }
  return hostname.replace(/^www\./, '').split('.')[0].replace(/(^\w)/, c => c.toUpperCase());
}

// --- Job title validation (whitelist approach) ---
const JOB_TITLE_NOISE = /form|submit|button|click|contact|menu|nav|search|login|sign|toggle|close|open|select|dropdown|symphony|harmony|excellence|passion|smile|journey|mission|vision|together|family|care\s*for|welcome/i;

// Dental/medical job title keywords — title MUST match at least one
const VALID_TITLE_KEYWORDS = /dentist|dds|dmd|orthodont|endodont|periodont|prosthodont|oral\s*surge|pedodont|hygienist|dental\s*assist|dental\s*therap|doctor|physician|surgeon|specialist|practitioner|clinician|director|chief|associate|partner|founder|owner|manager|coordinator/i;

function sanitizeJobTitle(title) {
  if (!title) return null;
  const clean = title.trim();
  if (clean.length < 3 || clean.length > 80) return null;
  if (JOB_TITLE_NOISE.test(clean)) return null;
  if (/^\d+$/.test(clean)) return null;
  // Must contain at least one dental/medical keyword
  if (!VALID_TITLE_KEYWORDS.test(clean)) return null;
  return clean;
}

// --- Doctor Name Sanitization ---
// Uses LEFT-TO-RIGHT scanning: accept name-like words, stop at the first
// word that looks like a common English word rather than a person's name.

// Common words that are NEVER part of a real person's name
const NAME_STOP_WORDS = new Set([
  // conjunctions, prepositions, articles, pronouns
  'and', 'or', 'the', 'a', 'an', 'is', 'are', 'was', 'were', 'has', 'had', 'have', 'his', 'her',
  'he', 'she', 'they', 'their', 'them', 'who', 'whom', 'whose', 'which', 'that', 'this',
  'these', 'those', 'with', 'from', 'into', 'for', 'not', 'but', 'yet', 'nor', 'also', 'very',
  'just', 'will', 'can', 'may', 'our', 'your', 'its', 'at', 'by', 'in', 'of', 'on', 'to', 'up',
  'out', 'off', 'if', 'so', 'do', 'did', 'does', 'been', 'being', 'be', 'would', 'could',
  'should', 'shall', 'might', 'must', 'am', 'about', 'over', 'under', 'after', 'before',
  'between', 'through', 'during', 'each', 'every', 'all', 'both', 'few', 'more', 'most',
  'other', 'some', 'such', 'no', 'only', 'own', 'same', 'than', 'too', 'then', 'as', 'once',
  'here', 'there', 'when', 'where', 'why', 'how', 'what', 'we', 'us', 'my', 'me', 'myself',
  'him', 'himself', 'herself', 'itself', 'ourselves', 'themselves',
  // titles/credentials (should not appear mid-name)
  'dr', 'dds', 'dmd',
  // common verbs found near doctor names in prose
  'keeps', 'graduated', 'earned', 'enjoys', 'lives', 'practices', 'trained', 'studied',
  'received', 'completed', 'attended', 'joined', 'founded', 'established', 'offers',
  'provides', 'specializes', 'focuses', 'believes', 'ensures', 'delivers', 'started',
  'began', 'brought', 'moved', 'opened', 'worked', 'served', 'helped', 'treated', 'cared',
  'committed', 'dedicated', 'passionate', 'experienced', 'known', 'recognized',
  'practicing', 'serving', 'caring', 'leading', 'trusted',
  // dental/business context words
  'board', 'certified', 'licensed', 'premier', 'best', 'top', 'rated', 'reviewed',
  'recommended', 'team', 'staff', 'family', 'office', 'clinic', 'practice', 'dental',
  'dentistry', 'center', 'group', 'associates', 'welcome', 'contact', 'call', 'visit',
  'schedule', 'appointment', 'today', 'now', 'new', 'patients', 'accepting', 'please',
  'click', 'learn', 'read', 'view', 'see', 'get', 'find', 'meet', 'discover', 'explore',
  'come', 'make', 'take',
  // adjectives/descriptors commonly near names
  'outstanding', 'excellent', 'amazing', 'wonderful', 'beautiful', 'incredible',
  'fantastic', 'exceptional', 'great', 'good', 'perfect', 'awesome', 'terrific',
  'remarkable', 'impressive', 'brilliant', 'superb', 'magnificent', 'marvelous',
  'lovely', 'kind', 'gentle', 'friendly', 'professional', 'thorough', 'careful',
  'attentive', 'knowledgeable', 'skilled', 'talented', 'gifted', 'warm', 'sweet',
  'nice', 'best', 'worst', 'better', 'worse'
]);

// Suffix patterns that indicate a common English word, NOT a name part
// e.g. "making", "outstanding", "graduated", "beautiful", "impressive"
const NON_NAME_SUFFIXES = /(?:ing|tion|sion|ment|ness|ful|ous|ive|ble|ible|ally|ized|ised|ated|edly|ence|ance|ity|ical|ular|ward|wise|like|able|less|ship|ling|ster)$/i;

// Check if a word could plausibly be part of a person's name
function isNameWord(word) {
  const w = word.toLowerCase();
  // Reject stop words
  if (NAME_STOP_WORDS.has(w)) return false;
  // Reject words with common English suffixes (catches "making", "outstanding",
  // "graduated", "beautiful", "impressive", "recommendation", etc.)
  if (w.length > 4 && NON_NAME_SUFFIXES.test(w)) return false;
  // Reject very short words (1 char) unless they could be initials
  if (w.length === 1 && !/^[a-z]$/i.test(w)) return false;
  return true;
}

function sanitizeDoctorName(name) {
  if (!name) return null;
  let clean = name.trim();
  // Remove surrounding quotes
  clean = clean.replace(/^["']+|["']+$/g, '');
  // Split into words
  const allWords = clean.split(/\s+/);
  // LEFT-TO-RIGHT scanning: accept title + name parts, stop at first non-name word
  const accepted = [];
  for (const word of allWords) {
    // Always accept "Dr." / "Dr" as the title prefix
    if (/^dr\.?$/i.test(word)) { accepted.push(word); continue; }
    // If this word looks like a name part, accept it
    if (isNameWord(word)) {
      accepted.push(word);
    } else {
      // First non-name word → stop accepting (rest is sentence fragment)
      break;
    }
  }
  clean = accepted.join(' ');
  // Must have at least a real name after "Dr."
  const nameOnly = clean.replace(/^dr\.?\s*/i, '').trim();
  if (nameOnly.length < 2) return null;
  // Reject names that are too long (probably a sentence fragment)
  if (clean.length > 60) return null;
  // Reject names with numbers
  if (/\d/.test(clean)) return null;
  // Limit to at most 4 name parts after "Dr." (first, middle, last, suffix)
  const nameParts = nameOnly.split(/\s+/);
  if (nameParts.length > 4) return null;
  return clean;
}

// --- Doctor Deduplication ---
// Checks if a new name is a duplicate of an existing doctor in the list.
// Handles case differences and partial names (e.g. "Dr. bagai" vs "Dr. Lori Bagai")
function isDuplicateDoctor(existingDoctors, newName) {
  const newLower = newName.toLowerCase().replace(/^dr\.?\s*/i, '').trim();
  const newParts = newLower.split(/\s+/);
  for (const doc of existingDoctors) {
    const existLower = doc.name.toLowerCase().replace(/^dr\.?\s*/i, '').trim();
    const existParts = existLower.split(/\s+/);
    // Exact match (case-insensitive)
    if (newLower === existLower) return doc;
    // One name contains the other ("bagai" found in "lori bagai")
    if (existLower.includes(newLower) || newLower.includes(existLower)) return doc;
    // Surname match: last word of one matches last word of the other
    if (newParts[newParts.length - 1] === existParts[existParts.length - 1]) return doc;
  }
  return null;
}

// When a duplicate is found, keep the longer (more complete) name
function mergeDoctor(existing, newDoc) {
  // Keep whichever name is longer (more complete)
  if (newDoc.name.length > existing.name.length) {
    existing.name = newDoc.name;
  }
  // Merge any missing fields from the new entry
  if (!existing.jobTitle && newDoc.jobTitle) existing.jobTitle = newDoc.jobTitle;
  if (!existing.url && newDoc.url) existing.url = newDoc.url;
  if (!existing.npi && newDoc.npi) existing.npi = newDoc.npi;
  if (newDoc.sameAs && newDoc.sameAs.length > 0) {
    const merged = new Set([...existing.sameAs, ...newDoc.sameAs]);
    existing.sameAs = [...merged];
  }
}

// --- Doctor Extraction ---
function extractDoctors(doc, schemas, bodyText) {
  const doctors = [];

  // From schema
  for (const s of schemas) {
    if (s['@type'] === 'Person' || s['@type'] === 'Physician') {
      const cleanName = sanitizeDoctorName(s.name);
      if (cleanName) {
        const newDoc = {
          name: cleanName,
          jobTitle: sanitizeJobTitle(s.jobTitle),
          url: s.url || null,
          sameAs: s.sameAs ? (Array.isArray(s.sameAs) ? s.sameAs : [s.sameAs]) : [],
          npi: null
        };
        const dup = isDuplicateDoctor(doctors, cleanName);
        if (dup) { mergeDoctor(dup, newDoc); }
        else { doctors.push(newDoc); }
      }
    }
    // Also check employee field
    if (s.employee) {
      const emps = Array.isArray(s.employee) ? s.employee : [s.employee];
      emps.forEach(e => {
        const cleanName = sanitizeDoctorName(e.name);
        if (cleanName) {
          const newDoc = {
            name: cleanName,
            jobTitle: sanitizeJobTitle(e.jobTitle),
            url: e.url || null,
            sameAs: e.sameAs ? (Array.isArray(e.sameAs) ? e.sameAs : [e.sameAs]) : [],
            npi: null
          };
          const dup = isDuplicateDoctor(doctors, cleanName);
          if (dup) { mergeDoctor(dup, newDoc); }
          else { doctors.push(newDoc); }
        }
      });
    }
  }

  // From meta author
  if (doctors.length === 0) {
    const metaAuthor = doc.querySelector('meta[name="author"]');
    if (metaAuthor && metaAuthor.content) {
      const cleanName = sanitizeDoctorName(metaAuthor.content);
      if (cleanName) {
        doctors.push({ name: cleanName, jobTitle: null, url: null, sameAs: [], npi: null });
      }
    }
  }

  // From common selectors
  if (doctors.length === 0) {
    const drSelectors = ['.doctor', '.dentist', '.team-member', '[class*="doctor"]', '[class*="dentist"]', '.provider', '.staff-member'];
    for (const sel of drSelectors) {
      doc.querySelectorAll(sel).forEach(el => {
        const nameEl = el.querySelector('h2, h3, h4, .name, [class*="name"]') || el;
        const rawName = nameEl.textContent.trim();
        const cleanName = sanitizeDoctorName(rawName);
        if (cleanName && !isDuplicateDoctor(doctors, cleanName)) {
          const titleEl = el.querySelector('.title, .position, [class*="title"], [class*="position"]');
          doctors.push({
            name: cleanName, jobTitle: sanitizeJobTitle(titleEl ? titleEl.textContent.trim() : null),
            url: null, sameAs: [], npi: null
          });
        }
      });
      if (doctors.length > 0) break;
    }
  }

  // Look for "Dr." pattern in page text
  if (doctors.length === 0) {
    // Match "Dr." followed by 1-3 capitalized name parts, but exclude stop words
    const drMatch = bodyText.match(/dr\.?\s+[a-z]+(?:\s+[a-z]+){0,2}/gi);
    if (drMatch) {
      drMatch.slice(0, 5).forEach(m => {
        const rawName = m.replace(/^dr\.?\s*/i, 'Dr. ').trim();
        const cleanName = sanitizeDoctorName(rawName);
        if (cleanName && !isDuplicateDoctor(doctors, cleanName)) {
          doctors.push({ name: cleanName, jobTitle: null, url: null, sameAs: [], npi: null });
        }
      });
    }
  }

  // Try to detect NPI
  const npiMatch = bodyText.match(/npi[:\s#]*(\d{10})/i);
  if (npiMatch && doctors.length > 0) {
    doctors[0].npi = npiMatch[1];
  }

  return doctors;
}

// --- Date Extraction ---
function extractDates(doc, schemas) {
  let published = null, modified = null;
  for (const s of schemas) {
    if (s.datePublished) published = s.datePublished;
    if (s.dateModified) modified = s.dateModified;
  }
  if (!published) {
    const mp = doc.querySelector('meta[property="article:published_time"]') || doc.querySelector('meta[name="date"]');
    if (mp) published = mp.content;
  }
  if (!modified) {
    const mm = doc.querySelector('meta[property="article:modified_time"]') || doc.querySelector('meta[property="og:updated_time"]');
    if (mm) modified = mm.content;
  }
  if (!published) {
    const timeEl = doc.querySelector('time[datetime]');
    if (timeEl) published = timeEl.getAttribute('datetime');
  }
  return { published: toIso(published), modified: toIso(modified) };
}

function toIso(dateStr) {
  if (!dateStr) return null;
  try { const d = new Date(dateStr); return isNaN(d.getTime()) ? dateStr : d.toISOString(); }
  catch { return dateStr; }
}

// --- Description ---
function extractDescription(doc, schemas) {
  for (const s of schemas) {
    if (s.description) return s.description;
  }
  const ogDesc = doc.querySelector('meta[property="og:description"]');
  if (ogDesc && ogDesc.content) return ogDesc.content.trim();
  const metaDesc = doc.querySelector('meta[name="description"]');
  if (metaDesc && metaDesc.content) return metaDesc.content.trim();
  return null;
}

// --- Description Sanitization ---
// Detects and rejects marketing filler, address repetition, welcome intros,
// and cut-off sentences that lower AEO content quality.
const MARKETING_FILLER = /^(welcome\s+to|at\s+\w+,\s+we|our\s+(team|office|practice)\s+(is|are|offers)|we\s+(are|offer|provide|specialize)|located\s+at|visit\s+(us|our)|call\s+(us|today)|schedule\s+(your|an?)|contact\s+us|learn\s+more|in\s+this\s+guide|book\s+(your|an?)|experience\s+the|discover\s+(how|the|our)|find\s+out)/i;
const ADDRESS_PATTERN = /^[\w\s]+is\s+(a\s+)?dental\s+(office|practice|clinic)\s+(in|located)/i;

function sanitizeDescription(text, serviceName) {
  if (!text) return null;
  let clean = text.trim();
  // Reject if it's primarily about the business location, not the procedure
  if (ADDRESS_PATTERN.test(clean)) return null;
  // Reject if it starts with marketing filler
  if (MARKETING_FILLER.test(clean)) return null;
  // Reject if it contains pricing/promotional text
  if (JUNK_TEXT_PATTERNS.test(clean)) return null;
  // Strip trailing ellipsis (indicates clipped content)
  clean = clean.replace(/\.{2,}\s*$/, '').trim();
  // Ensure it ends with proper punctuation
  if (clean.length > 0 && !/[.!?]$/.test(clean)) {
    // Try to find the last complete sentence
    const lastPeriod = clean.lastIndexOf('.');
    if (lastPeriod > clean.length * 0.4) {
      clean = clean.slice(0, lastPeriod + 1);
    } else {
      clean += '.';
    }
  }
  // Must be meaningful length
  if (clean.length < 30) return null;
  return clean;
}

// --- Image ---
function extractImage(doc, schemas, domain) {
  for (const s of schemas) {
    if (s.image) {
      if (typeof s.image === 'string') return resolveUrl(s.image, domain);
      if (s.image.url) return resolveUrl(s.image.url, domain);
    }
  }
  const ogImage = doc.querySelector('meta[property="og:image"]');
  if (ogImage && ogImage.content) return resolveUrl(ogImage.content.trim(), domain);
  return null;
}

function resolveUrl(url, base) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  try { return new URL(url, base).href; } catch { return url; }
}

// --- Practice Details ---
function extractPracticeDetails(doc, schemas, domain, hostname, practiceName, bodyText) {
  let logo = null, url = domain, sameAs = [], phone = null, address = null, email = null, geo = null;

  for (const s of schemas) {
    if (['Dentist', 'LocalBusiness', 'Organization', 'MedicalBusiness'].includes(s['@type']) || s.publisher) {
      const src = s.publisher || s;
      if (src.logo) logo = typeof src.logo === 'string' ? src.logo : src.logo.url;
      if (src.sameAs) sameAs = Array.isArray(src.sameAs) ? src.sameAs : [src.sameAs];
      if (src.telephone) phone = src.telephone;
      if (src.email) email = src.email;
      if (src.address) {
        if (typeof src.address === 'string') address = src.address;
        else {
          const a = src.address;
          address = [a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode].filter(Boolean).join(', ');
        }
      }
      // Geo from schema
      if (src.geo) {
        geo = { lat: src.geo.latitude, lng: src.geo.longitude };
      }
    }
  }

  // Geo from Google Maps embed
  if (!geo) {
    const mapIframe = doc.querySelector('iframe[src*="google.com/maps"], iframe[src*="maps.google"]');
    if (mapIframe) {
      const src = mapIframe.getAttribute('src') || '';
      const llMatch = src.match(/!2d(-?[\d.]+)!3d(-?[\d.]+)/) || src.match(/q=(-?[\d.]+),(-?[\d.]+)/);
      if (llMatch) geo = { lat: parseFloat(llMatch[2] || llMatch[1]), lng: parseFloat(llMatch[1] || llMatch[2]) };
    }
  }

  // Social profile links (sameAs) from page
  if (sameAs.length === 0) {
    const socialPatterns = [
      /facebook\.com\//i, /instagram\.com\//i, /yelp\.com\//i,
      /linkedin\.com\//i, /youtube\.com\//i, /twitter\.com\//i,
      /x\.com\//i, /tiktok\.com\//i, /pinterest\.com\//i,
      /healthgrades\.com\//i, /zocdoc\.com\//i, /realself\.com\//i
    ];
    const seen = new Set();
    doc.querySelectorAll('a[href]').forEach(a => {
      const href = a.getAttribute('href');
      if (!href) return;
      try {
        const u = new URL(href, domain);
        if (u.origin !== domain && socialPatterns.some(p => p.test(u.href)) && !seen.has(u.origin)) {
          seen.add(u.origin);
          sameAs.push(u.href);
        }
      } catch { }
    });
  }

  // Phone from page
  if (!phone) {
    const phoneMatch = bodyText.match(/(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/);
    if (phoneMatch) phone = phoneMatch[1];
    const telLink = doc.querySelector('a[href^="tel:"]');
    if (telLink) phone = telLink.href.replace('tel:', '').trim();
  }

  // Email from page
  if (!email) {
    const mailLink = doc.querySelector('a[href^="mailto:"]');
    if (mailLink) email = mailLink.href.replace('mailto:', '').trim();
  }

  return { name: practiceName, logo: logo ? resolveUrl(logo, domain) : null, url, sameAs, phone, address, email, geo };
}

// --- Specialty Detection ---
function detectSpecialties(h1, h2s, bodyText, schemas) {
  const found = new Set();
  for (const s of schemas) {
    if (s.medicalSpecialty) {
      (Array.isArray(s.medicalSpecialty) ? s.medicalSpecialty : [s.medicalSpecialty]).forEach(sp => found.add(sp));
    }
  }
  const allText = [h1, ...h2s, bodyText].join(' ');
  DENTAL_SPECIALTIES.forEach(sp => {
    if (sp.pattern.test(allText)) found.add(sp.value);
  });
  if (found.size === 0) found.add('http://schema.org/Dentistry');
  return [...found];
}

// --- Service Mapping (H2s → Service entities) ---
function mapDentalServices(h2s, bodyText) {
  const services = [];
  const allText = h2s.join(' ') + ' ' + bodyText;
  DENTAL_SERVICES.forEach(svc => {
    if (svc.pattern.test(allText)) {
      services.push({ name: svc.name, description: svc.desc });
    }
  });
  return services;
}

// --- FAQ Extraction ---
function extractFaqs(doc, schemas) {
  const faqs = [];

  for (const s of schemas) {
    if (s['@type'] === 'FAQPage' && s.mainEntity) {
      const items = Array.isArray(s.mainEntity) ? s.mainEntity : [s.mainEntity];
      items.forEach(item => {
        const answer = (item.acceptedAnswer?.text || '').trim();
        if (item.name && answer.length > 10 && !isFaqAnswerJunk(answer)) {
          faqs.push({ question: item.name, answer });
        }
      });
    }
  }
  if (faqs.length > 0) return faqs;

  doc.querySelectorAll('details').forEach(d => {
    const summary = d.querySelector('summary');
    if (summary) {
      const answer = d.textContent.replace(summary.textContent, '').trim();
      if (answer.length > 10 && !isFaqAnswerJunk(answer)) {
        faqs.push({ question: summary.textContent.trim(), answer });
      }
    }
  });
  if (faqs.length > 0) return faqs;

  const faqContainers = doc.querySelectorAll('[class*="faq"], [id*="faq"], [class*="FAQ"], [id*="FAQ"], [class*="accordion"]');
  faqContainers.forEach(container => {
    container.querySelectorAll('h3, h4, dt, [class*="question"], button').forEach(q => {
      const answerEl = q.nextElementSibling;
      if (answerEl) {
        const answer = answerEl.textContent.trim();
        if (answer.length > 10 && !isFaqAnswerJunk(answer)) {
          faqs.push({ question: q.textContent.trim(), answer });
        }
      }
    });
  });

  return faqs.slice(0, 10);
}

// --- Amenity Detection ---
function detectAmenities(bodyText) {
  return AMENITY_PATTERNS.filter(a => a.pattern.test(bodyText)).map(a => a.name);
}

// --- Language Detection ---
function detectLanguages(bodyText) {
  const langs = ['English'];
  const langPatterns = [
    { pattern: /\bspanish|español|habla\s*español/i, lang: 'Spanish' },
    { pattern: /\bmandarin|chinese|中文/i, lang: 'Mandarin' },
    { pattern: /\bvietnamese|tiếng việt/i, lang: 'Vietnamese' },
    { pattern: /\bkorean|한국어/i, lang: 'Korean' },
    { pattern: /\bportuguese|português/i, lang: 'Portuguese' },
    { pattern: /\bfrench|français/i, lang: 'French' },
    { pattern: /\barabic|العربية/i, lang: 'Arabic' },
    { pattern: /\brussian|русский/i, lang: 'Russian' },
    { pattern: /\bhindi|हिन्दी/i, lang: 'Hindi' },
    { pattern: /\btagalog|filipino/i, lang: 'Tagalog' },
  ];
  langPatterns.forEach(lp => {
    if (lp.pattern.test(bodyText)) langs.push(lp.lang);
  });
  return langs;
}

// --- Payment / Insurance Detection ---
function detectPayment(bodyText) {
  const methods = [];
  if (/visa|mastercard|credit\s*card|amex|american\s*express/i.test(bodyText)) methods.push('Credit Cards');
  if (/cash/i.test(bodyText)) methods.push('Cash');
  if (/check/i.test(bodyText)) methods.push('Check');
  if (/carecredit/i.test(bodyText)) methods.push('CareCredit');
  if (/financing|payment\s*plan/i.test(bodyText)) methods.push('Financing Available');
  if (/insur/i.test(bodyText)) methods.push('Insurance Accepted');
  return methods;
}

// --- Accepting New Patients ---
function detectAcceptingPatients(bodyText) {
  if (/accepting\s*(new\s*)?patients|new\s*patients?\s*(welcome|accepted)/i.test(bodyText)) return true;
  if (/not\s*accepting\s*(new\s*)?patients/i.test(bodyText)) return false;
  return null; // unknown
}

// --- Opening Hours ---
function extractHours(doc, schemas, bodyText) {
  for (const s of schemas) {
    if (s.openingHoursSpecification) return s.openingHoursSpecification;
    if (s.openingHours) {
      const specs = Array.isArray(s.openingHours) ? s.openingHours : [s.openingHours];
      return specs;
    }
  }
  return null;
}

// --- External Links ---
function extractExternalLinks(doc, domain) {
  const links = [];
  const seen = new Set();
  doc.querySelectorAll('a[href]').forEach(a => {
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
    try {
      const u = new URL(href, domain);
      if (u.origin !== domain && !seen.has(u.href)) {
        seen.add(u.href);
        links.push({ url: u.href, text: a.textContent.trim() || u.hostname });
      }
    } catch { }
  });
  return links.slice(0, 15);
}

// --- Last Reviewed Detection ---
function detectLastReviewed(doc, bodyText) {
  const match = bodyText.match(/(?:last\s*)?reviewed?\s*(?:on|:)?\s*(\w+\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2})/i);
  if (match) return toIso(match[1]);
  const metaReview = doc.querySelector('meta[name="last-reviewed"]') || doc.querySelector('meta[name="review-date"]');
  if (metaReview) return toIso(metaReview.content);
  return null;
}

// --- Answer Text (with content sanitization) ---
const JUNK_TEXT_PATTERNS = /terms\s*(and|&)\s*conditions|privacy\s*policy|cookie\s*(policy|consent|notice)|i\s*agree|opt.?out|unsubscribe|all\s*rights\s*reserved|copyright\s*©|disclaimer|gdpr|ccpa|do\s*not\s*sell|california\s*consumer|automated|by\s*(clicking|submitting|checking|continuing)|consent\s*to|we\s*use\s*cookies|accept\s*all|manage\s*preferences|third.?party|data\s*processing|personal\s*information\s*act|arbitration|indemnif|liability|warrant|new\s*patients?\s*only|excludes?\b|not\s*included|special\s*offer|limited\s*time|call\s*(for|to)\s*(details|pricing|more)|\$\d+|\bfree\b.*\bconsult|insurance\s*(accept|verif|appli)|financing\s*available|payment\s*plan|coupon|promo(tion)?|cannot\s*be\s*combined|restrictions?\s*apply|subject\s*to|valid\s*(through|until|for)|sms\s*(notif|opt|consent|message)|text\s*message|receive\s*(sms|text|message)|opt.?in\s*to|message\s*and\s*data\s*rates|msg\s*&\s*data|reply\s*stop|mobile\s*number|zip\s*code.*phone|phone.*email.*zip|name\s+phone\s+email|new\s*patient\s*(yes|no)|submit\s*(form|request|button)|form\s*submission|captcha|recaptcha|i\s*consent|by\s*providing|standard\s*rates?\s*may/i;

// Specific junk patterns for FAQ answers (form fields, contact forms, navigation)
const FAQ_ANSWER_JUNK = /^(name|phone|email|address|zip|city|state|date|submit|send|yes|no|select|choose|enter|required|optional|\*|first\s*name|last\s*name|new\s*patient)/i;

// Check if FAQ answer text is actually form/junk content
function isFaqAnswerJunk(text) {
  if (!text || text.trim().length < 15) return true;
  const t = text.trim();
  // Reject if it matches known junk patterns
  if (JUNK_TEXT_PATTERNS.test(t)) return true;
  // Reject if it starts with form field labels
  if (FAQ_ANSWER_JUNK.test(t)) return true;
  // Reject if it looks like a form (multiple form field keywords in sequence)
  const formSignals = (t.match(/\b(name|phone|email|zip|address|date|submit|consent|yes|no|required|optional|patient|message)\b/gi) || []).length;
  if (formSignals >= 3 && t.length < 200) return true;
  // Reject if mostly non-sentence content (form fragments)
  const words = t.split(/\s+/);
  const shortWords = words.filter(w => w.length <= 2).length;
  if (shortWords > words.length * 0.4 && words.length > 5) return true;
  return false;
}

// Elements that typically contain junk text
const JUNK_SELECTORS = 'footer, [class*="cookie"], [class*="consent"], [class*="legal"], [class*="disclaimer"], [class*="privacy"], [class*="terms"], [id*="cookie"], [id*="consent"], [id*="modal"], [class*="modal"], [class*="popup"], [class*="banner"], [class*="notice"], form, nav, [role="navigation"], [role="banner"], [class*="footer"], [class*="form"], [class*="contact-form"], [class*="opt-in"], [class*="sms"], [id*="form"], [class*="widget"]';

function extractAnswerText(doc) {
  const article = doc.querySelector('article') || doc.querySelector('[role="main"]') || doc.querySelector('main') || doc.body;
  if (!article) return '';

  // Build a set of elements to exclude
  const junkEls = new Set();
  article.querySelectorAll(JUNK_SELECTORS).forEach(el => {
    el.querySelectorAll('p').forEach(p => junkEls.add(p));
    junkEls.add(el);
  });

  return Array.from(article.querySelectorAll('p'))
    .filter(p => !junkEls.has(p))
    .map(p => p.textContent.trim())
    .filter(t => t.length > 50 && !JUNK_TEXT_PATTERNS.test(t))
    .slice(0, 3).join(' ').slice(0, 500);
}

// --- Video Extraction ---
function extractVideos(doc, schemas, domain) {
  const videos = [];
  const seen = new Set();

  // 1. Existing VideoObject in JSON-LD
  for (const s of schemas) {
    if (s['@type'] === 'VideoObject' && s.name) {
      const key = s.contentUrl || s.embedUrl || s.name;
      if (!seen.has(key)) {
        seen.add(key);
        videos.push({
          name: s.name,
          description: s.description || '',
          thumbnailUrl: s.thumbnailUrl || '',
          contentUrl: s.contentUrl || '',
          embedUrl: s.embedUrl || '',
          uploadDate: s.uploadDate || '',
          duration: s.duration || ''
        });
      }
    }
  }

  // 2. YouTube iframes
  doc.querySelectorAll('iframe[src*="youtube.com"], iframe[src*="youtu.be"], iframe[data-src*="youtube.com"]').forEach(iframe => {
    const src = iframe.src || iframe.dataset.src || '';
    const match = src.match(/(?:embed\/|v\/|v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    if (match && !seen.has(match[1])) {
      seen.add(match[1]);
      const videoId = match[1];
      const title = iframe.getAttribute('title') || iframe.getAttribute('aria-label') || 'Video';
      videos.push({
        name: title,
        description: '',
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        contentUrl: `https://www.youtube.com/watch?v=${videoId}`,
        embedUrl: `https://www.youtube.com/embed/${videoId}`,
        uploadDate: '',
        duration: ''
      });
    }
  });

  // 3. Vimeo iframes
  doc.querySelectorAll('iframe[src*="vimeo.com"], iframe[data-src*="vimeo.com"]').forEach(iframe => {
    const src = iframe.src || iframe.dataset.src || '';
    const match = src.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (match && !seen.has(match[1])) {
      seen.add(match[1]);
      const title = iframe.getAttribute('title') || iframe.getAttribute('aria-label') || 'Video';
      videos.push({
        name: title,
        description: '',
        thumbnailUrl: '',
        contentUrl: `https://vimeo.com/${match[1]}`,
        embedUrl: `https://player.vimeo.com/video/${match[1]}`,
        uploadDate: '',
        duration: ''
      });
    }
  });

  // 4. HTML5 <video> elements
  doc.querySelectorAll('video').forEach(vid => {
    const src = vid.src || vid.querySelector('source')?.src || '';
    if (src && !seen.has(src)) {
      seen.add(src);
      const resolvedSrc = src.startsWith('http') ? src : domain + (src.startsWith('/') ? '' : '/') + src;
      videos.push({
        name: vid.getAttribute('title') || vid.getAttribute('aria-label') || 'Video',
        description: '',
        thumbnailUrl: vid.poster || '',
        contentUrl: resolvedSrc,
        embedUrl: '',
        uploadDate: '',
        duration: ''
      });
    }
  });

  return videos.slice(0, 5);
}

// --- Article / Blog Post Data Extraction ---
function extractArticleData(doc, schemas, bodyText) {
  // 1. Check existing Article/BlogPosting schema
  for (const s of schemas) {
    if (s['@type'] === 'Article' || s['@type'] === 'BlogPosting' || s['@type'] === 'NewsArticle') {
      return {
        type: s['@type'],
        headline: s.headline || s.name || '',
        author: typeof s.author === 'string' ? s.author : (s.author?.name || ''),
        datePublished: s.datePublished || '',
        dateModified: s.dateModified || '',
        wordCount: s.wordCount || 0,
        articleBody: (s.articleBody || '').slice(0, 500)
      };
    }
  }

  // 2. Detect from DOM structure
  const article = doc.querySelector('article');
  if (!article) return null;

  const headline = article.querySelector('h1, h2')?.textContent?.trim() || '';
  if (!headline) return null;

  // Author detection
  let author = '';
  const authorEl = doc.querySelector('[rel="author"], .author, .byline, [class*="author"], [itemprop="author"]');
  if (authorEl) author = authorEl.textContent.trim().replace(/^by\s+/i, '');

  // Date detection
  const timeEl = article.querySelector('time[datetime]') || doc.querySelector('time[datetime]');
  const datePublished = timeEl?.getAttribute('datetime') || '';

  // Word count from article body
  const articleText = article.textContent || '';
  const wc = articleText.split(/\s+/).filter(Boolean).length;

  return {
    type: 'BlogPosting',
    headline,
    author,
    datePublished,
    dateModified: '',
    wordCount: wc,
    articleBody: articleText.trim().slice(0, 500)
  };
}

// --- HowTo Steps Extraction ---
function extractHowToSteps(doc) {
  const steps = [];
  // Look for ordered lists inside main content areas
  const main = doc.querySelector('article') || doc.querySelector('[role="main"]') || doc.querySelector('main') || doc.body;
  if (!main) return steps;

  const orderedLists = main.querySelectorAll('ol');
  for (const ol of orderedLists) {
    // Skip navigational/junk lists
    const parent = ol.parentElement;
    if (parent && /nav|footer|sidebar|menu|breadcrumb|toc|table-of-contents/i.test(parent.className + ' ' + (parent.id || ''))) continue;

    const items = ol.querySelectorAll(':scope > li');
    if (items.length < 2 || items.length > 20) continue;

    // Check if the content near this list is procedural (dental/medical)
    const prevEl = ol.previousElementSibling;
    const contextText = (prevEl?.textContent || '') + ' ' + ol.textContent;
    const isProcedural = /step|process|procedure|how|treatment|method|first|then|next|prepare|place|apply|clean|exam|numb|anesthet/i.test(contextText);
    if (!isProcedural) continue;

    items.forEach((li, i) => {
      const text = li.textContent.trim();
      if (text.length > 10 && text.length < 500) {
        // Try to separate step name from description
        const colonSplit = text.match(/^([^:]{5,60}):\s*(.+)$/s);
        if (colonSplit) {
          steps.push({ position: i + 1, name: colonSplit[1].trim(), text: colonSplit[2].trim() });
        } else {
          const firstSentence = text.match(/^([^.!?]{10,80}[.!?])/);
          steps.push({
            position: i + 1,
            name: firstSentence ? firstSentence[1] : text.slice(0, 80),
            text: text
          });
        }
      }
    });

    if (steps.length >= 2) break; // Use first valid procedural list
  }

  return steps.slice(0, 10);
}

// --- Membership Detection ---
function detectMemberships(bodyText) {
  const orgs = [];
  if (/\bADA\b|american\s*dental\s*association/i.test(bodyText)) orgs.push({ name: 'American Dental Association', url: 'https://www.ada.org' });
  if (/\bAACD\b|american\s*academy\s*of\s*cosmetic\s*dentistry/i.test(bodyText)) orgs.push({ name: 'American Academy of Cosmetic Dentistry', url: 'https://www.aacd.com' });
  if (/\bAAO\b|american\s*association\s*of\s*orthodont/i.test(bodyText)) orgs.push({ name: 'American Association of Orthodontists', url: 'https://www.aaoinfo.org' });
  if (/\bAGD\b|academy\s*of\s*general\s*dentistry/i.test(bodyText)) orgs.push({ name: 'Academy of General Dentistry', url: 'https://www.agd.org' });
  if (/\bGDC\b|general\s*dental\s*council/i.test(bodyText)) orgs.push({ name: 'General Dental Council', url: 'https://www.gdc-uk.org' });
  return orgs;
}

// --- Aggregate Rating Extraction ---
function extractAggregateRating(doc, schemas) {
  // 1. From existing schema.org markup
  for (const s of schemas) {
    if (s.aggregateRating) {
      const r = s.aggregateRating;
      if (r.ratingValue) {
        return {
          '@type': 'AggregateRating',
          'ratingValue': String(r.ratingValue),
          'bestRating': r.bestRating ? String(r.bestRating) : '5',
          'reviewCount': r.reviewCount ? String(r.reviewCount) : (r.ratingCount ? String(r.ratingCount) : undefined)
        };
      }
    }
  }

  // 2. From common review widget patterns in the page
  const bodyText = doc.body ? doc.body.textContent : '';
  const ratingMatch = bodyText.match(/(\d\.\d)\s*(?:out\s*of\s*5|stars?|rating|★)/i);
  const reviewMatch = bodyText.match(/(\d{1,5})\s*(?:reviews?|ratings?|testimonials?)/i);
  if (ratingMatch) {
    const rating = {
      '@type': 'AggregateRating',
      'ratingValue': ratingMatch[1],
      'bestRating': '5'
    };
    if (reviewMatch) rating.reviewCount = reviewMatch[1];
    return rating;
  }

  return null;
}

// --- Review Extraction ---
function extractReviews(doc, schemas) {
  const reviews = [];

  // 1. Try existing schema data first
  for (const s of schemas) {
    if (s['@type'] === 'Review' && s.reviewBody && s.author) {
      const authorName = typeof s.author === 'string' ? s.author : (s.author.name || 'Anonymous');
      reviews.push({
        author: authorName,
        text: s.reviewBody,
        rating: s.reviewRating ? (s.reviewRating.ratingValue || 5) : 5
      });
    }
  }

  // 2. Try to extract from page DOM (testimonial blocks)
  if (reviews.length === 0) {
    const testimonialSelectors = [
      '.testimonial', '.review', '.review-item', '.testimonial-item',
      '[class*="testimonial"]', '[class*="review-card"]',
      '.reviews-slider .slide', '.review-block'
    ];
    for (const sel of testimonialSelectors) {
      const items = doc.querySelectorAll(sel);
      if (items.length > 0) {
        items.forEach(item => {
          const textEl = item.querySelector('p, .review-text, .testimonial-text, blockquote');
          const authorEl = item.querySelector('.author, .reviewer, .name, cite, strong');
          if (textEl && textEl.textContent.trim().length > 30) {
            reviews.push({
              author: authorEl ? authorEl.textContent.trim() : 'Patient',
              text: textEl.textContent.trim().slice(0, 300),
              rating: 5
            });
          }
        });
        break;
      }
    }
  }

  return reviews.slice(0, 3);
}

// --- Truncate to sentence boundary ---
function truncateToSentence(text, maxLen) {
  if (!text || text.length <= maxLen) return text;
  // Find the last sentence end before maxLen
  const truncated = text.slice(0, maxLen);
  const lastSentence = truncated.lastIndexOf('.');
  if (lastSentence > maxLen * 0.4) {
    return truncated.slice(0, lastSentence + 1);
  }
  // Never use ellipsis — find last space instead for a clean break
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLen * 0.4) {
    return truncated.slice(0, lastSpace) + '.';
  }
  return truncated + '.';
}

// --- Price Range ---
function detectPriceRange(bodyText, schemas) {
  for (const s of schemas) {
    if (s.priceRange) return s.priceRange;
  }
  if (/affordable|budget|low.cost/i.test(bodyText)) return '$';
  if (/premium|luxury|exclusive/i.test(bodyText)) return '$$$';
  return '$$';
}

// ─── JSON-LD Generation (Page-Type-Aware) ──────────────────
function generateDentalJsonLd(entities, pageUrl) {
  const { pageType } = entities;

  switch (pageType) {
    case 'service': return generateServicePageSchema(entities, pageUrl);
    case 'about': return generateAboutPageSchema(entities, pageUrl);
    case 'contact': return generateContactPageSchema(entities, pageUrl);
    case 'blog': return generateBlogPostSchema(entities, pageUrl);
    default: return generateHomepageSchema(entities, pageUrl);
  }
}

// ─── Shared Node Builders ──────────────────────────────────

function buildDentistNode(entities, full = true) {
  const { domain, practice, specialties, amenities, languages, payment,
    hours, memberships, priceRange, acceptingPatients, services, doctors,
    image, cityState, streetAddress, zipCode } = entities;

  const dentistNode = {
    '@type': ['Dentist', 'MedicalClinic'],
    '@id': `${domain}/#practice`,
    'name': practice.name,
    'url': practice.url,
    'medicalSpecialty': specialties.length === 1 ? specialties[0] : specialties,
    'isAcceptingNewPatients': acceptingPatients !== null ? String(acceptingPatients).charAt(0).toUpperCase() + String(acceptingPatients).slice(1) : 'True',
    'priceRange': priceRange,
    'currenciesAccepted': 'USD'
  };

  if (practice.phone) dentistNode.telephone = practice.phone;
  if (practice.email) dentistNode.email = practice.email;

  // PostalAddress
  const addrNode = { '@type': 'PostalAddress' };
  let hasAddr = false;
  if (streetAddress) { addrNode.streetAddress = streetAddress; hasAddr = true; }
  else if (practice.address) { addrNode.streetAddress = practice.address; hasAddr = true; }
  if (cityState) {
    const parts = cityState.split(',').map(p => p.trim());
    if (parts[0]) { addrNode.addressLocality = parts[0]; hasAddr = true; }
    if (parts[1]) { addrNode.addressRegion = parts[1]; hasAddr = true; }
  }
  if (zipCode) { addrNode.postalCode = zipCode; hasAddr = true; }
  addrNode.addressCountry = 'US';
  if (hasAddr) dentistNode.address = addrNode;

  // Geo
  if (practice.geo) {
    dentistNode.geo = { '@type': 'GeoCoordinates', 'latitude': practice.geo.lat, 'longitude': practice.geo.lng };
  }

  // sameAs and hasMap
  if (practice.sameAs.length > 0) {
    dentistNode.sameAs = practice.sameAs;
    // Extract Google Maps link for hasMap
    const mapsLink = practice.sameAs.find(u => /google\.com\/maps/i.test(u));
    if (mapsLink) dentistNode.hasMap = mapsLink;
  }

  // Logo/image
  if (practice.logo) {
    dentistNode.logo = { '@type': 'ImageObject', '@id': `${domain}/#logo`, 'url': practice.logo, 'contentUrl': practice.logo };
    dentistNode.image = { '@id': `${domain}/#logo` };
  } else {
    dentistNode.image = image || `${domain}/logo.png`;
  }

  if (full) {
    // knowsAbout (replaces availableService which is not valid on Dentist)
    if (services.length > 0) {
      dentistNode.knowsAbout = services.map(svc => svc.name);
    }
    // amenityFeature
    if (amenities.length > 0) {
      dentistNode.amenityFeature = amenities.map(a => ({ '@type': 'LocationFeatureSpecification', 'name': a, 'value': true }));
    }
    // knowsLanguage
    if (languages.length > 1) dentistNode.knowsLanguage = languages;
    // paymentAccepted
    if (payment.length > 0) dentistNode.paymentAccepted = payment.join(', ');
    // openingHoursSpecification
    if (hours) dentistNode.openingHoursSpecification = hours;
    // memberOf
    if (memberships.length > 0) {
      dentistNode.memberOf = memberships.map(m => ({ '@type': 'Organization', 'name': m.name, 'url': m.url }));
    }
    // employee
    if (doctors.length > 0) {
      dentistNode.employee = doctors.map(dr => ({ '@id': `${domain}/#/schema/person/${slugify(dr.name)}` }));
    }
  }

  return dentistNode;
}

// Apply aggregateRating to a node (Dentist or Service)
function applyAggregateRating(node, entities) {
  if (entities.aggregateRating) {
    node.aggregateRating = entities.aggregateRating;
  }
}

function buildPersonNodes(entities) {
  const { domain, doctors, services, practice } = entities;
  return doctors.map(dr => {
    const personNode = {
      '@type': 'Person',
      '@id': `${domain}/#/schema/person/${slugify(dr.name)}`,
      'name': dr.name
    };
    if (dr.jobTitle) personNode.jobTitle = dr.jobTitle;
    personNode.url = dr.url || domain;
    if (practice.phone) personNode.telephone = practice.phone;
    if (dr.sameAs.length > 0) personNode.sameAs = dr.sameAs;
    if (dr.npi) personNode.identifier = { '@type': 'PropertyValue', 'propertyID': 'NPI', 'value': dr.npi };
    if (services.length > 0) personNode.knowsAbout = services.slice(0, 8).map(s => s.name);
    return personNode;
  });
}

function buildWebPageNode(entities, pageUrl, pageType) {
  const { domain, h1, description, lang, specialties, dates, lastReviewed,
    doctors, image, externalLinks, hasBeforeAfter } = entities;

  // Determine the schema @type for the page
  let schemaType;
  switch (pageType) {
    case 'about': schemaType = ['MedicalWebPage', 'AboutPage']; break;
    case 'contact': schemaType = ['MedicalWebPage', 'ContactPage']; break;
    default: schemaType = 'MedicalWebPage'; break;
  }

  const pageNode = {
    '@type': schemaType,
    '@id': `${pageUrl}/#webpage`,
    'url': pageUrl,
    'name': h1 || description || pageUrl,
    'isPartOf': { '@id': `${domain}/#website` },
    'about': { '@id': `${domain}/#practice` },
    'inLanguage': lang,
    'audience': { '@type': 'MedicalAudience', 'audienceType': 'Patient' }
  };

  if (dates.published) pageNode.datePublished = dates.published;
  if (dates.modified) pageNode.dateModified = dates.modified;
  if (description) pageNode.description = description;
  if (lastReviewed) pageNode.lastReviewed = lastReviewed;
  if (doctors.length > 0) {
    pageNode.reviewedBy = { '@id': `${domain}/#/schema/person/${slugify(doctors[0].name)}` };
  }

  // Detect page aspect
  const testText = h1 || '';
  if (/treatment|procedure|service/i.test(testText)) pageNode.aspect = 'Treatment';
  else if (/diagnos|exam|check/i.test(testText)) pageNode.aspect = 'Diagnosis';
  else if (/prevent|clean|hygien/i.test(testText)) pageNode.aspect = 'Prevention';

  // Primary Image
  const graph = [];
  if (image) {
    pageNode.primaryImageOfPage = { '@id': `${pageUrl}/#primaryimage` };
    graph.push({ '@type': 'ImageObject', '@id': `${pageUrl}/#primaryimage`, 'url': image, 'contentUrl': image });
  }

  // significantLink & isBasedOn
  const authorityLinks = externalLinks.filter(l =>
    /wikipedia|\.gov|\.edu|pubmed|ada\.org|aacd|who\.int|nih\.gov|mayoclinic|webmd|healthline/i.test(l.url)
  );
  if (authorityLinks.length > 0) {
    pageNode.significantLink = authorityLinks.map(l => l.url);
    pageNode.isBasedOn = authorityLinks.map(l => ({ '@type': 'WebPage', 'url': l.url }));
  }
  if (hasBeforeAfter) {
    pageNode.significantLink = pageNode.significantLink || [];
    pageNode.significantLink.push(`${pageUrl}#before-after`);
  }

  return { pageNode, extraNodes: graph };
}

function buildWebSiteNode(entities) {
  const { domain, practice, lang } = entities;
  return {
    '@type': 'WebSite',
    '@id': `${domain}/#website`,
    'url': domain,
    'name': practice.name,
    'publisher': { '@id': `${domain}/#practice` },
    'inLanguage': lang
  };
}

function buildVideoNodes(entities, pageUrl) {
  if (!entities.videos || entities.videos.length === 0) return [];
  const today = new Date().toISOString();
  return entities.videos.map((vid, i) => {
    const node = {
      '@type': 'VideoObject',
      '@id': `${pageUrl}/#video-${i + 1}`,
      'name': vid.name || 'Video',
      'description': vid.description || `Video from ${entities.practice?.name || 'this dental practice'}`,
      'uploadDate': vid.uploadDate || today,
      'thumbnailUrl': vid.thumbnailUrl || `${entities.domain}/video-thumbnail.jpg`
    };
    if (vid.contentUrl) node.contentUrl = vid.contentUrl;
    if (vid.embedUrl) node.embedUrl = vid.embedUrl;
    if (vid.duration) node.duration = vid.duration;
    return node;
  });
}

function buildHowToNode(entities, pageUrl) {
  if (!entities.howToSteps || entities.howToSteps.length < 2) return null;
  const serviceName = entities.serviceNameOverride || entities.h1 || 'Dental Procedure';
  return {
    '@type': 'HowTo',
    '@id': `${pageUrl}/#howto`,
    'name': `How ${serviceName} Works`,
    'description': `Step-by-step process for ${serviceName.toLowerCase()} at ${entities.practice?.name || 'our dental practice'}.`,
    'step': entities.howToSteps.map(s => ({
      '@type': 'HowToStep',
      'position': s.position,
      'name': s.name,
      'text': s.text
    }))
  };
}

function buildFaqNode(entities, pageUrl) {
  // Filter out any FAQs with empty, too-short, or junk answers
  const validFaqs = entities.faqs.filter(faq => {
    const answer = optimizeFaqAnswer(faq.answer);
    return answer && answer.length > 10 && !isFaqAnswerJunk(answer);
  });
  if (validFaqs.length === 0) return null;
  return {
    '@type': 'FAQPage',
    '@id': `${pageUrl}/#faq`,
    'mainEntity': validFaqs.map(faq => ({
      '@type': 'Question',
      'name': faq.question,
      'acceptedAnswer': { '@type': 'Answer', 'text': optimizeFaqAnswer(faq.answer) }
    }))
  };
}

function buildBreadcrumbNode(entities, pageUrl) {
  const { domain } = entities;
  const pathSegments = new URL(pageUrl).pathname.split('/').filter(Boolean);
  if (pathSegments.length === 0) return null;
  const items = [{ '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': domain }];
  pathSegments.forEach((seg, i) => {
    items.push({
      '@type': 'ListItem',
      'position': i + 2,
      'name': seg.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      'item': domain + '/' + pathSegments.slice(0, i + 1).join('/')
    });
  });
  return { '@type': 'BreadcrumbList', '@id': `${pageUrl}/#breadcrumb`, 'itemListElement': items };
}

// ─── Homepage Schema (Dentist Primary) ─────────────────────
function generateHomepageSchema(entities, pageUrl) {
  const graph = [];

  const dentistNode = buildDentistNode(entities, true);
  applyAggregateRating(dentistNode, entities);
  graph.push(dentistNode);
  graph.push(...buildPersonNodes(entities));

  const { pageNode, extraNodes } = buildWebPageNode(entities, pageUrl, 'homepage');
  graph.push(pageNode, ...extraNodes);
  graph.push(buildWebSiteNode(entities));

  const faqNode = buildFaqNode(entities, pageUrl);
  if (faqNode) graph.push(faqNode);

  const breadcrumbNode = buildBreadcrumbNode(entities, pageUrl);
  if (breadcrumbNode) graph.push(breadcrumbNode);

  // Video nodes
  const videoNodes = buildVideoNodes(entities, pageUrl);
  if (videoNodes.length > 0) graph.push(...videoNodes);

  return { '@context': 'https://schema.org', '@graph': graph };
}

// ─── Service Page Schema (MedicalProcedure Primary) ────────
function generateServicePageSchema(entities, pageUrl) {
  const { domain, h1, description, image, services, specialties, serviceNameOverride, practice } = entities;
  const graph = [];

  // Determine service name: user override → H1 → first matched service → fallback
  const serviceName = serviceNameOverride || h1 || (services.length > 0 ? services[0].name : 'Dental Service');

  // Match service description from known services
  const matchedService = DENTAL_SERVICES.find(s => s.pattern.test(serviceName));

  // --- UNIQUE descriptions per entity (prevents schema bloat) ---
  // Service description: what the service offers (marketing-facing)
  const serviceDesc = matchedService
    ? matchedService.desc
    : `Professional ${serviceName.toLowerCase()} services at ${practice.name}.`;

  // Procedure description: clinical/technical (what happens in the chair)
  // Prefer sanitized page description; fallback to a clinical generic
  const sanitizedDesc = sanitizeDescription(description, serviceName);
  const procedureDesc = sanitizedDesc && sanitizedDesc.length > 30
    ? truncateToSentence(sanitizedDesc, 160)
    : (matchedService
      ? matchedService.desc
      : `${serviceName} performed by licensed dental professionals using modern techniques and equipment.`);

  // Page description: context of the page itself
  const pageDesc = sanitizedDesc
    ? truncateToSentence(sanitizedDesc, 200)
    : `Learn about ${serviceName.toLowerCase()} services at ${practice.name}.`;

  // Detect procedure subtype (used as multi-type @type, NOT as procedureType property)
  // procedureType only accepts NoninvasiveProcedure or PercutaneousProcedure,
  // so we express the procedure classification via @type instead.
  // Valid subtypes: TherapeuticProcedure, DiagnosticProcedure, SurgicalProcedure
  // (CosmeticProcedure does NOT exist in schema.org)
  let procedureSubtype = 'TherapeuticProcedure';
  if (/diagnos|exam|x-ray|radiograph|check/i.test(serviceName)) procedureSubtype = 'DiagnosticProcedure';
  if (/clean|hygien|prevent|fluoride|sealant/i.test(serviceName)) procedureSubtype = 'TherapeuticProcedure';
  if (/extract|implant|surg|wisdom|all-on/i.test(serviceName)) procedureSubtype = 'SurgicalProcedure';
  if (/cosmetic|whiten|veneer|bonding/i.test(serviceName)) procedureSubtype = 'TherapeuticProcedure';

  // 1. Service entity (schema.org/Service wrapping MedicalProcedure)
  const serviceNode = {
    '@type': 'Service',
    '@id': `${pageUrl}/#service`,
    'name': serviceName,
    'description': serviceDesc,
    'provider': { '@id': `${domain}/#practice` },
    'serviceType': 'Dental Service',
    'areaServed': buildAreaServed(entities),
    'hasOfferCatalog': {
      '@type': 'OfferCatalog',
      'name': `${serviceName} Options`,
      'itemListElement': services.slice(0, 5).map((svc, i) => ({
        '@type': 'Offer',
        'itemOffered': {
          '@type': ['MedicalProcedure', procedureSubtype],
          'name': svc.name,
          'description': svc.description
        }
      }))
    }
  };
  // If no sub-services detected, create a single MedicalProcedure offer
  if (services.length === 0) {
    serviceNode.hasOfferCatalog = {
      '@type': 'OfferCatalog',
      'name': `${serviceName} Options`,
      'itemListElement': [{
        '@type': 'Offer',
        'itemOffered': {
          '@type': ['MedicalProcedure', procedureSubtype],
          'name': serviceName,
          'description': procedureDesc
        }
      }]
    };
  }
  serviceNode.image = image || `${domain}/logo.png`;

  graph.push(serviceNode);

  // 2. MedicalProcedure (primary clinical entity — unique description)
  const procedureNode = {
    '@type': ['MedicalProcedure', procedureSubtype],
    '@id': `${pageUrl}/#procedure`,
    'name': serviceName,
    'description': procedureDesc,
    'howPerformed': extractHowPerformed(entities),
    'status': 'http://schema.org/ActiveActionStatus',
    'relevantSpecialty': 'http://schema.org/Dentistry'
  };
  // bodyLocation — try to detect
  const bodyLoc = detectBodyLocation(serviceName);
  if (bodyLoc) procedureNode.bodyLocation = bodyLoc;
  // preparation and followup
  const procDetails = findProcedureDetails(serviceName);
  if (procDetails) {
    if (procDetails.preparation) procedureNode.preparation = procDetails.preparation;
    if (procDetails.followup) procedureNode.followup = procDetails.followup;
  }

  graph.push(procedureNode);

  // 2b. MedicalCondition entity (symptoms, treatments, tests, progression)
  const conditionNode = buildMedicalConditionNode(serviceName, pageUrl);
  if (conditionNode) graph.push(conditionNode);

  // 3. Full Dentist node as provider (AEO best practice for inner pages)
  // aggregateRating goes on the Dentist (LocalBusiness) node, NOT Service
  const dentistNode = buildDentistNode(entities, true);
  applyAggregateRating(dentistNode, entities);
  graph.push(dentistNode);

  // 4. Person nodes
  graph.push(...buildPersonNodes(entities));

  // 5. MedicalWebPage — about the condition (if exists), otherwise the procedure
  const { pageNode, extraNodes } = buildWebPageNode(entities, pageUrl, 'service');
  pageNode.about = conditionNode
    ? { '@id': `${pageUrl}/#condition` }
    : { '@id': `${pageUrl}/#procedure` };
  pageNode.mainEntity = { '@id': `${pageUrl}/#service` };
  pageNode.mentions = { '@id': `${pageUrl}/#service` };
  pageNode.aspect = 'Treatment';
  pageNode.description = pageDesc; // Override to avoid same desc as Service/Procedure
  graph.push(pageNode, ...extraNodes);

  // 6. WebSite, FAQ, Breadcrumb
  graph.push(buildWebSiteNode(entities));
  const faqNode = buildFaqNode(entities, pageUrl);
  if (faqNode) graph.push(faqNode);
  const breadcrumbNode = buildBreadcrumbNode(entities, pageUrl);
  if (breadcrumbNode) graph.push(breadcrumbNode);

  // 7. Individual Review entities
  const reviewNodes = buildReviewNodes(entities, pageUrl);
  if (reviewNodes.length > 0) graph.push(...reviewNodes);

  // 8. Video nodes
  const videoNodes = buildVideoNodes(entities, pageUrl);
  if (videoNodes.length > 0) graph.push(...videoNodes);

  // 9. HowTo node (from detected step-by-step content)
  const howToNode = buildHowToNode(entities, pageUrl);
  if (howToNode) graph.push(howToNode);

  return { '@context': 'https://schema.org', '@graph': graph };
}

// ─── About Page Schema (AboutPage + E-E-A-T) ──────────────
function generateAboutPageSchema(entities, pageUrl) {
  const { domain, doctors, memberships } = entities;
  const graph = [];

  // 1. Dentist node
  graph.push(buildDentistNode(entities, true));

  // 2. Expanded Person nodes with E-E-A-T signals
  doctors.forEach(dr => {
    const personNode = {
      '@type': 'Person',
      '@id': `${domain}/#/schema/person/${slugify(dr.name)}`,
      'name': dr.name,
      'hasOccupation': {
        '@type': 'Occupation',
        'name': 'Dentist',
        'occupationalCategory': '29-1021.00'
      }
    };
    if (dr.jobTitle) personNode.jobTitle = dr.jobTitle;
    personNode.url = dr.url || domain;
    if (dr.sameAs.length > 0) personNode.sameAs = dr.sameAs;
    if (dr.npi) personNode.identifier = { '@type': 'PropertyValue', 'propertyID': 'NPI', 'value': dr.npi };
    if (entities.services.length > 0) personNode.knowsAbout = entities.services.slice(0, 8).map(s => s.name);
    // memberOf at person level
    if (memberships.length > 0) {
      personNode.memberOf = memberships.map(m => ({ '@type': 'Organization', 'name': m.name, 'url': m.url }));
    }
    graph.push(personNode);
  });

  // 3. AboutPage web page
  const { pageNode, extraNodes } = buildWebPageNode(entities, pageUrl, 'about');
  graph.push(pageNode, ...extraNodes);

  // 4. WebSite, FAQ, Breadcrumb
  graph.push(buildWebSiteNode(entities));
  const faqNode = buildFaqNode(entities, pageUrl);
  if (faqNode) graph.push(faqNode);
  const breadcrumbNode = buildBreadcrumbNode(entities, pageUrl);
  if (breadcrumbNode) graph.push(breadcrumbNode);

  // 5. Video nodes
  const videoNodes = buildVideoNodes(entities, pageUrl);
  if (videoNodes.length > 0) graph.push(...videoNodes);

  return { '@context': 'https://schema.org', '@graph': graph };
}

// ─── Contact Page Schema (ContactPage + Actions) ──────────
function generateContactPageSchema(entities, pageUrl) {
  const { domain, practice } = entities;
  const graph = [];

  // 1. Full Dentist node with address/geo emphasis
  const dentistNode = buildDentistNode(entities, true);
  // potentialAction for appointment booking
  dentistNode.potentialAction = {
    '@type': 'ReserveAction',
    'target': {
      '@type': 'EntryPoint',
      'urlTemplate': practice.url + (practice.url.endsWith('/') ? '' : '/') + 'contact',
      'inLanguage': entities.lang,
      'actionPlatform': [
        'http://schema.org/DesktopWebPlatform',
        'http://schema.org/MobileWebPlatform'
      ]
    },
    'result': {
      '@type': 'Reservation',
      'name': 'Dental Appointment'
    }
  };
  graph.push(dentistNode);

  // 2. Person nodes
  graph.push(...buildPersonNodes(entities));

  // 3. ContactPage web page
  const { pageNode, extraNodes } = buildWebPageNode(entities, pageUrl, 'contact');
  graph.push(pageNode, ...extraNodes);

  // 4. WebSite, FAQ, Breadcrumb
  graph.push(buildWebSiteNode(entities));
  const faqNode = buildFaqNode(entities, pageUrl);
  if (faqNode) graph.push(faqNode);
  const breadcrumbNode = buildBreadcrumbNode(entities, pageUrl);
  if (breadcrumbNode) graph.push(breadcrumbNode);

  // 5. Video nodes
  const videoNodes = buildVideoNodes(entities, pageUrl);
  if (videoNodes.length > 0) graph.push(...videoNodes);

  return { '@context': 'https://schema.org', '@graph': graph };
}

// ─── Blog Post Schema (Article / BlogPosting) ──────────────
function generateBlogPostSchema(entities, pageUrl) {
  const { domain, h1, description, doctors, articleData } = entities;
  const graph = [];

  // 1. BlogPosting / Article entity
  const articleType = articleData?.type || 'BlogPosting';
  const articleNode = {
    '@type': articleType,
    '@id': `${pageUrl}/#article`,
    'headline': articleData?.headline || h1 || 'Blog Post',
    'url': pageUrl,
    'isPartOf': { '@id': `${domain}/#website` },
    'mainEntityOfPage': { '@id': `${pageUrl}/#webpage` },
    'publisher': { '@id': `${domain}/#practice` }
  };
  if (description) articleNode.description = truncateToSentence(description, 160);
  if (articleData?.datePublished) articleNode.datePublished = articleData.datePublished;
  if (articleData?.dateModified) articleNode.dateModified = articleData.dateModified;
  if (articleData?.wordCount) articleNode.wordCount = articleData.wordCount;

  // Author
  if (articleData?.author) {
    articleNode.author = { '@type': 'Person', 'name': articleData.author, 'url': pageUrl };
  } else if (doctors.length > 0) {
    articleNode.author = { '@id': `${domain}/#/schema/person/${slugify(doctors[0].name)}` };
  }

  // Image
  articleNode.image = entities.image || `${domain}/logo.png`;

  graph.push(articleNode);

  // 2. Dentist node
  const dentistNode = buildDentistNode(entities, true);
  applyAggregateRating(dentistNode, entities);
  graph.push(dentistNode);

  // 3. Person nodes
  graph.push(...buildPersonNodes(entities));

  // 4. MedicalWebPage
  const { pageNode, extraNodes } = buildWebPageNode(entities, pageUrl, 'blog');
  pageNode.mainEntity = { '@id': `${pageUrl}/#article` };
  graph.push(pageNode, ...extraNodes);

  // 5. WebSite, FAQ, Breadcrumb
  graph.push(buildWebSiteNode(entities));
  const faqNode = buildFaqNode(entities, pageUrl);
  if (faqNode) graph.push(faqNode);
  const breadcrumbNode = buildBreadcrumbNode(entities, pageUrl);
  if (breadcrumbNode) graph.push(breadcrumbNode);

  // 6. Video nodes
  const videoNodes = buildVideoNodes(entities, pageUrl);
  if (videoNodes.length > 0) graph.push(...videoNodes);

  // 7. HowTo node
  const howToNode = buildHowToNode(entities, pageUrl);
  if (howToNode) graph.push(howToNode);

  return { '@context': 'https://schema.org', '@graph': graph };
}

// ─── Service Page Helpers ──────────────────────────────────

// Find condition data by fuzzy-matching service name
function findConditionData(serviceName) {
  const lower = serviceName.toLowerCase();
  for (const [key, data] of Object.entries(DENTAL_CONDITIONS)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) return data;
  }
  // Fallback pattern matching
  if (/implant/i.test(lower)) return DENTAL_CONDITIONS['Dental Implants'];
  if (/whiten|bleach/i.test(lower)) return DENTAL_CONDITIONS['Teeth Whitening'];
  if (/clean|hygien|prophylax/i.test(lower)) return DENTAL_CONDITIONS['Dental Cleaning'];
  if (/root\s*canal|endodon/i.test(lower)) return DENTAL_CONDITIONS['Root Canal Therapy'];
  if (/fill|cavit|caries|decay/i.test(lower)) return DENTAL_CONDITIONS['Dental Fillings'];
  if (/orthodon|brace|invisalign|aligner/i.test(lower)) return DENTAL_CONDITIONS['Orthodontics'];
  if (/veneer|bond/i.test(lower)) return DENTAL_CONDITIONS['Porcelain Veneers'];
  if (/periodon|gum\s*disease/i.test(lower)) return DENTAL_CONDITIONS['Periodontal Treatment'];
  return null;
}

// Find procedure details (preparation & followup) by fuzzy-matching service name
function findProcedureDetails(serviceName) {
  const lower = serviceName.toLowerCase();
  for (const [key, data] of Object.entries(DENTAL_PROCEDURE_DETAILS)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) return data;
  }
  if (/implant/i.test(lower)) return DENTAL_PROCEDURE_DETAILS['Dental Implants'];
  if (/whiten|bleach/i.test(lower)) return DENTAL_PROCEDURE_DETAILS['Teeth Whitening'];
  if (/clean|hygien|prophylax/i.test(lower)) return DENTAL_PROCEDURE_DETAILS['Dental Cleaning'];
  if (/root\s*canal|endodon/i.test(lower)) return DENTAL_PROCEDURE_DETAILS['Root Canal Therapy'];
  if (/fill|cavit|caries|decay/i.test(lower)) return DENTAL_PROCEDURE_DETAILS['Dental Fillings'];
  if (/orthodon|brace/i.test(lower)) return DENTAL_PROCEDURE_DETAILS['Orthodontics'];
  if (/invisalign|aligner/i.test(lower)) return DENTAL_PROCEDURE_DETAILS['Invisalign / Clear Aligners'];
  if (/veneer/i.test(lower)) return DENTAL_PROCEDURE_DETAILS['Porcelain Veneers'];
  if (/periodon|gum/i.test(lower)) return DENTAL_PROCEDURE_DETAILS['Periodontal Treatment'];
  if (/extract|wisdom/i.test(lower)) return DENTAL_PROCEDURE_DETAILS['Tooth Extraction'];
  return null;
}

// Build a MedicalCondition entity for the service page
function buildMedicalConditionNode(serviceName, pageUrl) {
  const condData = findConditionData(serviceName);
  if (!condData) return null;

  const conditionNode = {
    '@type': 'MedicalCondition',
    '@id': `${pageUrl}/#condition`,
    'name': condData.condition,
    'description': condData.description,
    'relevantSpecialty': 'http://schema.org/Dentistry'
  };

  if (condData.alternateName && condData.alternateName.length > 0) {
    conditionNode.alternateName = condData.alternateName;
  }

  // signOrSymptom
  if (condData.symptoms && condData.symptoms.length > 0) {
    conditionNode.signOrSymptom = condData.symptoms.map(s => ({
      '@type': 'MedicalSymptom', 'name': s
    }));
  }

  // possibleTreatment
  if (condData.treatments && condData.treatments.length > 0) {
    conditionNode.possibleTreatment = condData.treatments.map(t => ({
      '@type': 'MedicalTherapy', 'name': t.name, 'description': t.desc
    }));
  }

  // typicalTest
  if (condData.tests && condData.tests.length > 0) {
    conditionNode.typicalTest = condData.tests.map(t => ({
      '@type': 'MedicalTest', 'name': t.name, 'description': t.desc
    }));
  }

  // naturalProgression and possibleComplication
  if (condData.progression) conditionNode.naturalProgression = condData.progression;
  if (condData.complication) conditionNode.possibleComplication = condData.complication;

  return conditionNode;
}

function buildAreaServed(entities) {
  const { cityState, bodyText } = entities;
  if (!cityState) return { '@type': 'Country', 'name': 'US' };
  const parts = cityState.split(',').map(p => p.trim());
  const primaryCity = parts[0];

  // Try to detect mentioned nearby cities from page content
  const nearbyCities = [];
  if (bodyText) {
    const cityPattern = /(?:serving|near|surrounding|communities|areas|residents of|close to)[^.]*?((?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)(?:,\s*(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*))*)/g;
    let match;
    while ((match = cityPattern.exec(bodyText)) !== null) {
      const cities = match[1].split(',').map(c => c.trim()).filter(c => c.length > 2 && c !== primaryCity);
      cities.forEach(c => { if (!nearbyCities.includes(c)) nearbyCities.push(c); });
    }
  }

  const areaList = [{ '@type': 'City', 'name': primaryCity }];
  nearbyCities.slice(0, 5).forEach(c => areaList.push({ '@type': 'City', 'name': c }));

  return areaList.length > 1 ? areaList : areaList[0];
}

// Build Review entities from extracted reviews
function buildReviewNodes(entities, pageUrl) {
  const { reviews, domain } = entities;
  if (!reviews || reviews.length === 0) return [];

  return reviews.slice(0, 3).map((rev, i) => ({
    '@type': 'Review',
    '@id': `${pageUrl}/#review-${i + 1}`,
    'itemReviewed': { '@id': `${domain}/#practice` },
    'author': { '@type': 'Person', 'name': rev.author },
    'reviewRating': {
      '@type': 'Rating',
      'ratingValue': rev.rating || 5,
      'bestRating': 5
    },
    'reviewBody': rev.text
  }));
}

function extractHowPerformed(entities) {
  const { answerText } = entities;
  if (!answerText || answerText.length < 50) return null;

  // Final safety check — reject if the text still smells like boilerplate
  if (JUNK_TEXT_PATTERNS.test(answerText)) return null;

  // Reject welcome intros and marketing filler
  if (MARKETING_FILLER.test(answerText)) return null;
  if (ADDRESS_PATTERN.test(answerText)) return null;

  // Reject if text has too few dental/medical terms (likely not procedure content)
  const medicalSignals = /tooth|teeth|dental|gum|oral|implant|crown|whiten|clean|floss|brace|orthodon|sedation|x-ray|exam|filling|extract|root\s*canal|veneer|treatment|procedure|patient|diagnos|restor|periodon/i;
  if (!medicalSignals.test(answerText)) return null;

  // Extract only the clinically relevant portion
  // Split into sentences, skip any that start with marketing phrases
  const sentences = answerText.split(/(?<=[.!?])\s+/);
  const clinical = sentences.filter(s => {
    const trimmed = s.trim();
    if (trimmed.length < 20) return false;
    if (MARKETING_FILLER.test(trimmed)) return false;
    if (ADDRESS_PATTERN.test(trimmed)) return false;
    if (/^(welcome|at\s+\w+|our\s+team|we\s+are|in\s+this|this\s+(guide|article|page|post))/i.test(trimmed)) return false;
    return true;
  });

  if (clinical.length === 0) return null;

  const result = clinical.join(' ').slice(0, 300);
  // Ensure it ends cleanly (no trailing fragment)
  return truncateToSentence(result, 300);
}

function detectBodyLocation(serviceName) {
  const lower = serviceName.toLowerCase();
  if (/implant|crown|bridge|veneer|bonding|filling|cavit|root\s*canal|extract|wisdom/.test(lower)) return 'Mouth';
  if (/orthodon|brace|invisalign|aligner/.test(lower)) return 'Teeth';
  if (/periodon|gum/.test(lower)) return 'Gums';
  if (/tmj|jaw/.test(lower)) return 'Jaw';
  if (/whiten/.test(lower)) return 'Teeth';
  if (/sleep\s*apnea|snor/.test(lower)) return 'Airway';
  return null;
}

// ─── Dental-Specific Gap Analysis (Page-Type-Aware) ────────
function analyzeDentalGaps(entities, pageType) {
  const gaps = [];

  // === Universal gaps ===

  // No doctors found
  if (entities.doctors.length === 0) {
    gaps.push({
      priority: 'high',
      title: 'Add Dentist/Doctor Information',
      description: 'No dentist or doctor was detected. Add a visible doctor profile with name, credentials, NPI number, and links to professional directories.',
      schema: '"employee": { "@type": "Person", "name": "Dr. ...", "sameAs": ["https://findadentist.ada.org/..."] }'
    });
  } else if (entities.doctors[0].sameAs.length === 0) {
    gaps.push({
      priority: 'medium',
      title: 'Add Doctor sameAs / Professional Links',
      description: 'Doctor found but no sameAs links. Add links to ADA directory, LinkedIn, or state dental board listing to verify identity for E-E-A-T.',
      schema: '"sameAs": ["https://linkedin.com/in/dr...", "https://findadentist.ada.org/..."]'
    });
  }

  // No "Last Reviewed" date
  if (!entities.lastReviewed) {
    gaps.push({
      priority: 'high',
      title: 'Add "Last Reviewed by [Dentist Name]" Date',
      description: 'No clinical review date detected. Add a visible "Last medically reviewed by Dr. [Name] on [Date]" line. Critical for MedicalWebPage schema and Google\'s Medical Core algorithm.',
      schema: '"lastReviewed": "2026-02-01", "reviewedBy": { "@id": "#dr-name" }'
    });
  }

  // No FAQs
  if (entities.faqs.length === 0) {
    gaps.push({
      priority: 'high',
      title: 'Add Dental FAQ Section',
      description: 'No FAQs detected. Add 3-5 FAQs with 50-60 word answers — the optimal length for Google AI Overview citations and AEO.',
      schema: '"@type": "FAQPage", "mainEntity": [{ "@type": "Question", "name": "...", "acceptedAnswer": { "text": "~55 words" } }]'
    });
  }

  // === Page-type-specific gaps ===

  if (pageType === 'homepage') {
    if (entities.acceptingPatients === null) {
      gaps.push({
        priority: 'medium',
        title: 'Add "Accepting New Patients" Signal',
        description: 'Could not detect whether the practice is accepting new patients. Add a visible badge or text — massive conversion signal in local SEO.',
        schema: '"isAcceptingNewPatients": "True"'
      });
    }
    if (entities.services.length === 0) {
      gaps.push({
        priority: 'medium',
        title: 'Add Dental Services List',
        description: 'No specific dental services mapped. List your treatments with clear H2 headings so they map to availableService.',
        schema: '"availableService": [{ "@type": "MedicalProcedure", "name": "..." }]'
      });
    }
  }

  if (pageType === 'service') {
    // Authority citations for the specific procedure
    const authorityLinks = entities.externalLinks.filter(l =>
      /ada\.org|\.gov|\.edu|pubmed|nih|who|mayoclinic/i.test(l.url)
    );
    if (authorityLinks.length === 0) {
      gaps.push({
        priority: 'high',
        title: 'Cite Clinical Sources for This Procedure',
        description: 'No authoritative external links found. Service pages MUST cite clinical sources (ADA, NIH, PubMed) to enable isBasedOn schema — this is the #1 signal for AI Overview inclusion on medical queries.',
        schema: '"isBasedOn": [{ "@type": "WebPage", "url": "https://www.ada.org/..." }]'
      });
    }
    if (entities.faqs.length === 0) {
      gaps.push({
        priority: 'high',
        title: 'Add Service-Specific FAQs',
        description: 'No FAQs detected on this service page. Add 3-5 procedure-specific questions (e.g., "How long do dental implants last?") with 50-60 word answers for AEO.',
        schema: '"@type": "FAQPage", "mainEntity": [{ "@type": "Question" }]'
      });
    }
    if (!entities.serviceNameOverride && !entities.h1) {
      gaps.push({
        priority: 'medium',
        title: 'Add a Clear Service H1',
        description: 'No clear H1 detected for this service page. The H1 should contain the exact procedure name for proper entity mapping.',
        schema: '<h1>General Dentistry in [City]</h1>'
      });
    }
  }

  if (pageType === 'about') {
    if (entities.doctors.length > 0 && !entities.doctors[0].npi) {
      gaps.push({
        priority: 'medium',
        title: 'Add NPI Number for E-E-A-T',
        description: 'No NPI number detected. Adding the dentist\'s NPI number provides a verifiable identifier that strengthens E-E-A-T trust signals.',
        schema: '"identifier": { "@type": "PropertyValue", "propertyID": "NPI", "value": "1234567890" }'
      });
    }
    if (entities.memberships.length === 0) {
      gaps.push({
        priority: 'medium',
        title: 'Add Professional Memberships',
        description: 'No memberships detected (ADA, AACD, AGD). These are critical E-E-A-T trust signals on About pages.',
        schema: '"memberOf": { "@type": "Organization", "name": "American Dental Association" }'
      });
    }
  }

  if (pageType === 'contact') {
    if (!entities.practice.geo) {
      gaps.push({
        priority: 'high',
        title: 'Add Geo Coordinates',
        description: 'No geo coordinates detected. Add a Google Maps embed or explicit lat/lng values. Essential for local pack ranking and "near me" queries.',
        schema: '"geo": { "@type": "GeoCoordinates", "latitude": "...", "longitude": "..." }'
      });
    }
    if (!entities.hours) {
      gaps.push({
        priority: 'high',
        title: 'Add Opening Hours',
        description: 'No opening hours detected. Add structured hours to your Contact page — Google uses this for "dentist open now" queries.',
        schema: '"openingHoursSpecification": [{ "dayOfWeek": "Monday", "opens": "08:00", "closes": "17:00" }]'
      });
    }
    if (!entities.practice.phone) {
      gaps.push({
        priority: 'medium',
        title: 'Add Phone Number',
        description: 'No phone number detected. A clickable tel: link helps both schema extraction and mobile conversions.',
        schema: '"telephone": "+1-555-123-4567"'
      });
    }
  }

  // General gaps (lower priority, for all page types)
  if (entities.amenities.length === 0 && (pageType === 'homepage' || pageType === 'contact')) {
    gaps.push({
      priority: 'low',
      title: 'Add Amenity Features',
      description: 'No amenities detected. Mention wheelchair accessibility, free parking, WiFi — crucial for local voice search queries.',
      schema: '"amenityFeature": [{ "@type": "LocationFeatureSpecification", "name": "Free Parking" }]'
    });
  }

  // Video gap (all page types)
  if (!entities.videos || entities.videos.length === 0) {
    gaps.push({
      priority: 'medium',
      title: 'Add Patient Education Video',
      description: 'No video content detected. Embed a YouTube or Vimeo video (office tour, procedure explanation, patient testimonial) to generate VideoObject schema — videos boost organic CTR and AI Overview inclusion.',
      schema: '"@type": "VideoObject", "name": "...", "thumbnailUrl": "...", "contentUrl": "..."'
    });
  }

  // Blog-specific gaps
  if (pageType === 'blog') {
    if (!entities.articleData || !entities.articleData.author) {
      gaps.push({
        priority: 'high',
        title: 'Add Article Author (E-E-A-T)',
        description: 'Blog post missing author attribution. Add a visible byline with the dentist\'s name — critical for medical E-E-A-T and BlogPosting schema.',
        schema: '"author": { "@type": "Person", "name": "Dr. ..." }'
      });
    }
    if (!entities.articleData || !entities.articleData.datePublished) {
      gaps.push({
        priority: 'high',
        title: 'Add Publication Date',
        description: 'No publication date detected. Add a visible date or <time datetime="..."> element — required for Article/BlogPosting schema.',
        schema: '"datePublished": "2026-01-15"'
      });
    }
  }

  // Return top 6 for more coverage
  return gaps.slice(0, 6);
}

// ─── Gemini AI Refinement Agent ────────────────────────────
// Standards loaded from src/standards.md (edit that file to change rules)
const GEMINI_SYSTEM_PROMPT = STANDARDS;

async function refineWithGemini(apiKey, jsonLd, entities, pageUrl) {
  var userPrompt = 'Refine this dental practice JSON-LD schema. The page URL is: ' + pageUrl + '\n' +
    'Page type: ' + (entities.pageType || 'homepage') + '\n' +
    'Practice name: ' + (entities.practice && entities.practice.name ? entities.practice.name : 'Unknown') + '\n' +
    'Doctors found: ' + (entities.doctors ? entities.doctors.map(function (d) { return d.name; }).join(', ') : 'None') + '\n\n' +
    'Here is the generated schema to validate and refine:\n\n' +
    JSON.stringify(jsonLd, null, 2);

  var apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: GEMINI_SYSTEM_PROMPT }] },
      contents: [{ parts: [{ text: userPrompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2
      }
    })
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error('Gemini API error ' + response.status + ': ' + errBody.slice(0, 200));
  }

  const data = await response.json();
  const text = data.candidates && data.candidates[0] && data.candidates[0].content &&
    data.candidates[0].content.parts && data.candidates[0].content.parts[0] &&
    data.candidates[0].content.parts[0].text;
  if (!text) throw new Error('Empty Gemini response');

  const result = JSON.parse(text);

  // Validate the refined schema has the expected structure
  if (!result.refinedSchema || !result.refinedSchema['@graph']) {
    throw new Error('Invalid refined schema structure');
  }

  // Post-process: strip properties the AI might re-introduce that cause validator warnings
  for (const node of result.refinedSchema['@graph']) {
    const nodeType = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
    // Fix invalid @type values (CosmeticProcedure doesn't exist in schema.org)
    if (Array.isArray(node['@type'])) {
      node['@type'] = node['@type'].map(t => t === 'CosmeticProcedure' ? 'TherapeuticProcedure' : t);
    } else if (node['@type'] === 'CosmeticProcedure') {
      node['@type'] = 'TherapeuticProcedure';
    }
    // medicalSpecialty is only valid on Dentist / MedicalOrganization / MedicalBusiness
    const allowsMedSpec = nodeType.some(t => ['Dentist', 'MedicalOrganization', 'MedicalBusiness'].includes(t));
    if (!allowsMedSpec && node.medicalSpecialty) delete node.medicalSpecialty;
    // specialty is not reliably recognized on MedicalWebPage by all validators
    if (nodeType.some(t => ['MedicalWebPage', 'WebPage', 'AboutPage', 'ContactPage'].includes(t))) {
      delete node.specialty;
    }
    // availableService is not valid on Dentist
    if (node.availableService) delete node.availableService;
    // procedureType only accepts NoninvasiveProcedure / PercutaneousProcedure — remove invalid ones
    if (node.procedureType && !/Noninvasive|Percutaneous/i.test(node.procedureType)) {
      delete node.procedureType;
    }
  }

  return result;
}

// ─── AI Report Rendering ──────────────────────────────────
function renderAiReport(report) {
  if (!report) { aiReportSection.hidden = true; return; }

  aiReportSection.hidden = false;

  // Score
  aiScore.textContent = report.score ? (report.score + '/10') : '';

  // Report cards
  if (!report.fixes || report.fixes.length === 0) {
    aiReportCards.innerHTML = '<p style="color:var(--text-2);font-size:0.85rem;">No issues found — schema passed all checks.</p>';
    return;
  }

  aiReportCards.innerHTML = report.fixes.map(function (fix) {
    var typeClass = fix.type === 'fix' ? 'fix' : fix.type === 'pass' ? 'pass' : 'info';
    var typeLabel = fix.type === 'fix' ? '\u26A0 Fixed' : fix.type === 'pass' ? '\u2713 Passed' : '\u24D8 Info';
    return '<div class="ai-report-card ai-report-card--' + typeClass + '">' +
      '<span class="ai-report-card__type ai-report-card__type--' + typeClass + '">' + typeLabel + '</span>' +
      '<div class="ai-report-card__field">' + (fix.field || '') + '</div>' +
      '<div class="ai-report-card__detail">' + (fix.detail || '') + '</div>' +
      '</div>';
  }).join('');
}

// AEO: Optimize FAQ answer to ~50-60 words
function optimizeFaqAnswer(answer) {
  if (!answer || answer.trim().length < 10) return '';
  const clean = answer.trim();
  const words = clean.split(/\s+/);
  if (words.length <= 60) return clean;
  // Truncate at sentence boundary within ~58 words
  const truncated = words.slice(0, 58).join(' ');
  const lastPeriod = truncated.lastIndexOf('.');
  if (lastPeriod > truncated.length * 0.4) {
    return truncated.slice(0, lastPeriod + 1);
  }
  return truncated + '.';
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// Parse natural language hours (e.g. "Mon-Fri 8am-5pm, Sat 9am-2pm") into schema.org format
function parseHoursText(text) {
  const DAY_MAP = {
    'mon': 'Monday', 'tue': 'Tuesday', 'wed': 'Wednesday', 'thu': 'Thursday',
    'fri': 'Friday', 'sat': 'Saturday', 'sun': 'Sunday',
    'monday': 'Monday', 'tuesday': 'Tuesday', 'wednesday': 'Wednesday',
    'thursday': 'Thursday', 'friday': 'Friday', 'saturday': 'Saturday', 'sunday': 'Sunday'
  };
  const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  function parseTime(t) {
    t = t.trim().toLowerCase();
    const m = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
    if (!m) return null;
    let h = parseInt(m[1], 10);
    const min = m[2] ? parseInt(m[2], 10) : 0;
    const ampm = m[3];
    if (ampm === 'pm' && h < 12) h += 12;
    if (ampm === 'am' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')} `;
  }

  function expandDayRange(start, end) {
    const s = DAY_ORDER.indexOf(start);
    const e = DAY_ORDER.indexOf(end);
    if (s === -1 || e === -1) return [start];
    const result = [];
    for (let i = s; i <= e; i++) result.push(DAY_ORDER[i]);
    return result;
  }

  const specs = [];
  // Split on comma or semicolon
  const segments = text.split(/[,;]+/).map(s => s.trim()).filter(Boolean);

  for (const seg of segments) {
    // Match pattern: Day(-Day) Time-Time
    const match = seg.match(/^([a-z]+(?:\s*-\s*[a-z]+)?)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*-\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)$/i);
    if (!match) continue;

    const dayPart = match[1].toLowerCase();
    const opens = parseTime(match[2]);
    const closes = parseTime(match[3]);
    if (!opens || !closes) continue;

    // Expand day range
    const dayRangeParts = dayPart.split('-').map(d => d.trim());
    let days;
    if (dayRangeParts.length === 2) {
      const startDay = DAY_MAP[dayRangeParts[0]];
      const endDay = DAY_MAP[dayRangeParts[1]];
      days = expandDayRange(startDay, endDay);
    } else {
      const d = DAY_MAP[dayRangeParts[0]];
      days = d ? [d] : [];
    }

    for (const day of days) {
      specs.push({ '@type': 'OpeningHoursSpecification', 'dayOfWeek': day, 'opens': opens, 'closes': closes });
    }
  }

  return specs;
}

// ─── Rendering ─────────────────────────────────────────────
function renderEntityCards(entities) {
  entityCards.innerHTML = '';

  // Dentist Practice Card
  const practiceFields = [
    { label: 'Practice Name', value: entities.practice.name, found: !!entities.practice.name },
    { label: 'Specialty', value: entities.specialties.join(', '), found: true },
    { label: 'Phone', value: entities.practice.phone, found: !!entities.practice.phone },
    { label: 'Address', value: entities.practice.address ? truncate(entities.practice.address, 50) : null, found: !!entities.practice.address },
    { label: 'New Patients', value: entities.acceptingPatients !== null ? (entities.acceptingPatients ? 'Yes ✓' : 'No') : null, found: entities.acceptingPatients !== null },
    { label: 'Price Range', value: entities.priceRange, found: !!entities.priceRange },
    { label: 'Logo', value: entities.practice.logo ? '✓ Found' : null, found: !!entities.practice.logo },
  ];
  entityCards.innerHTML += createEntityCard('🦷', 'dentist', 'Dentist', entities.practice.name, practiceFields);

  // Doctor(s) Card
  if (entities.doctors.length > 0) {
    const dr = entities.doctors[0];
    const drFields = [
      { label: 'Name', value: dr.name, found: true },
      { label: 'Job Title', value: dr.jobTitle, found: !!dr.jobTitle },
      { label: 'NPI', value: dr.npi, found: !!dr.npi },
      { label: 'sameAs', value: dr.sameAs.length > 0 ? `${dr.sameAs.length} profiles` : null, found: dr.sameAs.length > 0 },
      { label: 'Doctors Total', value: `${entities.doctors.length} `, found: true },
    ];
    entityCards.innerHTML += createEntityCard('👨‍⚕️', 'person', 'Dentist / Doctor', dr.name, drFields);
  } else {
    entityCards.innerHTML += createEntityCard('👨‍⚕️', 'person', 'Dentist / Doctor', 'Not Found', [
      { label: 'Status', value: null, found: false }
    ]);
  }

  // Services Card
  if (entities.services.length > 0) {
    const svcFields = entities.services.slice(0, 6).map(s => ({
      label: '✓', value: s.name, found: true
    }));
    entityCards.innerHTML += createEntityCard('🏥', 'service', 'Available Services', `${entities.services.length} Services`, svcFields);
  }

  // MedicalWebPage Card
  const pageFields = [
    { label: 'Last Reviewed', value: entities.lastReviewed ? formatDate(entities.lastReviewed) : null, found: !!entities.lastReviewed },
    { label: 'Reviewed By', value: entities.doctors.length > 0 ? entities.doctors[0].name : null, found: entities.doctors.length > 0 },
    { label: 'Languages', value: entities.languages.join(', '), found: entities.languages.length > 1 },
    { label: 'Amenities', value: entities.amenities.length > 0 ? `${entities.amenities.length} found` : null, found: entities.amenities.length > 0 },
    { label: 'Memberships', value: entities.memberships.length > 0 ? entities.memberships.map(m => m.name.split(' ').map(w => w[0]).join('')).join(', ') : null, found: entities.memberships.length > 0 },
    { label: 'Payment', value: entities.payment.length > 0 ? entities.payment.slice(0, 2).join(', ') : null, found: entities.payment.length > 0 },
  ];
  entityCards.innerHTML += createEntityCard('📋', 'medical', 'MedicalWebPage', h1OrFallback(entities), pageFields);

  // FAQ Card
  if (entities.faqs.length > 0) {
    const faqFields = entities.faqs.slice(0, 4).map((f, i) => ({
      label: `Q${i + 1} `, value: truncate(f.question, 55), found: true
    }));
    entityCards.innerHTML += createEntityCard('❓', 'faq', 'FAQPage (AEO)', `${entities.faqs.length} Questions`, faqFields);
  }

  // Video Card
  if (entities.videos && entities.videos.length > 0) {
    const vidFields = entities.videos.slice(0, 4).map((v, i) => ({
      label: `Video ${i + 1}`, value: truncate(v.name, 50), found: true
    }));
    entityCards.innerHTML += createEntityCard('🎬', 'video', 'VideoObject', `${entities.videos.length} Video${entities.videos.length > 1 ? 's' : ''}`, vidFields);
  }

  // Article / Blog Card
  if (entities.articleData) {
    const artFields = [
      { label: 'Type', value: entities.articleData.type, found: true },
      { label: 'Headline', value: truncate(entities.articleData.headline, 50), found: !!entities.articleData.headline },
      { label: 'Author', value: entities.articleData.author, found: !!entities.articleData.author },
      { label: 'Published', value: entities.articleData.datePublished ? formatDate(entities.articleData.datePublished) : null, found: !!entities.articleData.datePublished },
      { label: 'Word Count', value: entities.articleData.wordCount ? `${entities.articleData.wordCount} words` : null, found: !!entities.articleData.wordCount },
    ];
    entityCards.innerHTML += createEntityCard('📝', 'article', 'Article / BlogPosting', truncate(entities.articleData.headline, 40), artFields);
  }

  // HowTo Card
  if (entities.howToSteps && entities.howToSteps.length >= 2) {
    const howFields = entities.howToSteps.slice(0, 4).map((s, i) => ({
      label: `Step ${s.position}`, value: truncate(s.name, 50), found: true
    }));
    entityCards.innerHTML += createEntityCard('📋', 'howto', 'HowTo', `${entities.howToSteps.length} Steps`, howFields);
  }
}

function h1OrFallback(entities) {
  return truncate(entities.h1 || entities.description || entities.pageUrl, 50);
}

function createEntityCard(icon, type, typeName, name, fields) {
  const fieldsHtml = fields.map(f => `
    < li class="entity-card__field" >
      <span class="entity-card__label">${f.label}</span>
      <span class="entity-card__value ${f.found ? 'entity-card__value--found' : 'entity-card__value--missing'}">
        ${f.found ? escapeHtml(f.value || '') : 'Not found'}
      </span>
    </li >
    `).join('');

  return `
    < div class="entity-card" style = "animation-delay: ${Math.random() * 0.2}s" >
      <div class="entity-card__header">
        <div class="entity-card__icon entity-card__icon--${type}">${icon}</div>
        <div>
          <div class="entity-card__type">${typeName}</div>
          <div class="entity-card__name">${escapeHtml(truncate(name, 50))}</div>
        </div>
      </div>
      <ul class="entity-card__fields">${fieldsHtml}</ul>
    </div >
    `;
}

function renderJsonLd(jsonLd) {
  const jsonStr = JSON.stringify(jsonLd, null, 2);
  jsonOutput.innerHTML = highlightJson(jsonStr);
  schemaCount.textContent = `${jsonLd['@graph'].length} nodes`;
}

function renderGapCards(gaps) {
  gapCards.innerHTML = gaps.map((gap, i) => `
    < div class="gap-card" style = "animation-delay: ${i * 0.1}s" >
      <span class="gap-card__priority gap-card__priority--${gap.priority}">${gap.priority} priority</span>
      <h4 class="gap-card__title">${escapeHtml(gap.title)}</h4>
      <p class="gap-card__desc">${escapeHtml(gap.description)}</p>
      <div class="gap-card__schema">${escapeHtml(gap.schema)}</div>
    </div >
    `).join('');
}

// ─── JSON Syntax Highlighting ──────────────────────────────
function highlightJson(json) {
  return json
    .replace(/("(?:\\[\s\S]|[^"\\])*")\s*:/g, '<span class="json-key">$1</span><span class="json-colon">:</span>')
    .replace(/:\s*("(?:\\[\s\S]|[^"\\])*")/g, ': <span class="json-string">$1</span>')
    .replace(/:\s*(\d+\.?\d*)/g, ': <span class="json-number">$1</span>')
    .replace(/:\s*(true|false)/g, ': <span class="json-bool">$1</span>')
    .replace(/:\s*(null)/g, ': <span class="json-null">$1</span>')
    .replace(/([{}\[\]])/g, '<span class="json-bracket">$1</span>');
}

// ─── Utilities ─────────────────────────────────────────────
function truncate(str, len) {
  if (!str) return '';
  return str.length > len ? str.slice(0, len - 1) + '…' : str;
}

function formatDate(iso) {
  try { return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return iso; }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function showError(msg) { errorMsg.textContent = msg; errorMsg.hidden = false; }
function hideError() { errorMsg.hidden = true; }

function setLoading(isLoading) {
  analyzeBtn.disabled = isLoading;
  btnText.hidden = isLoading;
  btnLoader.hidden = !isLoading;
  loadingSkeleton.hidden = !isLoading;
  if (isLoading) resultsSection.hidden = true;
}

// ─── Copy & Download ──────────────────────────────────────
function handleCopy() {
  if (!currentJsonLd) return;
  const text = `< script type = "application/ld+json" >\n${JSON.stringify(currentJsonLd, null, 2)} \n <\/script>`;
  navigator.clipboard.writeText(text).then(() => {
    copyBtn.classList.add('btn-action--success');
    copyBtn.querySelector('span').textContent = 'Copied!';
    setTimeout(() => {
      copyBtn.classList.remove('btn-action--success');
      copyBtn.querySelector('span').textContent = 'Copy';
    }, 2000);
  });
}

function handleDownload() {
  if (!currentJsonLd) return;
  const text = `<script type="application/ld+json">\n${JSON.stringify(currentJsonLd, null, 2)}\n<\/script>`;
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'dental-schema.jsonld';
  a.click();
  URL.revokeObjectURL(url);
}
