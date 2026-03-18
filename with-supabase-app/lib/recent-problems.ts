const STORAGE_KEY = "recent_problems";
const MAX_ITEMS = 10;

export interface RecentProblem {
  problemId: string;
  problemTitle: string;
  problemUrl: string;
  contestId: string;
  difficulty: number | null;
  viewedAt: number;
}

export function saveRecentProblem(problem: Omit<RecentProblem, "viewedAt">) {
  if (typeof window === "undefined") return;
  try {
    const existing = getRecentProblems();
    const filtered = existing.filter((p) => p.problemId !== problem.problemId);
    const updated = [{ ...problem, viewedAt: Date.now() }, ...filtered].slice(0, MAX_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {}
}

export function getRecentProblems(): RecentProblem[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}
