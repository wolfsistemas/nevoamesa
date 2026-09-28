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

    const { data: sub } = await admin
      .from("subscriptions")
      .select("plan:plans(max_users)")
      .eq("organization_id", profile.organization_id)
      .maybeSingle();
    const plan = Array.isArray(sub?.plan) ? sub?.plan[0] : sub?.plan;
    const maxUsers = (plan as { max_users?: number | null } | null)?.max_users;
    if (maxUsers) {
      const { count } = await admin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", profile.organization_id)
        .eq("active", true);
      if ((count ?? 0) >= maxUsers) {
        throw new Error("Limite de usuários do plano atingido. Faça upgrade em Assinatura.");
      }
    }

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, organization_id: profile.organization_id },
    });
    if (error || !data.user) {
      const message = error?.message ?? "";
      if (/already been registered|already exists|already registered/i.test(message)) {
        throw new Error("Já existe um usuário com este e-mail.");
      }
      throw new Error(message || "Não foi possível criar o usuário.");
    }

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
