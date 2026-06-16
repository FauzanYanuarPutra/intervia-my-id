const APP_ENV = process.env.ENV || process.env.APP_ENV || process.env.NODE_ENV;
const IS_DEV = APP_ENV === 'development';

type WhatsAppMetaOtpMode = 'template' | 'text';

type WhatsAppMetaConfig = {
  accessToken: string;
  phoneNumberId: string;
  apiVersion: string;
  defaultCountryCode: string;
  mode: WhatsAppMetaOtpMode;
  templateName: string;
  templateLanguage: string;
  templateButtonSubType: string;
  templateButtonIndex: string;
};

type WhatsAppMetaParameter =
  | {
      type: 'text';
      text: string;
    }
  | {
      type: 'coupon_code';
      coupon_code: string;
    };

type WhatsAppMetaTemplateComponent =
  | {
      type: 'body';
      parameters: WhatsAppMetaParameter[];
    }
  | {
      type: 'button';
      sub_type: string;
      index: string;
      parameters: WhatsAppMetaParameter[];
    };

type WhatsAppMetaPayload = {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'text' | 'template';
  text?: {
    preview_url: boolean;
    body: string;
  };
  template?: {
    name: string;
    language: {
      code: string;
    };
    components?: WhatsAppMetaTemplateComponent[];
  };
};

function readWhatsAppMetaConfig(): WhatsAppMetaConfig {
  const templateName = (
    process.env.WHATSAPP_META_OTP_TEMPLATE_NAME || ''
  ).trim();
  const explicitMode = (
    process.env.WHATSAPP_META_OTP_MODE || ''
  ).trim().toLowerCase();
  const mode: WhatsAppMetaOtpMode =
    explicitMode === 'template' || explicitMode === 'text'
      ? explicitMode
      : templateName
        ? 'template'
        : 'text';

  return {
    accessToken: (process.env.WHATSAPP_META_ACCESS_TOKEN || '').trim(),
    phoneNumberId: (process.env.WHATSAPP_META_PHONE_NUMBER_ID || '').trim(),
    apiVersion: (process.env.WHATSAPP_META_API_VERSION || 'v22.0').trim(),
    defaultCountryCode: (
      process.env.WHATSAPP_META_DEFAULT_COUNTRY_CODE || '62'
    )
      .replace(/\D/g, '')
      .trim(),
    mode,
    templateName,
    templateLanguage: (
      process.env.WHATSAPP_META_OTP_TEMPLATE_LANGUAGE || 'id'
    ).trim(),
    templateButtonSubType: (
      process.env.WHATSAPP_META_OTP_TEMPLATE_BUTTON_SUB_TYPE || ''
    )
      .trim()
      .toLowerCase(),
    templateButtonIndex: (
      process.env.WHATSAPP_META_OTP_TEMPLATE_BUTTON_INDEX || '0'
    ).trim(),
  };
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 4) return `****${digits}`;
  return `****${digits.slice(-4)}`;
}

function normalizeWhatsAppRecipient(phone: string, countryCode: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (!countryCode) return digits;
  if (digits.startsWith(countryCode)) return digits;
  if (digits.startsWith('0')) return `${countryCode}${digits.slice(1)}`;
  if (countryCode === '62' && digits.startsWith('8')) {
    return `${countryCode}${digits}`;
  }
  return digits;
}

function buildOtpText(otp: string): string {
  return [
    `Kode verifikasi Lajukan: ${otp}`,
    '',
    'Kode ini berlaku 5 menit.',
    'Jangan bagikan kode ini ke siapa pun, termasuk tim Lajukan.',
  ].join('\n');
}

function buildTemplateComponents(
  otp: string,
  config: WhatsAppMetaConfig,
): WhatsAppMetaTemplateComponent[] {
  const components: WhatsAppMetaTemplateComponent[] = [
    {
      type: 'body',
      parameters: [{ type: 'text', text: otp }],
    },
  ];

  if (!config.templateButtonSubType) return components;

  components.push({
    type: 'button',
    sub_type: config.templateButtonSubType,
    index: config.templateButtonIndex || '0',
    parameters:
      config.templateButtonSubType === 'copy_code'
        ? [{ type: 'coupon_code', coupon_code: otp }]
        : [{ type: 'text', text: otp }],
  });

  return components;
}

function buildWhatsAppPayload(
  to: string,
  otp: string,
  config: WhatsAppMetaConfig,
): WhatsAppMetaPayload {
  if (config.mode === 'template') {
    return {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template: {
        name: config.templateName,
        language: {
          code: config.templateLanguage || 'id',
        },
        components: buildTemplateComponents(otp, config),
      },
    };
  }

  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: {
      preview_url: false,
      body: buildOtpText(otp),
    },
  };
}

function truncateForLog(value: string, maxLength = 800): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}...`;
}

export function getWhatsAppMetaConfigured(): boolean {
  const config = readWhatsAppMetaConfig();
  return Boolean(config.accessToken && config.phoneNumberId);
}

export async function sendOtpViaWhatsAppMeta(
  phone: string,
  otp: string,
): Promise<boolean> {
  const config = readWhatsAppMetaConfig();
  const target = normalizeWhatsAppRecipient(phone, config.defaultCountryCode);

  if (!target) return false;

  if (!config.accessToken || !config.phoneNumberId) {
    if (IS_DEV) {
      console.log('[WhatsApp Meta] not configured, skipping delivery', {
        target: maskPhone(target),
        otp,
      });
    }
    return false;
  }

  if (config.mode === 'template' && !config.templateName) {
    console.error('WhatsApp Meta OTP template mode is missing template name', {
      target: maskPhone(target),
    });
    return false;
  }

  try {
    const endpoint = `https://graph.facebook.com/${config.apiVersion}/${encodeURIComponent(
      config.phoneNumberId,
    )}/messages`;
    const payload = buildWhatsAppPayload(target, otp, config);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text().catch(() => '');
    if (!response.ok) {
      console.error('WhatsApp Meta OTP delivery failed', {
        target: maskPhone(target),
        mode: config.mode,
        status: response.status,
        body: truncateForLog(responseText),
      });
      return false;
    }

    if (IS_DEV) {
      console.log('[WhatsApp Meta] OTP sent', {
        target: maskPhone(target),
        mode: config.mode,
        status: response.status,
        response: truncateForLog(responseText),
      });
    }

    return true;
  } catch (error) {
    console.error('WhatsApp Meta OTP delivery error', {
      target: maskPhone(target),
      mode: config.mode,
      error,
    });
    return false;
  }
}
