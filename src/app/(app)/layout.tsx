import { logoutGuarded } from "./logout-action";
import { getViewerContext } from "@/lib/viewer";
import { Sidebar } from "./sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile, organization, sedes } = await getViewerContext();

  const initials = profile.full_name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  const sedeLabel =
    profile.role === "recepcionista"
      ? (sedes[0]?.name ?? "Sin sede")
      : `${sedes.length} ${sedes.length === 1 ? "sede" : "sedes"}`;

  return (
    <div className="flex min-h-svh bg-slate-50">
      <Sidebar
        role={profile.role as "admin" | "recepcionista"}
        fullName={profile.full_name}
        initials={initials}
        orgName={organization.name}
        sedeLabel={sedeLabel}
        onLogout={logoutGuarded}
      />

      <main className="flex-1 overflow-x-hidden print:overflow-visible">
        <div className="mx-auto max-w-6xl px-6 py-8 print:mx-0 print:max-w-none print:p-0">
          {children}
        </div>
      </main>
    </div>
  );
}
