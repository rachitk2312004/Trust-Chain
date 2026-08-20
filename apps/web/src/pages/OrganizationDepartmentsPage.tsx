import { useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import {
  Button,
  Field,
  FormError,
  Input,
  Label,
  Modal,
  Select,
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
  useCreateDepartment,
  useDeleteDepartment,
  useDepartments,
} from "../features/organizations/hooks";
import { useFeedback } from "../hooks/useFeedback";
import { getOrganizationErrorMessage } from "../lib/orgErrors";

export function OrganizationDepartmentsPage() {
  const { organizationId = "" } = useParams();
  const departments = useDepartments(organizationId);
  const branches = useBranches(organizationId);
  const create = useCreateDepartment(organizationId);
  const remove = useDeleteDepartment(organizationId);
  const feedback = useFeedback();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [branchId, setBranchId] = useState("");

  const branchName = new Map((branches.data ?? []).map((b) => [b.id, b.name]));

  function onCreate(event: FormEvent) {
    event.preventDefault();
    create.mutate(
      {
        name: name.trim(),
        code: code.trim() || undefined,
        branchId: branchId || undefined,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setName("");
          setCode("");
          setBranchId("");
          feedback.success("Department created");
        },
        onError: (err) => feedback.error(err, "Could not create department"),
      },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Can capability="org.departments.manage" organizationId={organizationId}>
          <Button onClick={() => setOpen(true)}>Add department</Button>
        </Can>
      </div>

      {departments.isError ? (
        <FormError>{getOrganizationErrorMessage(departments.error)}</FormError>
      ) : null}
      {remove.isError ? <FormError>{getOrganizationErrorMessage(remove.error)}</FormError> : null}

      {departments.isLoading ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading departments…</p>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Code</TH>
              <TH>Branch</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {(departments.data ?? []).map((department) => (
              <TR key={department.id}>
                <TD>{department.name}</TD>
                <TD>{department.code ?? "—"}</TD>
                <TD>
                  {department.branchId ? (branchName.get(department.branchId) ?? department.branchId) : "—"}
                </TD>
                <TD>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(department.id)}
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
        title="Add department"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="create-department-form" disabled={create.isPending}>
              {create.isPending ? "Saving…" : "Create"}
            </Button>
          </>
        }
      >
        <form id="create-department-form" className="flex flex-col gap-3" onSubmit={onCreate}>
          <Field>
            <Label htmlFor="dept-name">Name</Label>
            <Input
              id="dept-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field>
            <Label htmlFor="dept-code">Code</Label>
            <Input id="dept-code" value={code} onChange={(e) => setCode(e.target.value)} />
          </Field>
          <Field>
            <Label htmlFor="dept-branch">Branch (optional)</Label>
            <Select
              id="dept-branch"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
            >
              <option value="">None</option>
              {(branches.data ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>
          <FormError>{create.error ? getOrganizationErrorMessage(create.error) : null}</FormError>
        </form>
      </Modal>
    </div>
  );
}
