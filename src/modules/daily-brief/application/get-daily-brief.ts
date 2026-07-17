import type { DailyBrief } from "@/modules/daily-brief/domain/daily-brief";
import { mockDailyBriefProvider } from "@/modules/daily-brief/infrastructure/mock-daily-brief-provider";

type DailyBriefResult =
  { data: DailyBrief; status: "success" } | { status: "empty" } | { status: "error" };

async function getDailyBrief(): Promise<DailyBriefResult> {
  try {
    const dailyBrief = await mockDailyBriefProvider.getDailyBrief();

    if (!dailyBrief) {
      return { status: "empty" };
    }

    return { data: dailyBrief, status: "success" };
  } catch {
    return { status: "error" };
  }
}

export { getDailyBrief, type DailyBriefResult };
