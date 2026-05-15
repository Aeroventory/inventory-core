import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import tr from "./locales/tr.json";

const LANGUAGE_STORAGE_KEY = "inventory_core_language";
const supportedLanguages = ["en", "tr"] as const;
type SupportedLanguage = (typeof supportedLanguages)[number];

function getInitialLanguage(): SupportedLanguage {
  if (typeof window === "undefined") return "en";
  const savedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return supportedLanguages.includes(savedLanguage as SupportedLanguage)
    ? (savedLanguage as SupportedLanguage)
    : "en";
}

const initialLanguage = getInitialLanguage();

i18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: en,
    },
    tr: {
      translation: tr,
    },
  },
  lng: initialLanguage,
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

function updateDocumentMetadata(language: SupportedLanguage) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = language;
  document.title = i18n.t("common.brand.name");
}

updateDocumentMetadata(initialLanguage);

i18n.on("languageChanged", (language) => {
  if (typeof window === "undefined") return;
  if (supportedLanguages.includes(language as SupportedLanguage)) {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    updateDocumentMetadata(language as SupportedLanguage);
  }
});

export default i18n;
