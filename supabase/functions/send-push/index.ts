import { assertRole, handle, requireUser } from "../_shared/auth.ts";
import { json } from "../_shared/cors.ts";
import { notifyKitchen } from "../_shared/push.ts";

Deno.serve(
  handle(async (req) => {
    const { profile, roles, admin } = await requireUser(req);
    assertRole(roles, ["OWNER", "ADMIN", "MANAGER", "KITCHEN"]);
    const { title, body } = await req.json();
    await notifyKitchen(
      admin,
      profile.organization_id,
      title || "RestaurantOS",
      body || "Você tem um novo aviso.",
    );
    return json({ ok: true });
  }),
);
