import { useMemo, useState } from "react";
import { Field, FormHint, Input, Label, Select } from "@trustchain/ui";
import { useDocuments, useSearchDocuments } from "../features/documents/hooks";

export function DocumentPicker({
  organizationId,
  value,
  onChange,
  required,
  id = "document-picker",
  label = "Document",
}: {
  organizationId: string;
  value: string;
  onChange: (documentId: string) => void;
  required?: boolean;
  id?: string;
  label?: string;
}) {
  const [filter, setFilter] = useState("");
  const list = useDocuments(organizationId, { limit: 50, offset: 0, status: "active" });
  const search = useSearchDocuments(organizationId, filter, filter.trim().length >= 2);

  const options = useMemo(() => {
    if (filter.trim().length >= 2) return search.data?.documents ?? [];
    return list.data?.documents ?? [];
  }, [filter, list.data, search.data]);

  const selectedMissing =
    value && !options.some((d) => d.id === value)
      ? { id: value, title: `Selected (${value.slice(0, 8)}…)` }
      : null;

  return (
    <div className="flex flex-col gap-2">
      <Input
        placeholder="Search documents by title…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        aria-label="Search documents"
      />
      <Field>
        <Label htmlFor={id}>{label}</Label>
        <Select
          id={id}
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
        <option value="">Select a document</option>
        {selectedMissing ? (
          <option value={selectedMissing.id}>{selectedMissing.title}</option>
        ) : null}
        {options.map((doc) => (
          <option key={doc.id} value={doc.id}>
            {doc.title}
          </option>
        ))}
        </Select>
      </Field>
      {list.isLoading || search.isFetching ? (
        <FormHint>Loading documents…</FormHint>
      ) : options.length === 0 ? (
        <FormHint>No documents found. Upload one first.</FormHint>
      ) : null}
    </div>
  );
}
