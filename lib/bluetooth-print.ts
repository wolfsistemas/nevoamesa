import type { KitchenTicket } from "@/types";

const ENCODER = new TextEncoder();

function esc(...bytes: number[]) {
  return new Uint8Array(bytes);
}

function textLine(value: string) {
  return ENCODER.encode(`${value}\n`);
}

function concat(chunks: Uint8Array[]) {
  const length = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const out = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

export function buildKitchenTicketBytes(ticket: KitchenTicket) {
  const order = ticket.order;
  const lines: Uint8Array[] = [
    esc(0x1b, 0x40),
    esc(0x1b, 0x61, 0x01),
    esc(0x1b, 0x21, 0x30),
    textLine("COZINHA"),
    esc(0x1b, 0x21, 0x00),
    textLine(`MESA ${order?.table?.number ?? "-"}`),
    textLine(`PEDIDO #${order?.number ?? "-"}`),
    textLine(new Date(ticket.created_at).toLocaleString("pt-BR")),
    esc(0x1b, 0x61, 0x00),
    textLine("------------------------"),
  ];
  for (const item of order?.items ?? []) {
    lines.push(esc(0x1b, 0x21, 0x08));
    lines.push(textLine(`${item.quantity}x ${item.name}`));
    lines.push(esc(0x1b, 0x21, 0x00));
    for (const addon of item.addons ?? []) lines.push(textLine(`  + ${addon.name}`));
    if (item.notes) lines.push(textLine(`  OBS: ${item.notes}`));
  }
  if (order?.notes) {
    lines.push(textLine("------------------------"));
    lines.push(textLine(`OBS PEDIDO: ${order.notes}`));
  }
  lines.push(textLine("------------------------"));
  lines.push(textLine(order?.waiter?.full_name ?? "Garcom"));
  lines.push(esc(0x0a, 0x0a, 0x0a));
  lines.push(esc(0x1d, 0x56, 0x00));
  return concat(lines);
}

type BluetoothRemoteGATTCharacteristicLike = {
  writeValue: (data: BufferSource) => Promise<void>;
};

let cachedCharacteristic: BluetoothRemoteGATTCharacteristicLike | null = null;

export async function connectKitchenPrinter() {
  const bluetooth = navigator.bluetooth;
  if (!bluetooth) {
    throw new Error("Web Bluetooth não está disponível neste navegador.");
  }
  const device = await bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: [
      "000018f0-0000-1000-8000-00805f9b34fb",
      "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
      "49535343-fe7d-4ae5-8fa9-9fafd205e455",
    ],
  });
  const server = await device.gatt?.connect();
  if (!server) throw new Error("Não foi possível conectar à impressora.");
  const services = await server.getPrimaryServices();
  for (const service of services) {
    const characteristics = await service.getCharacteristics();
    const writable = characteristics.find(
      (c) => c.properties.write || c.properties.writeWithoutResponse,
    );
    if (writable) {
      cachedCharacteristic = writable;
      return device.name || "Impressora Bluetooth";
    }
  }
  throw new Error("Nenhuma característica de escrita encontrada na impressora.");
}

export async function printKitchenTicket(ticket: KitchenTicket) {
  if (!cachedCharacteristic) {
    await connectKitchenPrinter();
  }
  if (!cachedCharacteristic) throw new Error("Impressora não conectada.");
  const payload = buildKitchenTicketBytes(ticket);
  const chunkSize = 180;
  for (let i = 0; i < payload.length; i += chunkSize) {
    await cachedCharacteristic.writeValue(payload.slice(i, i + chunkSize));
  }
}

export function hasKitchenPrinter() {
  return Boolean(cachedCharacteristic);
}

declare global {
  interface Navigator {
    bluetooth?: {
      requestDevice: (options: {
        acceptAllDevices?: boolean;
        optionalServices?: string[];
      }) => Promise<{
        name?: string;
        gatt?: {
          connect: () => Promise<{
            getPrimaryServices: () => Promise<
              Array<{
                getCharacteristics: () => Promise<
                  Array<{
                    properties: { write?: boolean; writeWithoutResponse?: boolean };
                    writeValue: (data: BufferSource) => Promise<void>;
                  }>
                >;
              }>
            >;
          }>;
        };
      }>;
    };
  }
}
