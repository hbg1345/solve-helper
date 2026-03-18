import { cookies } from "next/headers";
import { Lang, Translations, translations } from "./translations";

export async function getLang(): Promise<Lang> {
  const cookieStore = await cookies();
  const lang = cookieStore.get("appLanguage")?.value;
  if (lang === "en" || lang === "ja" || lang === "ko") return lang;
  return "ko";
}

export async function getServerTr(): Promise<Translations> {
  const lang = await getLang();
  return translations[lang];
}
