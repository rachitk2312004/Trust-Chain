export type ReportSection = {
  title: string;
  items: string[];
};

export type ReportSummary = {
  title: string;
  generatedAt: string;
  sections: ReportSection[];
  recordCount: number;
};

export function buildReportSummary(input: {
  title: string;
  sections: ReportSection[];
}): ReportSummary {
  const recordCount = input.sections.reduce((acc, section) => acc + section.items.length, 0);

  return {
    title: input.title,
    generatedAt: new Date().toISOString(),
    sections: input.sections,
    recordCount,
  };
}
