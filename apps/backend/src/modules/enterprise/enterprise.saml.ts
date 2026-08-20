import { EnterpriseDefaults, EnterpriseSamlStatuses } from "@trustchain/config";
import { AppError } from "../../lib/errors.js";

export type SamlAttributeMapping = {
  email: string;
  firstName?: string;
  lastName?: string;
  groups?: string;
  department?: string;
};

export type SamlConfigInput = {
  entityId: string;
  acsUrl: string;
  idpEntityId: string;
  idpSsoUrl: string;
  idpCertificatePem: string;
  attributeMapping?: Partial<SamlAttributeMapping> | null;
  status?: string;
};

const DEFAULT_MAPPING: SamlAttributeMapping = {
  email: "email",
  firstName: "firstName",
  lastName: "lastName",
  groups: "groups",
  department: "department",
};

export function normalizeAttributeMapping(
  mapping?: Partial<SamlAttributeMapping> | null,
): SamlAttributeMapping {
  return {
    email: (mapping?.email ?? DEFAULT_MAPPING.email).trim() || DEFAULT_MAPPING.email,
    firstName: mapping?.firstName?.trim() || DEFAULT_MAPPING.firstName,
    lastName: mapping?.lastName?.trim() || DEFAULT_MAPPING.lastName,
    groups: mapping?.groups?.trim() || DEFAULT_MAPPING.groups,
    department: mapping?.department?.trim() || DEFAULT_MAPPING.department,
  };
}

export function validateSamlConfig(input: SamlConfigInput): {
  entityId: string;
  acsUrl: string;
  idpEntityId: string;
  idpSsoUrl: string;
  idpCertificatePem: string;
  attributeMapping: SamlAttributeMapping;
  status: string;
} {
  const entityId = input.entityId.trim();
  const acsUrl = input.acsUrl.trim();
  const idpEntityId = input.idpEntityId.trim();
  const idpSsoUrl = input.idpSsoUrl.trim();
  const idpCertificatePem = input.idpCertificatePem.trim();

  if (!entityId || entityId.length > 500) {
    throw new AppError(400, "VALIDATION_ERROR", "Invalid SAML entityId");
  }
  if (!/^https?:\/\//i.test(acsUrl)) {
    throw new AppError(400, "VALIDATION_ERROR", "ACS URL must be http(s)");
  }
  if (!/^https?:\/\//i.test(idpSsoUrl)) {
    throw new AppError(400, "VALIDATION_ERROR", "IdP SSO URL must be http(s)");
  }
  if (!idpEntityId) {
    throw new AppError(400, "VALIDATION_ERROR", "IdP entity id required");
  }
  if (!idpCertificatePem.includes("BEGIN CERTIFICATE")) {
    throw new AppError(400, "VALIDATION_ERROR", "IdP certificate must be PEM");
  }

  const status = input.status ?? EnterpriseSamlStatuses.draft;
  return {
    entityId,
    acsUrl,
    idpEntityId,
    idpSsoUrl,
    idpCertificatePem,
    attributeMapping: normalizeAttributeMapping(input.attributeMapping),
    status,
  };
}

export function buildSpMetadataXml(input: {
  entityId: string;
  acsUrl: string;
  organizationName?: string;
}): string {
  const name = escapeXml(input.organizationName ?? "TrustChain");
  return `<?xml version="1.0" encoding="UTF-8"?>
<EntityDescriptor entityID="${escapeXml(input.entityId)}" xmlns="urn:oasis:names:tc:SAML:2.0:metadata">
  <SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol" AuthnRequestsSigned="false" WantAssertionsSigned="true">
    <AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${escapeXml(input.acsUrl)}" index="0" isDefault="true"/>
  </SPSSODescriptor>
  <Organization>
    <OrganizationName xml:lang="en">${name}</OrganizationName>
    <OrganizationDisplayName xml:lang="en">${name}</OrganizationDisplayName>
  </Organization>
</EntityDescriptor>`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function mapSamlAttributes(
  attributes: Record<string, string | string[] | undefined>,
  mapping: SamlAttributeMapping,
): {
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  groups: string[];
  department: string | null;
} {
  const read = (key: string | undefined): string | null => {
    if (!key) return null;
    const raw = attributes[key];
    if (Array.isArray(raw)) return raw[0] ?? null;
    return raw ?? null;
  };
  const groupsRaw = mapping.groups ? attributes[mapping.groups] : undefined;
  const groups = Array.isArray(groupsRaw)
    ? groupsRaw.filter(Boolean)
    : typeof groupsRaw === "string" && groupsRaw
      ? [groupsRaw]
      : [];

  return {
    email: read(mapping.email),
    firstName: read(mapping.firstName),
    lastName: read(mapping.lastName),
    groups,
    department: read(mapping.department),
  };
}

void EnterpriseDefaults;
