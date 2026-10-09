/**
 * ActionPilot Internationalization (i18n) Module
 * Supports English (en), Hindi in Devanagari (hi), and Hinglish in Latin script (hinglish).
 * Keeps scheduling calculations and date mathematics language-independent.
 */

const LANG_EN = "en";
const LANG_HI = "hi";
const LANG_HINGLISH = "hinglish";

const SUPPORTED_LANGUAGES = [LANG_EN, LANG_HI, LANG_HINGLISH];

// Detect language from text if not explicitly provided
function detectLanguage(text, fallback = LANG_EN) {
  if (!text || typeof text !== "string") return fallback;
  // Check for Devanagari script range \u0900-\u097F
  if (/[\u0900-\u097F]/.test(text)) {
    return LANG_HI;
  }
  // Check for common Hinglish productivity tokens
  const lower = text.toLowerCase();
  const hinglishTokens = [
    /\b(?:karna|karni|karo|karein|kariye|banana|padhna|padhai|baje|shaam|subah|dopahar|aaj|kal|parso|aur|tatha|chahiye|hai|hain|hoga|hogi)\b/i
  ];
  if (hinglishTokens.some(r => r.test(lower))) {
    return LANG_HINGLISH;
  }
  return fallback;
}

// Normalize requested language to valid code
function normalizeLanguage(lang, textSample = null) {
  if (lang) {
    const l = String(lang).toLowerCase().trim();
    if (l === "hi" || l === "hindi") return LANG_HI;
    if (l === "hinglish" || l === "hi-en") return LANG_HINGLISH;
    if (l === "en" || l === "english") return LANG_EN;
  }
  if (textSample) {
    return detectLanguage(textSample, LANG_EN);
  }
  return LANG_EN;
}

