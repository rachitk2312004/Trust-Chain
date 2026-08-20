/// <reference types="vitest" />
import { describe, expect, it, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { ReactElement } from "react";
import { ToastProvider } from "@trustchain/ui";
import { axe } from "vitest-axe";
import { LoginPage } from "../pages/LoginPage";
import { OrganizationsPage } from "../pages/OrganizationsPage";
import { DocumentsPage } from "../pages/DocumentsPage";
import { QrPage } from "../pages/QrPage";
import { applyAuthSession, clearAuthSession } from "../lib/authSession";
import { useSessionStore } from "../lib/sessionStore";
import { tokenVault } from "../lib/tokenVault";
import { fixtures } from "./msw/handlers";
import { verificationApi } from "../services/verificationApi";
import { documentApi } from "../services/documentApi";
import { qrApi } from "../services/qrApi";
import { authApi } from "../services/authApi";

function renderWithProviders(ui: ReactElement, route = "/") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe("Phase A portal hardening critical path", () => {
  beforeEach(() => {
    clearAuthSession();
    tokenVault.clear();
    useSessionStore.setState({
      accessToken: null,
      refreshToken: null,
      user: null,
      roles: [],
      mfaToken: null,
      activeOrganizationId: null,
      bootStatus: "anonymous",
    });
  });

  it("logs in and stores tokens outside localStorage", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<div>Dashboard ready</div>} />
      </Routes>,
      "/login",
    );

    await user.type(screen.getByLabelText(/email/i), "admin@example.com");
    await user.type(screen.getByLabelText(/password/i), "Password123!");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText("Dashboard ready")).toBeInTheDocument();
    });

    expect(tokenVault.getAccessToken()).toBe("access-token");
    expect(tokenVault.getRefreshToken()).toBe("refresh-token");
    expect(localStorage.getItem("trustchain.web.session")).toBeNull();
    expect(JSON.stringify(localStorage)).not.toContain("access-token");
  });

  it("selects organization, uploads, verifies, and generates QR via APIs", async () => {
    applyAuthSession({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      sessionId: "55555555-5555-5555-5555-555555555555",
      deviceId: null,
      user: fixtures.user,
    });
    useSessionStore.getState().setRoles([
      {
        roleKey: "org_admin",
        roleName: "Org Admin",
        organizationId: fixtures.organization.id,
      },
    ]);
    useSessionStore.getState().setActiveOrganizationId(fixtures.organization.id);

    const me = await authApi.me();
    expect(me.data.memberships[0]?.organizationId).toBe(fixtures.organization.id);

    const list = await documentApi.list(fixtures.organization.id);
    expect(list.data.documents[0]?.title).toBe("Certificate of Origin");

    // Upload path (create → upload-url → PUT → confirm)
    const created = await documentApi.create(fixtures.organization.id, {
      title: "Certificate of Origin",
    });
    const upload = await documentApi.createUploadUrl(
      fixtures.organization.id,
      created.data.document.id,
      {
        mimeType: "application/pdf",
        originalFileName: "cert.pdf",
        expectedSizeBytes: 12,
      },
    );
    const put = await fetch(upload.data.uploadUrl, {
      method: "PUT",
      headers: { "content-type": "application/pdf" },
      body: new Blob(["pdf-bytes"]),
    });
    expect(put.ok).toBe(true);
    const confirmed = await documentApi.confirmVersion(
      fixtures.organization.id,
      created.data.document.id,
      {
        uploadSessionId: upload.data.uploadSession.id,
        contentHash: "a".repeat(64),
        mimeType: "application/pdf",
        sizeBytes: 12,
        originalFileName: "cert.pdf",
        activate: true,
      },
    );
    expect(confirmed.data.document.id).toBe(fixtures.document.id);

    const verification = await verificationApi.verifyDocument(
      fixtures.organization.id,
      fixtures.document.id,
      {},
    );
    expect(verification.data.report?.verificationResult).toBe("valid");

    const createdQr = await qrApi.create(fixtures.organization.id, fixtures.document.id, {
      formatVersion: "V1",
      visibility: "restricted",
    });
    expect(createdQr.data.qr.publicCode).toBe("QR-PUBLIC-001");
  });

  it("renders organization picker with accessible switcher controls", async () => {
    applyAuthSession({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      sessionId: "55555555-5555-5555-5555-555555555555",
      deviceId: null,
      user: fixtures.user,
    });
    useSessionStore.getState().setRoles([
      {
        roleKey: "org_admin",
        roleName: "Org Admin",
        organizationId: fixtures.organization.id,
      },
    ]);

    const { container } = renderWithProviders(
      <Routes>
        <Route path="/organizations" element={<OrganizationsPage />} />
      </Routes>,
      "/organizations",
    );

    await waitFor(() => {
      expect(screen.getAllByText("Acme Trust").length).toBeGreaterThan(0);
    });
    expect(screen.getByRole("combobox", { name: /active organization/i })).toBeInTheDocument();

    const results = await axe(container);
    // Color-contrast noise from CSS variables in jsdom is ignored; structural issues are not.
    const serious = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
    expect(serious).toEqual([]);
  });

  it("hides document upload for users without membership capability", async () => {
    applyAuthSession({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      sessionId: "55555555-5555-5555-5555-555555555555",
      deviceId: null,
      user: fixtures.user,
    });
    useSessionStore.getState().setActiveOrganizationId(fixtures.organization.id);
    useSessionStore.getState().setRoles([]); // no org membership roles

    renderWithProviders(
      <Routes>
        <Route path="/documents" element={<DocumentsPage />} />
      </Routes>,
      "/documents",
    );

    await waitFor(() => {
      expect(screen.getByText(/Certificate of Origin|Loading documents/i)).toBeTruthy();
    });
    expect(screen.queryByRole("button", { name: /^upload$/i })).not.toBeInTheDocument();
  });

  it("shows generate QR for org admins", async () => {
    applyAuthSession({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      sessionId: "55555555-5555-5555-5555-555555555555",
      deviceId: null,
      user: fixtures.user,
    });
    useSessionStore.getState().setActiveOrganizationId(fixtures.organization.id);
    useSessionStore.getState().setRoles([
      {
        roleKey: "org_admin",
        roleName: "Org Admin",
        organizationId: fixtures.organization.id,
      },
    ]);

    renderWithProviders(
      <Routes>
        <Route path="/qr" element={<QrPage />} />
      </Routes>,
      "/qr",
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /generate qr/i })).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /generate qr/i }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/generate qr code/i)).toBeInTheDocument();
    expect(within(dialog).getByRole("combobox", { name: /^document$/i })).toBeInTheDocument();
  });
});
