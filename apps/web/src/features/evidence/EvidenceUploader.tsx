import { useState } from "react";
import { Button, FormHint, Input, Label, Textarea } from "@trustchain/ui";

export type EvidenceUploadInput = {
  title: string;
  description?: string;
  contentText: string;
  fileName?: string;
  mimeType?: string;
  tags: string[];
  frameworks: string[];
};

export function EvidenceUploader({
  onSubmit,
  pending,
}: {
  onSubmit: (input: EvidenceUploadInput) => void;
  pending?: boolean;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [contentText, setContentText] = useState("");
  const [fileName, setFileName] = useState("");
  const [tags, setTags] = useState("access-review");
  const [frameworks, setFrameworks] = useState("soc2");

  return (
    <form
      className="space-y-3 rounded border border-[var(--tc-border)] p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          title,
          description: description || undefined,
          contentText,
          fileName: fileName || undefined,
          mimeType: fileName.endsWith(".pdf") ? "application/pdf" : "text/plain",
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          frameworks: frameworks
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        });
      }}
    >
      <FormHint>Collect evidence content (text/PDF notes). Checksum is computed server-side.</FormHint>
      <div>
        <Label htmlFor="ev-title">Title</Label>
        <Input id="ev-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div>
        <Label htmlFor="ev-file">File name</Label>
        <Input
          id="ev-file"
          value={fileName}
          onChange={(e) => setFileName(e.target.value)}
          placeholder="access-review.txt"
        />
      </div>
      <div>
        <Label htmlFor="ev-content">Content</Label>
        <Textarea
          id="ev-content"
          value={contentText}
          onChange={(e) => setContentText(e.target.value)}
          rows={5}
          required
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="ev-tags">Tags (comma-separated)</Label>
          <Input id="ev-tags" value={tags} onChange={(e) => setTags(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="ev-fw">Frameworks</Label>
          <Input
            id="ev-fw"
            value={frameworks}
            onChange={(e) => setFrameworks(e.target.value)}
            placeholder="soc2,gdpr"
          />
        </div>
      </div>
      <div>
        <Label htmlFor="ev-desc">Description</Label>
        <Textarea
          id="ev-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />
      </div>
      <Button type="submit" disabled={pending || !title || !contentText}>
        {pending ? "Collecting…" : "Collect evidence"}
      </Button>
    </form>
  );
}
