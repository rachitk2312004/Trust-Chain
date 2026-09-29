import { useQuery } from "@tanstack/react-query";
import { billingApi } from "../../services/billingApi";
import { publicCertificateApi } from "../../services/publicCertificateApi";
import type { PublicCertificateVerifyResponse } from "../../services/publicCertificateApi";
import { useSessionStore } from "../../lib/sessionStore";
import { isCertificateHolderOnly } from "../../lib/workspacePersona";

export function publicCertificateKeys(publicId?: string, metered?: boolean) {
  return ["public-certificate-verify", publicId, metered ? "metered" : "public"] as const;
}

export function usePublicCertificateVerify(publicId: string | undefined) {
  const accessToken = useSessionStore((s) => s.accessToken);
  const roles = useSessionStore((s) => s.roles);
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const metered = Boolean(accessToken) && isCertificateHolderOnly(roles, organizationId);

  return useQuery({
    queryKey: publicCertificateKeys(publicId, metered),
    queryFn: async (): Promise<PublicCertificateVerifyResponse> => {
      if (metered) {
        const { data } = await billingApi.verifyCertificate(publicId!);
        return data as PublicCertificateVerifyResponse;
      }
      const { data } = await publicCertificateApi.verify(publicId!);
      return data;
    },
    enabled: Boolean(publicId?.trim()),
    retry: false,
    staleTime: metered ? Infinity : 30_000,
    refetchOnWindowFocus: !metered,
    refetchOnReconnect: !metered,
  });
}
