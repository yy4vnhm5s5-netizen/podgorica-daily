type DailyBriefContent = {
  key: "cityOverview";
  kind: "demo";
};

interface DailyBrief {
  content: DailyBriefContent;
  generatedAt: Date;
}

interface DailyBriefProvider {
  getDailyBrief(): Promise<DailyBrief | null>;
}

export { type DailyBrief, type DailyBriefContent, type DailyBriefProvider };
