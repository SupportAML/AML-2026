
/**
 * Email Service using Brevo (formerly Sendinblue)
 * Free tier: 300 emails/day (9,000 emails/month) - No credit card required.
 */

const BREVO_API_KEY = import.meta.env.VITE_BREVO_API_KEY || '';

export const sendInvitationEmail = async (toEmail: string, toName: string, inviteUrl: string, inviterName: string) => {
    if (!BREVO_API_KEY) {
        console.warn("Brevo API Key not found. Email will not be sent for real.");
        return { success: false, error: "API Key missing" };
    }

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
            'accept': 'application/json',
            'api-key': BREVO_API_KEY,
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            sender: {
                name: "ApexMedLaw Team",
                email: "invites@apexmedlaw.com"
            },
            to: [
                {
                    email: toEmail,
                    name: toName
                }
            ],
            subject: "Invitation to join ApexMedLaw Clinical Workspace",
            htmlContent: `
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid #e2e8f0; border-radius: 24px; color: #1e293b;">
          <h2 style="color: #0891b2; font-size: 24px; margin-bottom: 24px; font-weight: 800; letter-spacing: -0.025em;">Welcome to ApexMedLaw</h2>
          <p style="font-size: 16px; line-height: 1.6; color: #475569; margin-bottom: 24px;">
            Hello <strong>${toName}</strong>,
          </p>
          <p style="font-size: 16px; line-height: 1.6; color: #475569; margin-bottom: 24px;">
            <strong>${inviterName}</strong> has invited you to join the clinical legal workspace at ApexMedLaw. You have been granted access to review medical records and contribute expert clinical analysis.
          </p>
          <div style="margin: 32px 0;">
            <a href="${inviteUrl}" style="background-color: #0891b2; color: #ffffff; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 14px; box-shadow: 0 10px 15px -3px rgba(8, 145, 178, 0.2);">
              Accept Invitation & Access Workspace
            </a>
          </div>
          <p style="font-size: 14px; line-height: 1.6; color: #64748b; margin-bottom: 32px;">
            This link will expire in 7 days. If the button above doesn't work, copy and paste this URL into your browser: <br/>
            <span style="color: #0891b2; word-break: break-all;">${inviteUrl}</span>
          </p>
          <hr style="border: 0; border-top: 1px solid #f1f5f9; margin-bottom: 32px;" />
          <p style="font-size: 12px; line-height: 1.6; color: #94a3b8; text-align: center;">
            &copy; 2026 ApexMedLaw. All rights reserved.<br/>
            Secure Medical-Legal Cloud Analysis Platform.
          </p>
        </div>
      `
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to send email");
    }

    return { success: true };
};
