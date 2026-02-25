import nodemailer from 'nodemailer';
import { envConfig } from '../settings/environments.ts';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (transporter) return transporter;

  if (!envConfig.EMAIL_HOST || !envConfig.EMAIL_USER || !envConfig.EMAIL_PASS) {
    throw new Error('Email service not configured. Set EMAIL_HOST, EMAIL_USER, EMAIL_PASS.');
  }

  transporter = nodemailer.createTransport({
    host: envConfig.EMAIL_HOST,
    port: envConfig.EMAIL_PORT ?? 587,
    secure: (envConfig.EMAIL_PORT ?? 587) === 465,
    auth: {
      user: envConfig.EMAIL_USER,
      pass: envConfig.EMAIL_PASS,
    },
  });

  return transporter;
}

export async function sendPasswordResetEmail(
  to: string,
  username: string,
  resetUrl: string,
): Promise<void> {
  const from = envConfig.EMAIL_FROM ?? envConfig.EMAIL_USER;
  const urlTrimmed = resetUrl.trim();
  const urlEncoded = urlTrimmed.replace(/&/g, '&amp;');
  await getTransporter().sendMail({
    from: `"Bro Finances" <${from}>`,
    to,
    subject: 'Restaurar contraseña — Bro Finances',
    html: `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#0B0E11;color:#EAECEF;padding:24px;margin:0;">
<p>Hola <strong>${username}</strong>,</p>
<p>Recibimos una solicitud para restablecer tu contraseña. Este enlace expira en <strong>30 minutos</strong>.</p>
<p><a href="${urlEncoded}" target="_blank" style="color:#7F00FF;text-decoration:underline;">Restablecer contraseña</a></p>
<p style="font-size:12px;color:#848E9C;">Si el enlace no funciona, copiá y pegá esta URL en el navegador:</p>
<p style="font-size:11px;word-break:break-all;color:#aaa;">${urlEncoded}</p>
<p style="font-size:12px;color:#848E9C;">Si no solicitaste este cambio, ignorá este correo.</p>
</body></html>`,
    text: `Hola ${username},\n\nRestablece tu contraseña entrando a este enlace:\n${urlTrimmed}\n\nExpira en 30 minutos.\n\nSi el enlace no funciona, copiá y pegá la URL en el navegador.`,
  });
}
