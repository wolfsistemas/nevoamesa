import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

type PushSub = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

function toBase64Url(bytes: ArrayBuffer | Uint8Array) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  arr.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function importVapidKeys(publicKey: string, privateKey: string) {
  const pub = urlBase64ToUint8Array(publicKey);
  const priv = urlBase64ToUint8Array(privateKey);
  const jwk = {
    kty: "EC",
    crv: "P-256",
    x: toBase64Url(pub.slice(1, 33)),
    y: toBase64Url(pub.slice(33, 65)),
    d: toBase64Url(priv),
    ext: true,
  };
  const privateCrypto = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const publicCrypto = await crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y, ext: true },
    { name: "ECDH", namedCurve: "P-256" },
    true,
    [],
  );
  return { privateCrypto, publicCrypto, publicRaw: pub };
}

async function vapidHeader(audience: string, subject: string, keys: Awaited<ReturnType<typeof importVapidKeys>>) {
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: audience, exp: now + 12 * 3600, sub: subject };
  const unsigned = `${toBase64Url(new TextEncoder().encode(JSON.stringify(header)))}.${toBase64Url(
    new TextEncoder().encode(JSON.stringify(payload)),
  )}`;
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    keys.privateCrypto,
    new TextEncoder().encode(unsigned),
  );
  const jwt = `${unsigned}.${toBase64Url(sig)}`;
  return `vapid t=${jwt}, k=${toBase64Url(keys.publicRaw)}`;
}

async function encryptPayload(userPublicKey: string, userAuth: string, payload: Uint8Array) {
  const receiverKey = await crypto.subtle.importKey(
    "raw",
    urlBase64ToUint8Array(userPublicKey),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const localKey = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const localRaw = new Uint8Array(await crypto.subtle.exportKey("raw", localKey.publicKey));
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: receiverKey }, localKey.privateKey, 256),
  );
  const authSecret = urlBase64ToUint8Array(userAuth);

  async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number) {
    const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
    return new Uint8Array(
      await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, length * 8),
    );
  }

  const prk = await hkdf(authSecret, shared, new TextEncoder().encode("WebPush: info\0"), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, prk, new TextEncoder().encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, prk, new TextEncoder().encode("Content-Encoding: nonce\0"), 12);
  const padded = new Uint8Array(payload.length + 1);
  padded.set(payload);
  padded[payload.length] = 2;
  const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, padded),
  );
  const rs = 4096;
  const header = new Uint8Array(16 + 4 + 1 + localRaw.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, rs);
  header[20] = localRaw.length;
  header.set(localRaw, 21);
  const body = new Uint8Array(header.length + encrypted.length);
  body.set(header);
  body.set(encrypted, header.length);
  return body;
}

export async function sendWebPush(sub: PushSub, title: string, body: string, url = "/cozinha/") {
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY") || Deno.env.get("NEXT_PUBLIC_VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!publicKey || !privateKey) return false;
  const endpointUrl = new URL(sub.endpoint);
  const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;
  const keys = await importVapidKeys(publicKey, privateKey);
  const authorization = await vapidHeader(audience, "mailto:alice.j@example.com", keys);
  const payload = new TextEncoder().encode(JSON.stringify({ title, body, url }));
  const encrypted = await encryptPayload(sub.p256dh, sub.auth, payload);
  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      Authorization: authorization,
      TTL: "120",
      Urgency: "high",
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
    },
    body: encrypted,
  });
  return res.ok || res.status === 201;
}

export async function notifyKitchen(
  admin: SupabaseClient,
  orgId: string,
  title: string,
  body: string,
  entityId?: string,
) {
  await admin.from("notifications").insert({
    organization_id: orgId,
    user_id: null,
    title,
    body,
    type: "order",
    entity: "order",
    entity_id: entityId ?? null,
  });
  const { data: roleRows } = await admin
    .from("user_roles")
    .select("user_id")
    .eq("organization_id", orgId)
    .in("role", ["KITCHEN", "OWNER", "ADMIN", "MANAGER"]);
  const userIds = Array.from(new Set((roleRows ?? []).map((row: { user_id: string }) => row.user_id)));
  if (!userIds.length) return;
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("organization_id", orgId)
    .in("user_id", userIds);
  for (const sub of (subs ?? []) as PushSub[]) {
    try {
      await sendWebPush(sub, title, body, "/cozinha/");
    } catch {
      // ignore push failures so the order still succeeds
    }
  }
}
