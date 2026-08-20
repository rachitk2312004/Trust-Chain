import { Button, Input } from "@trustchain/ui";

export function AuditSearchBar({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <form
      className="flex flex-col gap-2 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search actions, correlation ids, resources…"
        aria-label="Audit search"
        className="flex-1"
      />
      <Button type="submit">Search</Button>
    </form>
  );
}
