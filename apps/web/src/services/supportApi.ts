import { apiClient } from "./http";
import type {
  BugReportDetail,
  BugReportSummary,
  PlatformInquiryDetail,
  PlatformInquirySummary,
  SupportSummary,
} from "../types/api";

export const supportApi = {
  summary() {
    return apiClient.get<SupportSummary>("/support/summary");
  },
  listInquiries() {
    return apiClient.get<{ inquiries: PlatformInquirySummary[] }>("/support/inquiries");
  },
  createInquiry(body: { subject: string; body: string; organizationId?: string }) {
    return apiClient.post<{ inquiry: PlatformInquiryDetail }>("/support/inquiries", body);
  },
  getInquiry(inquiryId: string) {
    return apiClient.get<{ inquiry: PlatformInquiryDetail }>(`/support/inquiries/${inquiryId}`);
  },
  replyInquiry(inquiryId: string, body: string) {
    return apiClient.post<{ inquiry: PlatformInquiryDetail }>(`/support/inquiries/${inquiryId}/messages`, {
      body,
    });
  },
  closeInquiry(inquiryId: string) {
    return apiClient.post<{ inquiry: PlatformInquiryDetail }>(`/support/inquiries/${inquiryId}/close`);
  },
  listBugs() {
    return apiClient.get<{ bugs: BugReportSummary[] }>("/support/bugs");
  },
  createBug(body: {
    title: string;
    description: string;
    organizationId?: string;
    imageBase64?: string;
    imageContentType?: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
  }) {
    return apiClient.post<{ bug: BugReportDetail }>("/support/bugs", body);
  },
  getBug(bugId: string) {
    return apiClient.get<{ bug: BugReportDetail }>(`/support/bugs/${bugId}`);
  },
  bugImage(bugId: string) {
    return apiClient.get<Blob>(`/support/bugs/${bugId}/image`, { responseType: "blob" });
  },
  respondToBug(bugId: string, body: { body: string; status?: string }) {
    return apiClient.post<{ bug: BugReportDetail }>(`/support/bugs/${bugId}/responses`, body);
  },
  commentOnBug(bugId: string, body: string) {
    return apiClient.post<{ bug: BugReportDetail }>(`/support/bugs/${bugId}/comments`, { body });
  },
};
