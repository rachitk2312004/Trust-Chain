import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
import { PageHeader } from "../components/PageHeader";
import {
  BulkPreviewPanel,
  BulkProgressPanel,
  useCertificateBulkJob,
  useCertificateTemplates,
  usePreviewCertificateBulk,
  useStartCertificateBulk,
} from "../features/certificates";
import { useFeedback } from "../hooks/useFeedback";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { getCertificateErrorMessage } from "../lib/certificateErrors";
import { useSessionStore } from "../lib/sessionStore";
import type { CertificateBulkFormat, CertificateBulkPreview } from "../types/api";

export function BulkUploadPage() {
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const [params, setParams] = useSearchParams();
  const jobId = params.get("jobId") || undefined;
  const feedback = useFeedback();

  const templates = useCertificateTemplates(organizationId);
  const previewMutation = usePreviewCertificateBulk(organizationId ?? "");
  const startMutation = useStartCertificateBulk(organizationId ?? "");
  const jobQuery = useCertificateBulkJob(organizationId, jobId);

  const [format, setFormat] = useState<CertificateBulkFormat>("csv");
  const [defaultTitle, setDefaultTitle] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [fileName, setFileName] = useState("");
  const [content, setContent] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<CertificateBulkPreview | null>(null);

  const activeTemplates = useMemo(
    () => (templates.data ?? []).filter((t) => t.status === "active"),
    [templates.data],
  );

  async function readFile(file: File) {
    const text = await file.text();
    setFileName(file.name);
    setContent(text);
    setPreview(null);
    if (file.name.toLowerCase().endsWith(".json")) setFormat("json");
    else if (file.name.toLowerCase().endsWith(".csv")) setFormat("csv");
  }

  function runPreview() {
    if (!organizationId || !content.trim()) return;
    previewMutation.mutate(
      {
        format,
        content,
        defaultTemplateId: templateId || null,
      },
      {
        onSuccess: (data) => {
          setPreview(data);
          feedback.success(
            data.valid ? "Preview ready" : "Preview complete with validation issues",
          );
        },
        onError: (err) => feedback.error(err, "Preview failed"),
      },
    );
  }

  function startJob() {
    if (!organizationId || !content.trim()) return;
    startMutation.mutate(
      {
        format,
        content,
        defaultTitle: defaultTitle.trim() || null,
        defaultTemplateId: templateId || null,
        rollbackOnCancel: true,
        requireAllValid: true,
      },
      {
        onSuccess: (data) => {
          setPreview(data.preview);
          setParams({ jobId: data.job.jobId });
          feedback.success("Bulk issuance started");
        },
        onError: (err) => feedback.error(err, "Could not start bulk job"),
      },
    );
  }

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="Bulk certificates" />
        <FormHint>
          Select an organization first, or{" "}
          <Link to="/organizations" className="text-[var(--tc-accent)] hover:underline">
            create one
          </Link>
          .
        </FormHint>
      </AppShellLayout>
    );
  }

  return (
    <AppShellLayout>
      <PageHeader
        title="Bulk certificate issuance"
        description="Import CSV or JSON, validate rows, then process with progress and cancellation."
        actions={
          <Link to="/certificates" className="text-sm text-[var(--tc-accent)] hover:underline">
            All certificates
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Upload</CardTitle>
            <CardDescription>Drag and drop CSV/JSON or choose a file</CardDescription>
          </CardHeader>

          <Can
            capability="certificates.issue"
            organizationId={organizationId}
            fallback={<FormHint>You need issue permission to run bulk imports.</FormHint>}
          >
            <div
              className={`mb-4 rounded border border-dashed p-8 text-center text-sm ${
                dragOver
                  ? "border-[var(--tc-accent)] bg-[var(--tc-surface-2)]"
                  : "border-[var(--tc-border)]"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file) void readFile(file);
              }}
            >
              <p className="mb-2">Drop file here</p>
              <label className="cursor-pointer text-[var(--tc-accent)] hover:underline">
                Browse files
                <input
                  type="file"
                  accept=".csv,.json,text/csv,application/json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void readFile(file);
                  }}
                />
              </label>
              {fileName ? (
                <p className="mt-2 text-xs text-[var(--tc-muted)]">
                  {fileName} · {content.length.toLocaleString()} chars
                </p>
              ) : null}
            </div>

            <div className="mb-3 grid gap-3 sm:grid-cols-2">
              <Field>
                <Label htmlFor="bulk-format">Format</Label>
                <Select
                  id="bulk-format"
                  value={format}
                  onChange={(e) => setFormat(e.target.value as CertificateBulkFormat)}
                >
                  <option value="csv">CSV</option>
                  <option value="json">JSON</option>
                </Select>
              </Field>
              <Field>
                <Label htmlFor="bulk-template">Default template</Label>
                <Select
                  id="bulk-template"
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                >
                  <option value="">None</option>
                  {activeTemplates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name} ({tpl.code})
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field className="mb-3">
              <Label htmlFor="bulk-title">Default title (optional)</Label>
              <Input
                id="bulk-title"
                value={defaultTitle}
                onChange={(e) => setDefaultTitle(e.target.value)}
                placeholder="Certificate of Completion"
              />
            </Field>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                disabled={!content || previewMutation.isPending}
                onClick={runPreview}
              >
                {previewMutation.isPending ? "Validating…" : "Preview & validate"}
              </Button>
              <Button
                disabled={!content || startMutation.isPending || (preview ? !preview.valid : false)}
                onClick={startJob}
              >
                {startMutation.isPending ? "Starting…" : "Start issuance"}
              </Button>
            </div>

            <FormError>
              {previewMutation.error
                ? getCertificateErrorMessage(previewMutation.error)
                : startMutation.error
                  ? getCertificateErrorMessage(startMutation.error)
                  : null}
            </FormError>
          </Can>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Progress</CardTitle>
            <CardDescription>Live job status, failures, and cancellation</CardDescription>
          </CardHeader>
          {jobQuery.isError ? (
            <FormError>{getCertificateErrorMessage(jobQuery.error)}</FormError>
          ) : null}
          <BulkProgressPanel organizationId={organizationId} job={jobQuery.data} />
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Preview table</CardTitle>
          <CardDescription>Validation reporting before issuance</CardDescription>
        </CardHeader>
        <BulkPreviewPanel preview={preview} />
      </Card>
    </AppShellLayout>
  );
}
