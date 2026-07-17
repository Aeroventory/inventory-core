import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Boxes, Check, Copy, ExternalLink, Info, Video, X } from "lucide-react";
import { toast } from "react-toastify";

import { Button } from "@/components/ui/button";

const DEMO_USERNAME = "admin";
const DEMO_PASSWORD = "istanbulaydin";
const DEMO_VIDEOS_URL =
  "https://drive.google.com/drive/folders/1XAjTCClNViPIRshJzRqVg1xchl77FG--?usp=drive_link";

const teamMembers = [
  {
    name: "Beytullah Paytar",
    githubUrl: "https://github.com/Beytullahp42",
  },
  {
    name: "Yiğit Bozyaka",
    githubUrl: "https://github.com/yigitbozyaka",
  },
  {
    name: "Doğan Burak Kocabaş",
    githubUrl: "https://github.com/BurakKocabas",
  },
];

type CredentialField = "username" | "password";

interface AboutDemoModalProps {
  open: boolean;
  onClose: () => void;
}

function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M12 2C6.48 2 2 6.58 2 12.26c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49 0-.24-.01-.88-.01-1.73-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.34 1.12 2.91.86.09-.67.35-1.12.63-1.38-2.22-.26-4.55-1.14-4.55-5.05 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.3 9.3 0 0 1 12 7.02c.85 0 1.7.12 2.5.34 1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.92-2.34 4.79-4.57 5.04.36.32.68.94.68 1.89 0 1.37-.01 2.47-.01 2.8 0 .27.18.59.69.49A10.26 10.26 0 0 0 22 12.26C22 6.58 17.52 2 12 2Z"
      />
    </svg>
  );
}

export default function AboutDemoModal({ open, onClose }: AboutDemoModalProps) {
  const { t } = useTranslation();
  const [copiedField, setCopiedField] = useState<CredentialField | null>(null);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    if (!copiedField) return;

    const timeoutId = window.setTimeout(() => setCopiedField(null), 1800);
    return () => window.clearTimeout(timeoutId);
  }, [copiedField]);

  if (!open) return null;

  const credentials: Array<{ field: CredentialField; label: string; value: string }> = [
    { field: "username", label: t("aboutDemo.credentials.username"), value: DEMO_USERNAME },
    { field: "password", label: t("aboutDemo.credentials.password"), value: DEMO_PASSWORD },
  ];

  const copyCredential = async (field: CredentialField, label: string, value: string) => {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API is unavailable.");
      }
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      toast.success(t("aboutDemo.copy.success", { field: label }));
    } catch {
      toast.error(t("aboutDemo.copy.error"));
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#10231B]/55 px-4 py-8"
      role="presentation"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-demo-modal-title"
        aria-describedby="about-demo-modal-description"
        className="w-full max-w-3xl overflow-hidden rounded-2xl border border-[#D9E4DD] bg-white shadow-[0_24px_70px_rgba(16,35,27,0.22)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#D9E4DD] px-5 py-5 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#E3F6EC] text-[#00684A]">
              <Info size={19} />
            </div>
            <div>
              <h2 id="about-demo-modal-title" className="text-lg font-medium text-[#10231B]">
                {t("aboutDemo.title")}
              </h2>
              <p id="about-demo-modal-description" className="mt-1 text-sm leading-6 text-[#5B6B63]">
                {t("aboutDemo.description")}
              </p>
            </div>
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label={t("aboutDemo.actions.close")} onClick={onClose}>
            <X size={18} />
          </Button>
        </div>

        <div className="max-h-[calc(100vh-9rem)] overflow-y-auto px-5 py-5 sm:px-6">
          <div className="space-y-5">
            <section className="rounded-2xl border border-[#D9E4DD] bg-[#F7FAF8] p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-[#00684A] shadow-sm">
                  <Boxes size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wide text-[#5B6B63]">
                    {t("aboutDemo.project.title")}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[#10231B]">{t("aboutDemo.project.description")}</p>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-[#D9E4DD] bg-white p-4 sm:p-5">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="text-base font-medium text-[#10231B]">{t("aboutDemo.credentials.title")}</h3>
                  <p className="mt-1 text-sm text-[#5B6B63]">{t("aboutDemo.credentials.description")}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {credentials.map((credential) => {
                  const copied = copiedField === credential.field;
                  return (
                    <div key={credential.field} className="rounded-xl border border-[#D9E4DD] bg-[#F7FAF8] p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-[#5B6B63]">{credential.label}</p>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <code className="min-w-0 truncate rounded-lg bg-white px-3 py-2 text-sm font-bold text-[#10231B]">
                          {credential.value}
                        </code>
                        <Button
                          type="button"
                          variant={copied ? "soft" : "secondary"}
                          size="icon"
                          className="shrink-0"
                          aria-label={t("aboutDemo.copy.aria", { field: credential.label })}
                          onClick={() => copyCredential(credential.field, credential.label, credential.value)}
                        >
                          {copied ? <Check size={16} /> : <Copy size={16} />}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-2xl border border-[#F4D7A2] bg-[#FFF7E6] p-4 text-[#8A5A12] sm:p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle size={20} className="mt-0.5 shrink-0" />
                <p className="text-sm font-semibold leading-6">{t("aboutDemo.warning")}</p>
              </div>
            </section>

            <section className="rounded-2xl border border-[#D9E4DD] bg-white p-4 sm:p-5">
              <h3 className="text-base font-medium text-[#10231B]">{t("aboutDemo.team.title")}</h3>
              <p className="mt-1 text-sm text-[#5B6B63]">{t("aboutDemo.team.description")}</p>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {teamMembers.map((member) => (
                  <a
                    key={member.githubUrl}
                    href={member.githubUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex min-h-20 items-center gap-3 rounded-xl border border-[#D9E4DD] bg-[#F7FAF8] px-4 py-3 text-sm font-bold text-[#10231B] transition hover:border-[#B8C9BF] hover:bg-[#E3F6EC] hover:text-[#00684A] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(0,104,74,0.12)]"
                  >
                    <GithubMark className="h-[18px] w-[18px] shrink-0" />
                    <span className="min-w-0 flex-1 leading-5">{member.name}</span>
                    <ExternalLink size={14} className="shrink-0 text-[#5B6B63]" />
                  </a>
                ))}
              </div>
            </section>

            <section className="flex flex-col gap-4 rounded-2xl border border-[#B6E8CC] bg-[#E3F6EC] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div>
                <h3 className="text-base font-medium text-[#10231B]">{t("aboutDemo.videos.title")}</h3>
                <p className="mt-1 text-sm leading-6 text-[#5B6B63]">{t("aboutDemo.videos.description")}</p>
              </div>
              <Button asChild size="lg" className="w-full shrink-0 sm:w-auto">
                <a href={DEMO_VIDEOS_URL} target="_blank" rel="noreferrer noopener">
                  <Video size={18} />
                  {t("aboutDemo.actions.viewDemoVideos")}
                  <ExternalLink size={16} />
                </a>
              </Button>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
