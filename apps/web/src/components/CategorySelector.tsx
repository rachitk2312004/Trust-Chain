import { useState, type FormEvent } from "react";
import { Button, Field, FormHint, Input, Label, Select } from "@trustchain/ui";
import { useCreateCategory, useDocumentCategories } from "../features/documents/hooks";

export function CategorySelector({
  organizationId,
  value,
  onChange,
  id = "category-selector",
  allowCreate = true,
}: {
  organizationId: string;
  value: string;
  onChange: (categoryId: string) => void;
  id?: string;
  allowCreate?: boolean;
}) {
  const categories = useDocumentCategories(organizationId);
  const create = useCreateCategory(organizationId);
  const [newName, setNewName] = useState("");

  function onCreate(event: FormEvent) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    create.mutate(
      { name },
      {
        onSuccess: (category) => {
          setNewName("");
          onChange(category.id);
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Field>
        <Label htmlFor={id}>Category</Label>
        <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">No category</option>
          {(categories.data ?? []).map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </Select>
      </Field>
      {allowCreate ? (
        <form className="flex flex-wrap items-end gap-2" onSubmit={onCreate}>
          <Field className="min-w-[10rem] flex-1">
            <Label htmlFor={`${id}-new`}>New category</Label>
            <Input
              id={`${id}-new`}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Name"
            />
          </Field>
          <Button type="submit" size="sm" variant="secondary" disabled={create.isPending || !newName.trim()}>
            {create.isPending ? "Adding…" : "Add"}
          </Button>
        </form>
      ) : null}
      {categories.isLoading ? <FormHint>Loading categories…</FormHint> : null}
    </div>
  );
}
