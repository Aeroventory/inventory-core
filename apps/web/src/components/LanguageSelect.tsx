import { useTranslation } from "react-i18next";
import { ChevronDown, Globe } from "lucide-react";

import { cn } from "@/lib/utils";

interface LanguageSelectProps {
  className?: string;
}

export default function LanguageSelect({ className }: LanguageSelectProps) {
  const { i18n, t } = useTranslation();
  const currentLanguage = i18n.resolvedLanguage?.startsWith("tr") ? "tr" : "en";

  const handleLanguageChange = (language: string) => {
    void i18n.changeLanguage(language);
  };

  return (
    <label
      className={cn(
        "relative flex h-10 items-center rounded-xl border border-[#D9E4DD] bg-white text-sm font-semibold text-[#10231B] shadow-sm",
        className,
      )}
    >
      <span className="pointer-events-none absolute left-3 text-[#00684A]">
        <Globe size={17} />
      </span>
      <span className="sr-only">{t("common.language.label")}</span>
      <select
        aria-label={t("common.language.label")}
        className="h-full appearance-none rounded-xl bg-transparent py-0 pl-9 pr-8 outline-none transition focus-visible:ring-4 focus-visible:ring-[rgba(0,104,74,0.12)]"
        value={currentLanguage}
        onChange={(event) => handleLanguageChange(event.target.value)}
      >
        <option value="en">{t("common.language.english")}</option>
        <option value="tr">{t("common.language.turkish")}</option>
      </select>
      <span className="pointer-events-none absolute right-3 text-[#5B6B63]">
        <ChevronDown size={14} />
      </span>
    </label>
  );
}
