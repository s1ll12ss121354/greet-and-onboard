import { useEffect, useState } from "react";

export type Language = "ru" | "en";

export function useLanguage() {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window === "undefined") return "ru";
    return window.localStorage.getItem("recorn-language") === "en" ? "en" : "ru";
  });

  useEffect(() => {
    const sync = () => setLanguageState(window.localStorage.getItem("recorn-language") === "en" ? "en" : "ru");
    window.addEventListener("recorn-language-change", sync);
    return () => window.removeEventListener("recorn-language-change", sync);
  }, []);

  function setLanguage(next: Language) {
    window.localStorage.setItem("recorn-language", next);
    setLanguageState(next);
    window.dispatchEvent(new Event("recorn-language-change"));
  }

  return { language, setLanguage };
}
