/**
 * Public web app base URL for links in emails and certificate verification URLs.
 */
export function getPublicAppUrl(): string {
  return (
    process.env.PUBLIC_APP_URL?.replace(/\/$/, "") ??
    process.env.CORS_ORIGIN?.split(",")[0]?.trim().replace(/\/$/, "") ??
    "http://localhost:5173"
  );
}

export function myCertificatesUrl(): string {
  return `${getPublicAppUrl()}/my-certificates`;
}

export function invitationAcceptUrl(): string {
  return `${getPublicAppUrl()}/organizations/invitations`;
}
