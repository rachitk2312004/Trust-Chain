import { Button, Input } from "@trustchain/ui";

export function SearchBar({
  value,
  onChange,
  onSubmit,
  placeholder = "Search documents, certificates, signatures…",
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
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
        placeholder={placeholder}
        aria-label="Search query"
        className="flex-1"
      />
      <Button type="submit">Search</Button>
    </form>
  );
}
