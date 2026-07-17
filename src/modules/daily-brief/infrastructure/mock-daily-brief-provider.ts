import type { DailyBrief, DailyBriefProvider } from "@/modules/daily-brief/domain/daily-brief";

const mockDailyBriefProvider: DailyBriefProvider = {
  async getDailyBrief(): Promise<DailyBrief> {
    return {
      content: {
        key: "cityOverview",
        kind: "demo",
      },
      generatedAt: new Date(),
    };
  },
};

export { mockDailyBriefProvider };
