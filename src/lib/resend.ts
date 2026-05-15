import 'server-only';

export type EmailDeliveryStatus = 'sent' | 'not_configured' | 'failed';

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string | string[];
  from?: string;
  attachments?: Array<{ filename: string; content: string }>;
};

export type SendEmailResult = {
  status: EmailDeliveryStatus;
  id?: string;
  error?: string;
};

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

const cleanAddress = (value: string) => value.trim();

const cleanRecipients = (to: string | string[]) =>
  (Array.isArray(to) ? to : [to]).map(cleanAddress).filter(Boolean);

const parseResendResponse = async (response: Response) => {
  try {
    return (await response.json()) as { id?: string; message?: string; error?: string };
  } catch {
    return {};
  }
};

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim());
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = input.from?.trim() || process.env.EMAIL_FROM?.trim();
  const recipients = cleanRecipients(input.to);

  if (!apiKey || !from) return { status: 'not_configured' };
  if (recipients.length === 0) return { status: 'failed', error: 'Missing recipient' };
  if (!input.text?.trim() && !input.html?.trim()) return { status: 'failed', error: 'Missing email body' };

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: recipients.length === 1 ? recipients[0] : recipients,
        subject: input.subject,
        text: input.text,
        html: input.html,
        reply_to: input.replyTo,
        attachments: input.attachments?.length ? input.attachments : undefined,
      }),
    });
    const payload = await parseResendResponse(response);

    if (!response.ok) {
      return {
        status: 'failed',
        error: payload.message ?? payload.error ?? `Resend returned ${response.status}`,
      };
    }

    return { status: 'sent', id: payload.id };
  } catch (error) {
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown Resend error',
    };
  }
}
