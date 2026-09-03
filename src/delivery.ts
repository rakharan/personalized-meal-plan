// Delivery adapter framework — pluggable channels for meal plan delivery.
// Telegram is the primary channel (already wired). Email + WhatsApp are
// stubs that activate when env vars are set.

export interface DeliveryResult {
  channel: string;
  success: boolean;
  error?: string;
}

export interface DeliveryAdapter {
  name: string;
  send(chatId: number, text: string): Promise<DeliveryResult>;
}

// ────────────────────────────────────────────────────────────────────────────
// Telegram adapter — uses the bot's telegram instance (passed in).
// ────────────────────────────────────────────────────────────────────────────
export function createTelegramAdapter(telegram: any): DeliveryAdapter {
  return {
    name: 'telegram',
    async send(chatId: number, text: string): Promise<DeliveryResult> {
      try {
        // Chunk long messages for Telegram's 4096 char limit.
        const TG_MAX = 4096;
        if (text.length <= TG_MAX) {
          await telegram.sendMessage(chatId, text);
        } else {
          const lines = text.split('\n');
          let chunk = '';
          for (const line of lines) {
            if ((chunk ? chunk + '\n' + line : line).length > TG_MAX) {
              await telegram.sendMessage(chatId, chunk);
              chunk = line;
            } else {
              chunk = chunk ? chunk + '\n' + line : line;
            }
          }
          if (chunk) await telegram.sendMessage(chatId, chunk);
        }
        return { channel: 'telegram', success: true };
      } catch (err: any) {
        return { channel: 'telegram', success: false, error: err.message };
      }
    },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Email adapter — uses nodemailer if SMTP env vars are set.
// Requires: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
// ────────────────────────────────────────────────────────────────────────────
export function createEmailAdapter(): DeliveryAdapter | null {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;

  if (!host || !user || !pass) return null; // Email not configured

  return {
    name: 'email',
    async send(chatId: number, text: string): Promise<DeliveryResult> {
      try {
        // Dynamic import — nodemailer installed only if email is used
        // @ts-ignore — optional dependency, installed only when email delivery is enabled
        const nodemailer = await import('nodemailer');
        const transporter = nodemailer.createTransport({
          host,
          port: Number(port) || 587,
          secure: Number(port) === 465,
          auth: { user, pass },
        });

        // Look up user's email from DB — requires a column we haven't added.
        // ponytail: when email collection is wired in the bot flow, add email column
        // to subscribers + fetch here. For now, skip silently.
        // const { pool } = await import('./store.js');
        // const { rows } = await pool.query('SELECT email FROM subscribers WHERE chat_id = $1', [chatId]);
        // if (!rows.length || !rows[0].email) return { channel: 'email', success: false, error: 'No email on file' };

        // TODO: uncomment when email field exists
        // await transporter.sendMail({
        //   from,
        //   to: rows[0].email,
        //   subject: 'Your Daily Meal Plan',
        //   text,
        // });

        return { channel: 'email', success: false, error: 'Email delivery not fully wired — no email column yet' };
      } catch (err: any) {
        return { channel: 'email', success: false, error: err.message };
      }
    },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// WhatsApp adapter — uses WhatsApp Business API (Cloud) if env vars set.
// Requires: WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, WHATSAPP_API_VERSION
// ────────────────────────────────────────────────────────────────────────────
export function createWhatsAppAdapter(): DeliveryAdapter | null {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  const version = process.env.WHATSAPP_API_VERSION || 'v20.0';

  if (!token || !phoneId) return null; // WhatsApp not configured

  return {
    name: 'whatsapp',
    async send(chatId: number, text: string): Promise<DeliveryResult> {
      try {
        // Look up user's phone number from DB.
        // ponytail: when phone collection is wired in the bot flow, add phone column
        // to subscribers + fetch here. For now, skip silently.
        // const { pool } = await import('./store.js');
        // const { rows } = await pool.query('SELECT phone FROM subscribers WHERE chat_id = $1', [chatId]);
        // if (!rows.length || !rows[0].phone) return { channel: 'whatsapp', success: false, error: 'No phone on file' };

        // const phone = rows[0].phone;
        // const res = await fetch(
        //   `https://graph.facebook.com/${version}/${phoneId}/messages`,
        //   {
        //     method: 'POST',
        //     headers: {
        //       'Authorization': `Bearer ${token}`,
        //       'Content-Type': 'application/json',
        //     },
        //     body: JSON.stringify({
        //       messaging_product: 'whatsapp',
        //       to: phone,
        //       type: 'text',
        //       text: { body: text.slice(0, 4096) }, // WhatsApp text limit
        //     }),
        //   }
        // );
        // if (!res.ok) throw new Error(`WhatsApp API ${res.status}: ${await res.text()}`);

        return { channel: 'whatsapp', success: false, error: 'WhatsApp delivery not fully wired — no phone column yet' };
      } catch (err: any) {
        return { channel: 'whatsapp', success: false, error: err.message };
      }
    },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Delivery manager — sends via all configured channels for a user.
// ────────────────────────────────────────────────────────────────────────────
export function createDeliveryManager(telegram: any): DeliveryAdapter[] {
  const adapters: DeliveryAdapter[] = [createTelegramAdapter(telegram)];
  const email = createEmailAdapter();
  const whatsapp = createWhatsAppAdapter();
  if (email) adapters.push(email);
  if (whatsapp) adapters.push(whatsapp);
  return adapters;
}

export async function deliverPlan(
  adapters: DeliveryAdapter[],
  chatId: number,
  text: string,
  channels?: string[]
): Promise<DeliveryResult[]> {
  const filtered = channels ? adapters.filter((a) => channels.includes(a.name)) : adapters;
  const results = await Promise.allSettled(
    filtered.map((a) => a.send(chatId, text))
  );
  return results.map((r, i) =>
    r.status === 'fulfilled' ? r.value : { channel: filtered[i].name, success: false, error: String(r.reason) }
  );
}
