import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import {
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  FormError,
  FormHint,
  Input,
  Label,
  Select,
} from "@trustchain/ui";
import { Can } from "../components/Can";
import {
  useDeleteOrganization,
  useOrganization,
  useOrganizationBranding,
  useUpdateBranding,
  useUpdateOrganization,
  useUploadLogo,
} from "../features/organizations/hooks";
import { useFeedback } from "../hooks/useFeedback";
import { getOrganizationErrorMessage } from "../lib/orgErrors";

export function OrganizationSettingsPage() {
  const { organizationId = "" } = useParams();
  const org = useOrganization(organizationId);
  const branding = useOrganizationBranding(organizationId);
  const updateOrg = useUpdateOrganization(organizationId);
  const deleteOrg = useDeleteOrganization();
  const updateBranding = useUpdateBranding(organizationId);
  const uploadLogo = useUploadLogo(organizationId);
  const feedback = useFeedback();

  const [name, setName] = useState("");
  const [status, setStatus] = useState<"active" | "disabled">("active");
  const [displayName, setDisplayName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("");
  const [secondaryColor, setSecondaryColor] = useState("");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!org.data) return;
    setName(org.data.name);
    setStatus(org.data.status === "disabled" ? "disabled" : "active");
  }, [org.data]);

  useEffect(() => {
    if (!branding.data) {
      setDisplayName("");
      setPrimaryColor("");
      setSecondaryColor("");
      return;
    }
    setDisplayName(branding.data.displayName ?? "");
    setPrimaryColor(branding.data.primaryColor ?? "");
    setSecondaryColor(branding.data.secondaryColor ?? "");
  }, [branding.data]);

  function onSaveProfile(event: FormEvent) {
    event.preventDefault();
    updateOrg.mutate(
      { name: name.trim(), status },
      {
        onSuccess: () => feedback.success("Organization profile saved"),
        onError: (err) => feedback.error(err, "Could not save profile"),
      },
    );
  }

  function onSaveBranding(event: FormEvent) {
    event.preventDefault();
    updateBranding.mutate(
      {
        displayName: displayName.trim() || undefined,
        primaryColor: primaryColor.trim() || undefined,
        secondaryColor: secondaryColor.trim() || undefined,
      },
      {
        onSuccess: () => feedback.success("Branding saved"),
        onError: (err) => feedback.error(err, "Could not save branding"),
      },
    );
  }

  return (
    <div className="grid max-w-2xl gap-6">
      <Can
        capability="org.update"
        organizationId={organizationId}
        fallback={
          <Card>
            <CardHeader>
              <CardTitle>Settings</CardTitle>
              <CardDescription>Only organization admins can change these settings.</CardDescription>
            </CardHeader>
          </Card>
        }
      >
        <Card>
          <CardHeader>
            <CardTitle>Organization profile</CardTitle>
            <CardDescription>Update name and operational status.</CardDescription>
          </CardHeader>
          <form className="flex flex-col gap-3" onSubmit={onSaveProfile}>
            <Field>
              <Label htmlFor="profile-name">Name</Label>
              <Input
                id="profile-name"
                required
                minLength={2}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field>
              <Label htmlFor="profile-status">Status</Label>
              <Select
                id="profile-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as "active" | "disabled")}
              >
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </Select>
            </Field>
            <FormError>
              {updateOrg.error ? getOrganizationErrorMessage(updateOrg.error) : null}
            </FormError>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={updateOrg.isPending}>
                {updateOrg.isPending ? "Saving…" : "Save profile"}
              </Button>
              <Can capability="org.disable" organizationId={organizationId}>
                <Button
                  type="button"
                  variant="danger"
                  disabled={deleteOrg.isPending || org.data?.status === "disabled"}
                  onClick={() => {
                    if (confirm("Disable this organization? This is a soft delete.")) {
                      deleteOrg.mutate(organizationId, {
                        onSuccess: () => feedback.warning("Organization disabled"),
                        onError: (err) => feedback.error(err, "Disable failed"),
                      });
                    }
                  }}
                >
                  {deleteOrg.isPending ? "Disabling…" : "Disable organization"}
                </Button>
              </Can>
            </div>
            <FormError>
              {deleteOrg.error ? getOrganizationErrorMessage(deleteOrg.error) : null}
            </FormError>
          </form>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Branding</CardTitle>
            <CardDescription>Display name, colors, and logo.</CardDescription>
          </CardHeader>
          <form className="flex flex-col gap-3" onSubmit={onSaveBranding}>
            <Field>
              <Label htmlFor="brand-display">Display name</Label>
              <Input
                id="brand-display"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </Field>
            <Field>
              <Label htmlFor="brand-primary">Primary color</Label>
              <Input
                id="brand-primary"
                placeholder="#0f5c4c"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
              />
            </Field>
            <Field>
              <Label htmlFor="brand-secondary">Secondary color</Label>
              <Input
                id="brand-secondary"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
              />
            </Field>
            <Field>
              <Label htmlFor="brand-logo">Logo</Label>
              <Input
                id="brand-logo"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setLogoPreview(URL.createObjectURL(file));
                  uploadLogo.mutate(file, {
                    onSuccess: (result) => {
                      setLogoPreview(result.previewUrl);
                      feedback.success("Logo uploaded");
                    },
                    onError: (err) => feedback.error(err, "Logo upload failed"),
                  });
                }}
              />
              <FormHint>
                PNG, JPEG, WebP, or SVG. Uploads via presigned URL, then stores the object key.
              </FormHint>
              {(logoPreview || branding.data?.logoObjectKey) && (
                <div className="mt-2 flex items-center gap-3 rounded-md border border-[var(--tc-border)] p-3">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo preview" className="h-16 w-16 object-contain" />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center bg-[var(--tc-surface-2)] text-xs text-[var(--tc-muted)]">
                      Stored
                    </div>
                  )}
                  <p className="break-all text-xs text-[var(--tc-muted)]">
                    {branding.data?.logoObjectKey ?? "Uploading…"}
                  </p>
                </div>
              )}
            </Field>
            <FormError>
              {updateBranding.error
                ? getOrganizationErrorMessage(updateBranding.error)
                : uploadLogo.error
                  ? getOrganizationErrorMessage(uploadLogo.error)
                  : null}
            </FormError>
            <Button type="submit" disabled={updateBranding.isPending}>
              {updateBranding.isPending ? "Saving…" : "Save branding"}
            </Button>
          </form>
        </Card>
      </Can>
    </div>
  );
}
