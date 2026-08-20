import { useState } from "react";
import { Button, FormHint, Input, Label, Modal } from "@trustchain/ui";
import type { MarketplaceListing } from "../../services/marketplaceApi";

export function InstallationDialog({
  open,
  onClose,
  listing,
  pending,
  onInstall,
}: {
  open: boolean;
  onClose: () => void;
  listing: MarketplaceListing | null;
  pending?: boolean;
  onInstall: (input: {
    version?: string;
    review?: { rating: number; title: string; body?: string };
  }) => void;
}) {
  const [version, setVersion] = useState("");
  const [rating, setRating] = useState("5");
  const [title, setTitle] = useState("Great connector");
  const [body, setBody] = useState("");
  const [includeReview, setIncludeReview] = useState(true);

  return (
    <Modal open={open} title="Install connector" onClose={onClose}>
      {!listing ? (
        <FormHint>Select a listing first.</FormHint>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            onInstall({
              version: version.trim() || undefined,
              review: includeReview
                ? {
                    rating: Number(rating),
                    title,
                    body: body.trim() || undefined,
                  }
                : undefined,
            });
          }}
        >
          <p className="text-sm">
            Install <span className="font-medium">{listing.name}</span>
            {listing.latestVersion ? ` @ ${listing.latestVersion}` : ""}
          </p>
          <div>
            <Label htmlFor="mi-version">Version (optional)</Label>
            <Input
              id="mi-version"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder={listing.latestVersion ?? "1.0.0"}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeReview}
              onChange={(e) => setIncludeReview(e.target.checked)}
            />
            Leave a review with install
          </label>
          {includeReview ? (
            <>
              <div>
                <Label htmlFor="mi-rating">Rating (1–5)</Label>
                <Input
                  id="mi-rating"
                  value={rating}
                  onChange={(e) => setRating(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="mi-title">Review title</Label>
                <Input
                  id="mi-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="mi-body">Review body</Label>
                <Input id="mi-body" value={body} onChange={(e) => setBody(e.target.value)} />
              </div>
            </>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Installing…" : "Install"}
            </Button>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
