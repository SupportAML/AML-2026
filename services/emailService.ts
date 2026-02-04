
/**
 * Email Service using Brevo (formerly Sendinblue)
 * Free tier: 300 emails/day (9,000 emails/month) - No credit card required.
 */

const BREVO_API_KEY = import.meta.env.VITE_BREVO_API_KEY || '';

export const sendInvitationEmail = async (toEmail: string, toName: string, inviteUrl: string, inviterName: string) => {
  /*
  console.log('📧 Attempting to send invitation email...');
  console.log('   To:', toEmail);
  console.log('   From:', inviterName);
  console.log('   API Key present:', Boolean(BREVO_API_KEY));
  console.log('   API Key length:', BREVO_API_KEY.length);
  */

  if (!BREVO_API_KEY) {
    console.error("❌ Brevo API Key not found in environment variables!");
    console.error("   Check .env.local for VITE_BREVO_API_KEY");
    throw new Error("Email service not configured: API Key missing");
  }

  try {
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
          email: "support@apexmedlaw.com"
        },
        to: [
          {
            email: toEmail,
            name: toName
          }
        ],
        subject: "🎯 You've Been Invited to ApexMedLaw Clinical Workspace",
        htmlContent: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ApexMedLaw Invitation</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 20px;">
        <tr>
            <td align="center">
                <!-- Main Container -->
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); overflow: hidden;">
                    
                    <!-- Header with Gradient -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%); padding: 40px 40px 30px 40px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">
                                ApexMedLaw
                            </h1>
                            <p style="margin: 8px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 13px; font-weight: 500; letter-spacing: 1px; text-transform: uppercase;">
                                Clinical Legal Workspace
                            </p>
                        </td>
                    </tr>

                    <!-- Welcome Badge -->
                    <tr>
                        <td align="center" style="padding: 30px 40px 20px 40px;">
                            <div style="display: inline-block; background-color: #ecfeff; border: 2px solid #06b6d4; border-radius: 12px; padding: 8px 16px;">
                                <span style="color: #0891b2; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
                                    🎉 New Invitation
                                </span>
                            </div>
                        </td>
                    </tr>

                    <!-- Main Content -->
                    <tr>
                        <td style="padding: 0 40px 30px 40px;">
                            <h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 24px; font-weight: 700;">
                                Hello ${toName}!
                            </h2>
                            <p style="margin: 0 0 20px 0; color: #475569; font-size: 16px; line-height: 1.6;">
                                <strong style="color: #0891b2;">${inviterName}</strong> has invited you to join the <strong>ApexMedLaw Clinical Workspace</strong>.
                            </p>
                            <p style="margin: 0 0 20px 0; color: #64748b; font-size: 15px; line-height: 1.6;">
                                You've been granted expert access to review medical records, provide clinical analysis, and collaborate on medical-legal cases through our secure cloud platform.
                            </p>
                        </td>
                    </tr>

                    <!-- CTA Button -->
                    <tr>
                        <td align="center" style="padding: 10px 40px 35px 40px;">
                            <table cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center" style="background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%); border-radius: 12px; box-shadow: 0 10px 25px rgba(8, 145, 178, 0.3);">
                                        <a href="${inviteUrl}" style="display: inline-block; padding: 16px 40px; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 16px; letter-spacing: 0.3px;">
                                            Accept Invitation & Get Started →
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Features Section -->
                    <tr>
                        <td style="padding: 0 40px 30px 40px;">
                            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border-radius: 12px; padding: 24px;">
                                <tr>
                                    <td>
                                        <p style="margin: 0 0 16px 0; color: #0f172a; font-size: 14px; font-weight: 700;">
                                            What You Can Do:
                                        </p>
                                        <table width="100%" cellpadding="0" cellspacing="0">
                                            <tr>
                                                <td style="padding: 8px 0;">
                                                    <span style="color: #10b981; font-size: 16px; margin-right: 8px;">✓</span>
                                                    <span style="color: #475569; font-size: 14px;">Review medical records & documentation</span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0;">
                                                    <span style="color: #10b981; font-size: 16px; margin-right: 8px;">✓</span>
                                                    <span style="color: #475569; font-size: 14px;">Provide expert clinical analysis & annotations</span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0;">
                                                    <span style="color: #10b981; font-size: 16px; margin-right: 8px;">✓</span>
                                                    <span style="color: #475569; font-size: 14px;">Collaborate with legal teams on active cases</span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0;">
                                                    <span style="color: #10b981; font-size: 16px; margin-right: 8px;">✓</span>
                                                    <span style="color: #475569; font-size: 14px;">Access AI-powered medical analysis tools</span>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Alternative Link -->
                    <tr>
                        <td style="padding: 0 40px 35px 40px;">
                            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 8px;">
                                <p style="margin: 0 0 8px 0; color: #92400e; font-size: 13px; font-weight: 700;">
                                    ⚡ Can't see the button?
                                </p>
                                <p style="margin: 0 0 8px 0; color: #78350f; font-size: 13px; line-height: 1.5;">
                                    Copy and paste this link into your browser:
                                </p>
                                <p style="margin: 0; color: #0891b2; font-size: 12px; word-break: break-all; font-family: 'Courier New', monospace;">
                                    ${inviteUrl}
                                </p>
                            </div>
                        </td>
                    </tr>

                    <!-- Security Notice -->
                    <tr>
                        <td style="padding: 0 40px 30px 40px;">
                            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #eff6ff; border-radius: 8px; padding: 16px;">
                                <tr>
                                    <td>
                                        <p style="margin: 0 0 6px 0; color: #1e40af; font-size: 12px; font-weight: 700;">
                                            🔒 Security & Privacy
                                        </p>
                                        <p style="margin: 0; color: #3730a3; font-size: 12px; line-height: 1.5;">
                                            This invitation link will expire in <strong>7 days</strong>. All data is encrypted and HIPAA-compliant. Your access is protected by enterprise-grade security.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Divider -->
                    <tr>
                        <td style="padding: 0 40px;">
                            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 0;">
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 30px 40px; text-align: center;">
                            <p style="margin: 0 0 8px 0; color: #94a3b8; font-size: 12px;">
                                <strong>ApexMedLaw</strong> – Secure Medical-Legal Cloud Analysis Platform
                            </p>
                            <p style="margin: 0 0 16px 0; color: #cbd5e1; font-size: 11px;">
                                © 2026 ApexMedLaw. All rights reserved.
                            </p>
                            <p style="margin: 0; color: #94a3b8; font-size: 11px; line-height: 1.5;">
                                This email was sent to <strong>${toEmail}</strong> because ${inviterName} invited you to collaborate.<br>
                                If you believe this was sent in error, please disregard this message.
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>
      `
      })
    });

    // console.log('📨 Response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
      console.error('❌ Brevo API Error:', errorData);
      console.error('   Status:', response.status);
      console.error('   Error details:', JSON.stringify(errorData, null, 2));

      // Provide specific error messages
      if (response.status === 401) {
        throw new Error("Invalid Brevo API Key. Please check your .env.local file.");
      } else if (response.status === 400) {
        throw new Error(`Email validation error: ${errorData.message || 'Invalid email format or sender'}`);
      } else {
        throw new Error(errorData.message || `Failed to send email (Status: ${response.status})`);
      }
    }

    const successData = await response.json();
    // console.log('✅ Email sent successfully!');
    // console.log('   Message ID:', successData.messageId);

    return { success: true, messageId: successData.messageId };

  } catch (error) {
    console.error('❌ Failed to send email:', error);
    if (error instanceof Error) {
      throw error; // Re-throw to let caller handle it
    }
    throw new Error('Unknown error occurred while sending email');
  }
};
