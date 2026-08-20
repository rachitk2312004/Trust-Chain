import { Link } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { NotificationPreferences } from "../features/notifications";
import { AppShellLayout } from "../layouts/AppShellLayout";

export function NotificationPreferencesPage() {
  return (
    <AppShellLayout>
      <PageHeader
        title="Notification preferences"
        description="Subscribe to in-app and email channels per event type."
        actions={
          <Link to="/notifications" className="text-sm text-[var(--tc-accent)] hover:underline">
            Back to inbox
          </Link>
        }
      />
      <NotificationPreferences />
    </AppShellLayout>
  );
}
