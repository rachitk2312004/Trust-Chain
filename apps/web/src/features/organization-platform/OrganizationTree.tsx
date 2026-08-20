import { FormHint } from "@trustchain/ui";
import type { OrgHierarchyNode } from "../../services/organizationPlatformApi";

function NodeList({ nodes, depth = 0 }: { nodes: OrgHierarchyNode[]; depth?: number }) {
  return (
    <ul className={depth === 0 ? "space-y-2" : "mt-2 space-y-2 border-l border-[var(--tc-border)] pl-4"}>
      {nodes.map((n) => (
        <li key={n.id}>
          <div className="flex flex-wrap items-baseline gap-2 text-sm">
            <span className="font-medium">{n.name}</span>
            <span className="font-mono text-xs text-[var(--tc-muted)]">
              {n.type} · {n.key}
            </span>
          </div>
          {n.children && n.children.length > 0 ? (
            <NodeList nodes={n.children} depth={depth + 1} />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function OrganizationTree({ tree }: { tree: OrgHierarchyNode[] }) {
  if (tree.length === 0) {
    return <FormHint>Hierarchy is empty. Add business units and departments to populate the tree.</FormHint>;
  }
  return <NodeList nodes={tree} />;
}
