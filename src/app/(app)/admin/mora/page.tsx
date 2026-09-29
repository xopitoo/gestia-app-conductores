import { redirect } from "next/navigation";

/**
 * "Clientes en mora" dejó de ser admin-only (un recepcionista también
 * necesita ver la mora de su propia sede para poder cobrarla) y se movió a
 * /mora, con la vista adaptada por rol ahí adentro. Este redirect solo
 * existe para no romper links/bookmarks viejos a esta ruta.
 */
export default async function AdminMoraRedirect({
  searchParams,
}: {
  searchParams: Promise<{ sede?: string }>;
}) {
  const { sede } = await searchParams;
  redirect(sede ? `/mora?sede=${sede}` : "/mora");
}
