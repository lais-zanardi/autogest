/**
 * SPK.6 & US37.3 — Módulo de envio transacional de e-mail atrás de interface.
 * Provedor escolhido no SPK.6: Resend (plano gratuito: 3.000 e-mails/mês, 100/dia,
 * remetente configurável via EMAIL_FROM, chave RESEND_API_KEY mantida apenas no backend).
 */

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface EmailSendResult {
  messageId: string;
}

export interface ProvedorEmail {
  enviar(mensagem: EmailMessage): Promise<EmailSendResult>;
}

export type EmailFetchLike = (
  url: string,
  init?: RequestInit,
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<any>;
}>;

export class ResendEmailProvider implements ProvedorEmail {
  private readonly apiKey: string;
  private readonly fromAddress: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: EmailFetchLike;

  constructor(options?: {
    apiKey?: string;
    fromAddress?: string;
    timeoutMs?: number;
    fetchFn?: EmailFetchLike;
  }) {
    this.apiKey = options?.apiKey || process.env.RESEND_API_KEY || '';
    this.fromAddress = options?.fromAddress || process.env.EMAIL_FROM || 'AutoGest <resumo@autogest.app>';
    this.timeoutMs = options?.timeoutMs ?? 8000;
    this.fetchFn = options?.fetchFn || (globalThis.fetch as unknown as EmailFetchLike);
  }

  async enviar(mensagem: EmailMessage): Promise<EmailSendResult> {
    if (!this.apiKey) {
      throw new Error('RESEND_API_KEY não configurada no servidor.');
    }

    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const res = await this.fetchFn('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: this.fromAddress,
            to: [mensagem.to],
            subject: mensagem.subject,
            text: mensagem.text,
            html: mensagem.html,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`Provedor de e-mail retornou HTTP ${res.status}`);
        }

        const data = await res.json();
        return { messageId: String(data?.id || `resend_${Date.now()}`) };
      } catch (err: any) {
        lastError = err instanceof Error ? err : new Error(String(err));
      } finally {
        clearTimeout(timer);
      }
    }

    throw lastError || new Error('Falha ao enviar e-mail de resumo mensal.');
  }
}
