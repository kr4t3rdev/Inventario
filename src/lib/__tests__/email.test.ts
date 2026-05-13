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

  it('propaga el error SMTP cuando el login falla', async () => {
    const smtpError = Object.assign(new Error('Invalid login'), { code: 'EAUTH' });
    sendMailMock.mockRejectedValueOnce(smtpError);

    await expect(sendEmail('test@example.com', 'Asunto', '<p>hola</p>')).rejects.toThrow(
      'Invalid login',
    );
  });
});
