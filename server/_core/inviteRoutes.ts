import { Router, Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { supabase } from '../supabase';
import { getUserTeamId } from '../db';

const router = Router();

const INVITE_EXPIRY_HOURS = 72;

/**
 * POST /api/invites/send
 * Admin sends an invite to a client email.
 * Body: { email: string, name?: string }
 * Requires: Authorization header with Supabase JWT
 */
router.post('/send', async (req: Request, res: Response) => {
    try {
        // Get admin user from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return res.status(401).json({ error: 'Invalid authentication' });
        }

        const teamId = await getUserTeamId(user.id);
        if (!teamId) {
            return res.status(403).json({ error: 'No team found for user' });
        }

        const { email, name } = req.body;
        if (!email || typeof email !== 'string') {
            return res.status(400).json({ error: 'Email is required' });
        }

        // Create or find client
        let clientId: string;
        const { data: existingClient } = await supabase
            .from('clients')
            .select('id, status')
            .eq('email', email)
            .eq('team_id', teamId)
            .single();

        if (existingClient) {
            clientId = existingClient.id;
            if (existingClient.status === 'connected') {
                return res.status(400).json({ error: 'Client already connected' });
            }
        } else {
            const { data: newClient, error: createError } = await supabase
                .from('clients')
                .insert({ team_id: teamId, email, name: name || null, status: 'pending' })
                .select('id')
                .single();

            if (createError || !newClient) {
                console.error('[Invite] Failed to create client:', createError);
                return res.status(500).json({ error: 'Failed to create client' });
            }
            clientId = newClient.id;
        }

        // Generate invite token
        const inviteToken = randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

        const { error: inviteError } = await supabase
            .from('client_invites')
            .insert({ client_id: clientId, token: inviteToken, expires_at: expiresAt });

        if (inviteError) {
            console.error('[Invite] Failed to create invite:', inviteError);
            return res.status(500).json({ error: 'Failed to create invite' });
        }

        // Update client status to invited
        await supabase
            .from('clients')
            .update({ status: 'invited', updated_at: new Date().toISOString() })
            .eq('id', clientId);

        // Build invite link
        const appUrl = process.env.APP_URL || 'https://wassel-alpha.vercel.app';
        const inviteLink = `${appUrl}/invite/${inviteToken}`;

        // Try sending email via Resend if available
        const resendApiKey = process.env.RESEND_API_KEY;
        let emailSent = false;

        if (resendApiKey) {
            try {
                const emailRes = await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${resendApiKey}`,
                    },
                    body: JSON.stringify({
                        from: 'Wassel <noreply@wassel.app>',
                        to: [email],
                        subject: 'Connect your LinkedIn — Wassel',
                        html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px;">
                <h1 style="color: #2563eb; margin-bottom: 20px;">Wassel</h1>
                <p style="font-size: 16px; color: #333;">You've been invited to connect your LinkedIn account with Wassel.</p>
                <p style="font-size: 16px; color: #333;">Click the button below to get started:</p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${inviteLink}" style="background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600;">
                    Connect LinkedIn
                  </a>
                </div>
                <p style="font-size: 14px; color: #666;">This link expires in ${INVITE_EXPIRY_HOURS} hours.</p>
                <p style="font-size: 12px; color: #999; margin-top: 30px;">— Wassel Team</p>
              </div>
            `,
                    }),
                });
                emailSent = emailRes.ok;
            } catch (emailError) {
                console.error('[Invite] Email send failed:', emailError);
            }
        }

        res.json({
            success: true,
            inviteLink,
            emailSent,
            clientId,
            message: emailSent
                ? 'Invite sent successfully'
                : 'Invite created. Share the link manually (no email provider configured).',
        });
    } catch (error) {
        console.error('[Invite] Send error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * GET /api/invites/validate/:token
 * Validates an invite token for the frontend page.
 */
router.get('/validate/:token', async (req: Request, res: Response) => {
    try {
        const { token } = req.params;

        const { data: invite, error } = await supabase
            .from('client_invites')
            .select('id, client_id, expires_at, used_at, clients(email, name, status)')
            .eq('token', token)
            .single();

        if (error || !invite) {
            return res.status(404).json({ error: 'Invalid invite token', valid: false });
        }

        if (invite.used_at) {
            return res.status(400).json({ error: 'Invite already used', valid: false, used: true });
        }

        if (new Date(invite.expires_at) < new Date()) {
            return res.status(400).json({ error: 'Invite expired', valid: false, expired: true });
        }

        res.json({
            valid: true,
            clientId: invite.client_id,
            client: invite.clients,
        });
    } catch (error) {
        console.error('[Invite] Validate error:', error);
        res.status(500).json({ error: 'Server error', valid: false });
    }
});

/**
 * GET /api/clients/status
 * Lists all clients with their statuses (admin-only).
 * Requires: Authorization header with Supabase JWT
 */
router.get('/status', async (req: Request, res: Response) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return res.status(401).json({ error: 'Invalid authentication' });
        }

        const teamId = await getUserTeamId(user.id);
        if (!teamId) {
            return res.status(403).json({ error: 'No team found' });
        }

        const { data: clients, error: clientsError } = await supabase
            .from('clients')
            .select(`
        id,
        email,
        name,
        status,
        created_at,
        updated_at,
        linkedin_connections(linkedin_member_id, linkedin_name, linkedin_email, created_at)
      `)
            .eq('team_id', teamId)
            .order('created_at', { ascending: false });

        if (clientsError) {
            console.error('[Clients] Status error:', clientsError);
            return res.status(500).json({ error: 'Failed to fetch clients' });
        }

        res.json({ clients: clients || [] });
    } catch (error) {
        console.error('[Clients] Status error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;
