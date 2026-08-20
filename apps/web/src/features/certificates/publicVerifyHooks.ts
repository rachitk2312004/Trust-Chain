import { useQuery } from "@tanstack/react-query";
import { publicCertificateApi } from "../../services/publicCertificateApi";

export function publicCertificateKeys(publicId?: string) {
  return ["public-certificate-verify", publicId] as const;
}

export function usePublicCertificateVerify(publicId: string | undefined) {
  return useQuery({
    queryKey: publicCertificateKeys(publicId),
    queryFn: async () => {
      const { data } = await publicCertificateApi.verify(publicId!);
      return data;
    },
    enabled: Boolean(publicId?.trim()),
    retry: false,
  });
}
