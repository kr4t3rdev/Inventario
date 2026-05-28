import { describe, expect, it, vi, beforeEach } from 'vitest';

const { sendMailMock } = vi.hoisted(() => ({
  sendMailMock: vi.fn(),
}));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({ sendMail: sendMailMock })),
  },
}));

import { sendEmail } from '../email';

describe('sendEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('SMTP_USER', 'garciamichel894@gmail.com');
    vi.stubEnv('SMTP_PASSWORD', 'app-password');
  });

  it('retorna null cuando el login SMTP falla (el error se atrapa internamente)', async () => {
    const smtpError = Object.assign(new Error('Invalid login'), { code: 'EAUTH' });
    sendMailMock.mockRejectedValueOnce(smtpError);

    const result = await sendEmail('test@example.com', 'Asunto', '<p>hola</p>');
    expect(result).toBeNull();
  });
});
