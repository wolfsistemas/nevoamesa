import { audit, assertRole, handle, requireUser } from "../_shared/auth.ts";
import { json } from "../_shared/cors.ts";

Deno.serve(
  handle(async (req) => {
    const { profile, roles, admin } = await requireUser(req);
    assertRole(roles, ["OWNER", "ADMIN"]);
    const { full_name, email, password, phone, primary_role } = await req.json();
    if (!full_name || !email || !password) throw new Error("Informe nome, e-mail e senha.");
    const allowed = ["ADMIN", "MANAGER", "CASHIER", "WAITER", "KITCHEN"];
    if (primary_role === "OWNER" && profile.primary_role !== "OWNER") {
      throw new Error("Você não possui permissão para esta ação.");
    }
    if (!allowed.includes(primary_role) && primary_role !== "OWNER") {
      throw new Error("Função inválida.");
    }

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, organization_id: profile.organization_id },
    });
    if (error || !data.user) throw new Error(error?.message || "Não foi possível criar o usuário.");

    const { error: profileError } = await admin.from("profiles").insert({
      id: data.user.id,
      organization_id: profile.organization_id,
      full_name,
      email,
      phone: phone ?? null,
      primary_role,
      active: true,
    });
    if (profileError) throw profileError;
    await admin.from("user_roles").insert({
      user_id: data.user.id,
      organization_id: profile.organization_id,
      role: primary_role,
    });
    await audit(admin, profile.organization_id, profile.id, "create", "user", data.user.id, { email, primary_role });
    return json({ id: data.user.id });
  }),
);
