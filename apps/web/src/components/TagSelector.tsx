import { useState, type FormEvent } from "react";
import { Badge, Button, Field, FormHint, Input, Label } from "@trustchain/ui";
import { useCreateTag, useDocumentTags } from "../features/documents/hooks";

export function TagSelector({
  organizationId,
  value,
  onChange,
}: {
  organizationId: string;
  value: string[];
  onChange: (tagIds: string[]) => void;
}) {
  const tags = useDocumentTags(organizationId);
  const create = useCreateTag(organizationId);
  const [newName, setNewName] = useState("");

  function toggle(tagId: string) {
    if (value.includes(tagId)) {
      onChange(value.filter((id) => id !== tagId));
    } else {
      onChange([...value, tagId]);
    }
  }

  function onCreate(event: FormEvent) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    create.mutate(
      { name },
      {
        onSuccess: (tag) => {
          setNewName("");
          if (!value.includes(tag.id)) onChange([...value, tag.id]);
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>Tags</Label>
      <div className="flex flex-wrap gap-2">
        {(tags.data ?? []).map((tag) => {
          const selected = value.includes(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => toggle(tag.id)}
              className="rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tc-accent)]"
            >
              <Badge tone={selected ? "info" : "neutral"}>{tag.name}</Badge>
            </button>
          );
        })}
        {(tags.data ?? []).length === 0 && !tags.isLoading ? (
          <FormHint>No tags yet.</FormHint>
        ) : null}
      </div>
      <form className="flex flex-wrap items-end gap-2" onSubmit={onCreate}>
        <Field className="min-w-[10rem] flex-1">
          <Label htmlFor="new-tag">New tag</Label>
          <Input
            id="new-tag"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Name"
          />
        </Field>
        <Button type="submit" size="sm" variant="secondary" disabled={create.isPending || !newName.trim()}>
          {create.isPending ? "Adding…" : "Add"}
        </Button>
      </form>
    </div>
  );
}
