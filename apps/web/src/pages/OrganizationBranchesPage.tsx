import { useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import {
  Button,
  Field,
  FormError,
  Input,
  Label,
  Modal,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@trustchain/ui";
import { Can } from "../components/Can";
import {
  useBranches,
  useCreateBranch,
  useDeleteBranch,
} from "../features/organizations/hooks";
import { useFeedback } from "../hooks/useFeedback";
import { getOrganizationErrorMessage } from "../lib/orgErrors";

export function OrganizationBranchesPage() {
  const { organizationId = "" } = useParams();
  const branches = useBranches(organizationId);
  const create = useCreateBranch(organizationId);
  const remove = useDeleteBranch(organizationId);
  const feedback = useFeedback();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [city, setCity] = useState("");

  function onCreate(event: FormEvent) {
    event.preventDefault();
    create.mutate(
      {
        name: name.trim(),
        code: code.trim() || undefined,
        city: city.trim() || undefined,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setName("");
          setCode("");
          setCity("");
          feedback.success("Branch created");
        },
        onError: (err) => feedback.error(err, "Could not create branch"),
      },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Can capability="org.branches.manage" organizationId={organizationId}>
          <Button onClick={() => setOpen(true)}>Add branch</Button>
        </Can>
      </div>

      {branches.isError ? (
        <FormError>{getOrganizationErrorMessage(branches.error)}</FormError>
      ) : null}
      {remove.isError ? <FormError>{getOrganizationErrorMessage(remove.error)}</FormError> : null}

      {branches.isLoading ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading branches…</p>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Code</TH>
              <TH>City</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {(branches.data ?? []).map((branch) => (
              <TR key={branch.id}>
                <TD>{branch.name}</TD>
                <TD>{branch.code ?? "—"}</TD>
                <TD>{branch.city ?? "—"}</TD>
                <TD>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(branch.id)}
                  >
                    Delete
                  </Button>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal
        open={open}
        title="Add branch"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="create-branch-form" disabled={create.isPending}>
              {create.isPending ? "Saving…" : "Create"}
            </Button>
          </>
        }
      >
        <form id="create-branch-form" className="flex flex-col gap-3" onSubmit={onCreate}>
          <Field>
            <Label htmlFor="branch-name">Name</Label>
            <Input
              id="branch-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field>
            <Label htmlFor="branch-code">Code</Label>
            <Input id="branch-code" value={code} onChange={(e) => setCode(e.target.value)} />
          </Field>
          <Field>
            <Label htmlFor="branch-city">City</Label>
            <Input id="branch-city" value={city} onChange={(e) => setCity(e.target.value)} />
          </Field>
          <FormError>{create.error ? getOrganizationErrorMessage(create.error) : null}</FormError>
        </form>
      </Modal>
    </div>
  );
}