// Multilingual messages & prompt templates
const MESSAGES = {
  [LANG_EN]: {
    planSummary: (taskSummary) => `Synthesized an optimized workflow for ${taskSummary}. Tasks prioritized and paced strictly according to requirements.`,
    assumptionDeadline: (deadline) => `All activities conclude prior to ${deadline} deadline.`,
    assumptionDefault: "Sequential focus blocks prioritized by urgency and cognitive load.",
    zeroConflicts: "Zero schedule conflicts permitted",
    windowConstraint: (windows) => `All focus blocks restricted to stated windows: ${windows}`,
    deadlineConstraint: (deadline) => `All preparatory milestones completed before ${deadline}`,
    clarificationMissingTasks: "Please provide specific tasks or timing details to create your plan (e.g., 'Prepare presentation today from 7 to 9 PM, demo tomorrow at 5 PM').",
    impossibleScheduleDuration: (req, avail) => `Impossible schedule: Requested tasks require ${req} minutes, but stated availability is only ${avail} minutes.`,
    impossibleScheduleDeadline: (task, deadline) => `Impossible schedule: Task '${task}' cannot conclude before hard deadline at ${deadline}.`,
    overlapDetected: (t1, t2, time) => `Schedule conflict: '${t1}' overlaps with '${t2}' at ${time}.`,
    fixedCommitmentClash: (task, comm, time) => `Commitment clash: '${task}' clashes with fixed commitment '${comm}' at ${time}.`,
    rescheduledSuccess: (task, newTime) => `Moved '${task}' to ${newTime}. Remaining tasks preserved.`,
    rescheduleMoved: (task, oldTime, newTime) => `Moved '${task}' from ${oldTime} to ${newTime}.`,
    rescheduleDisplaced: (task, oldTime, newTime) => `Adjusted '${task}' from ${oldTime} to ${newTime} to avoid overlap.`,
    rescheduleExplanation: (title, date, time) => `Added '${title}' on ${date} at ${time}. Remaining schedule adjusted safely.`,
    rescheduledWithDisplacement: (target, newTime, displaced, displacedSlot) => `Shifted '${target}' to ${newTime}. Rescheduled '${displaced}' to ${displacedSlot} to prevent overlap.`,
    fixedCommitmentAdded: (name, time, shiftedInfo) => `Added '${name}' at ${time}.${shiftedInfo ? ` ${shiftedInfo}` : " No conflicts."}`,
    approvalBookingReason: (task, date, time) => `Booking calendar slot for ${task} on ${date} at ${time}.`,
    notesDossierTitle: "Execution Blueprint & Notes",
    notesDossierDesc: "Archive talking points, milestones, and verification checklist into Notes dossier"
  },

  [LANG_HI]: {
    planSummary: (taskSummary) => `${taskSummary} के लिए एक अनुकूलित कार्यप्रवाह तैयार किया गया है। कार्यों को आपकी प्राथमिकताओं और समय सीमा के अनुसार व्यवस्थित किया गया है।`,
    assumptionDeadline: (deadline) => `सभी गतिविधियाँ ${deadline} की अंतिम समय सीमा से पहले पूरी होंगी।`,
    assumptionDefault: "प्राथमिकता और एकाग्रता के अनुसार निर्धारित अध्ययन एवं कार्य सत्र।",
    zeroConflicts: "समय सारिणी में कोई टकराव नहीं पाया गया",
    windowConstraint: (windows) => `सभी सत्र निर्धारित समय अंतराल में सीमित: ${windows}`,
    deadlineConstraint: (deadline) => `सभी पूर्व-तैयारी चरण ${deadline} से पहले पूरे होंगे`,
    clarificationMissingTasks: "कृपया अपने कार्यों और समय की जानकारी स्पष्ट रूप से बताएं (जैसे: 'आज शाम 7 से 9 बजे तक प्रेजेंटेशन बनाना, कल 5 बजे डेमो')।",
    impossibleScheduleDuration: (req, avail) => `असंभव समय-सारिणी: कार्यों के लिए ${req} मिनट चाहिए, जबकि कुल उपलब्ध समय केवल ${avail} मिनट है।`,
    impossibleScheduleDeadline: (task, deadline) => `असंभव समय-सारिणी: कार्य '${task}' को ${deadline} की समय सीमा से पहले पूरा नहीं किया जा सकता।`,
    overlapDetected: (t1, t2, time) => `समय टकराव: '${t1}' और '${t2}' का समय ${time} पर आपस में टकरा रहा है।`,
    fixedCommitmentClash: (task, comm, time) => `समय टकराव: '${task}' और निश्चित कार्यक्रम '${comm}' का समय ${time} पर टकरा रहा है।`,
    rescheduledSuccess: (task, newTime) => `'${task}' को ${newTime} पर पुनर्निर्धारित किया गया। बाकी कार्य सुरक्षित हैं।`,
    rescheduleMoved: (task, oldTime, newTime) => `'${task}' का समय ${oldTime} से बदल कर ${newTime} कर दिया गया।`,
    rescheduleDisplaced: (task, oldTime, newTime) => `टकराव से बचने के लिए '${task}' को ${oldTime} से ${newTime} पर बदल दिया गया।`,
    rescheduleExplanation: (title, date, time) => `${date} को ${time} पर '${title}' जोड़ा गया। बाकी कार्य सुरक्षित हैं।`,
    rescheduledWithDisplacement: (target, newTime, displaced, displacedSlot) => `'${target}' को ${newTime} पर किया गया। टकराव से बचने के लिए '${displaced}' को ${displacedSlot} पर स्थानांतरित किया गया।`,
    fixedCommitmentAdded: (name, time, shiftedInfo) => `'${name}' को ${time} पर जोड़ा गया।${shiftedInfo ? ` ${shiftedInfo}` : " कोई टकराव नहीं।" }`,
    approvalBookingReason: (task, date, time) => `${date} को ${time} पर ${task} के लिए कैलेंडर स्लॉट बुक करना।`,
    notesDossierTitle: "कार्ययोजना रूपरेखा एवं नोट्स",
    notesDossierDesc: "मुख्य बिंदुओं, मील के पत्थरों और चेकलिस्ट को नोट्स संग्रह में दर्ज करना"
  },

  [LANG_HINGLISH]: {
    planSummary: (taskSummary) => `${taskSummary} ke liye optimized workflow banaya gaya hai. Tasks ko aapki priority aur availability ke strictly according pace kiya gaya hai.`,
    assumptionDeadline: (deadline) => `Sabhi activities ${deadline} deadline se pehle complete ho jayengi.`,
    assumptionDefault: "Focus blocks cognitive load aur urgency ke according prioritize kiye gaye hain.",
    zeroConflicts: "Zero schedule conflicts allowed",
    windowConstraint: (windows) => `Sabhi sessions stated windows me restricted hain: ${windows}`,
    deadlineConstraint: (deadline) => `Sabhi preparatory milestones ${deadline} se pehle complete honge`,
    clarificationMissingTasks: "Kripya apne tasks aur available time details share karein (jaise: 'Aaj 7 se 9 PM presentation banana, kal 5 PM demo').",
    impossibleScheduleDuration: (req, avail) => `Impossible schedule: Requested tasks ke liye ${req} minutes chahiye, par available time sirf ${avail} minutes hai.`,
    impossibleScheduleDeadline: (task, deadline) => `Impossible schedule: Task '${task}' hard deadline (${deadline}) se pehle finish nahi ho sakta.`,
    overlapDetected: (t1, t2, time) => `Schedule overlap: '${t1}' aur '${t2}' ${time} par clash ho rahe hain.`,
    fixedCommitmentClash: (task, comm, time) => `Commitment clash: '${task}' fixed commitment '${comm}' ke saath ${time} par clash kar raha hai.`,
    rescheduledSuccess: (task, newTime) => `'${task}' ko ${newTime} par move kar diya gaya. Remaining tasks intact hain.`,
    rescheduleMoved: (task, oldTime, newTime) => `'${task}' ko ${oldTime} se ${newTime} par shift kar diya gaya hai.`,
    rescheduleDisplaced: (task, oldTime, newTime) => `Overlap avoid karne ke liye '${task}' ko ${oldTime} se ${newTime} par adjust kiya gaya.`,
    rescheduleExplanation: (title, date, time) => `${date} ko ${time} par '${title}' add kiya gaya.`,
    rescheduledWithDisplacement: (target, newTime, displaced, displacedSlot) => `'${target}' ko ${newTime} par shift kiya. Overlap avoid karne ke liye '${displaced}' ko ${displacedSlot} par reschedule kiya gaya.`,
    fixedCommitmentAdded: (name, time, shiftedInfo) => `'${name}' ko ${time} par add kiya gaya.${shiftedInfo ? ` ${shiftedInfo}` : " Zero conflicts."}`,
    approvalBookingReason: (task, date, time) => `${date} ko ${time} par ${task} ke liye calendar slot book karna.`,
    notesDossierTitle: "Execution Blueprint & Notes",
    notesDossierDesc: "Talking points, milestones aur verification checklist ko Notes dossier me save karna"
  }
};

function getMessage(lang, key, ...args) {
  const normLang = normalizeLanguage(lang);
  const langPack = MESSAGES[normLang] || MESSAGES[LANG_EN];
  const item = langPack[key] || MESSAGES[LANG_EN][key];
  if (typeof item === "function") {
    return item(...args);
  }
  return item || "";
}

module.exports = {
  LANG_EN,
  LANG_HI,
  LANG_HINGLISH,
  SUPPORTED_LANGUAGES,
  detectLanguage,
  normalizeLanguage,
  getMessage
};
