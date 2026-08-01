export type ChecklistItem = {
  id: string;
  label: string;
  completed: boolean;
};

export type ComplianceChecklist = {
  framework: string;
  items: ChecklistItem[];
  completionRate: number;
};

function buildChecklist(framework: string, labels: string[]): ComplianceChecklist {
  const items = labels.map((label, index) => ({
    id: `${framework}-${index + 1}`,
    label,
    completed: false,
  }));
  return {
    framework,
    items,
    completionRate: 0,
  };
}

export function gdprChecklist(): ComplianceChecklist {
  return buildChecklist("gdpr", [
    "Data processing inventory documented",
    "Lawful basis recorded for personal data",
    "Data subject access request process defined",
    "Breach notification procedure in place",
  ]);
}

export function soc2Checklist(): ComplianceChecklist {
  return buildChecklist("soc2", [
    "Access controls reviewed",
    "Change management logs maintained",
    "Monitoring alerts configured",
    "Vendor risk assessments current",
  ]);
}

export function iso27001Checklist(): ComplianceChecklist {
  return buildChecklist("iso27001", [
    "ISMS scope documented",
    "Risk assessment completed",
    "Asset inventory maintained",
    "Incident response plan tested",
  ]);
}

export function markItemComplete(
  checklist: ComplianceChecklist,
  itemId: string,
): ComplianceChecklist {
  const items = checklist.items.map((item) =>
    item.id === itemId ? { ...item, completed: true } : item,
  );
  const completed = items.filter((item) => item.completed).length;
  return {
    ...checklist,
    items,
    completionRate: items.length > 0 ? completed / items.length : 0,
  };
}
