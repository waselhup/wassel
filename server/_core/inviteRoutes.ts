import { Router, Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { supabase } from '../supabase';

const router = Router();

const INVITE_EXPIRY_HOURS = 72;

// NOTE: Auth is handled by expressAuthMiddleware + requireRole in vercel.ts
// req.user is always available in these handlers (set by middleware)

/**
 * POST /api/invites/send
 * Admin sends an invite to a client email.
 * Body: { email: string, name?: string }
 * Requires: Authorization: Bearer <ADMIN_KEY>
 */
router.post('/send', async (req: Request, res: Response) => {
    try {
        const { email, name } = req.body;
        if (!email || typeof email !== 'string') {
            return res.status(400).json({ error: 'Email is required' });
        }

        // teamId comes from authenticated user's team membership
        const teamId = (req as any).user?.teamId || process.env.DEFAULT_TEAM_ID || '00000000-0000-0000-0000-000000000001';

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
        const inviteUrl = `${appUrl}/invite/${inviteToken}`;

        // Try sending email via Resend if available
        const resendApiKey = process.env.RESEND_API_KEY;
        let sent = false;
        let provider: 'resend' | 'none' = 'none';
        let emailError: string | null = null;

        if (resendApiKey) {
            provider = 'resend';
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
                  <a href="${inviteUrl}" style="background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600;">
                    Connect LinkedIn
                  </a>
                </div>
                <p style="font-size: 14px; color: #666;">This link expires in ${INVITE_EXPIRY_HOURS} hours.</p>
                <p style="font-size: 12px; color: #999; margin-top: 30px;">— Wassel Team</p>
              </div>
            `,
                    }),
                });
                sent = emailRes.ok;
                if (!sent) {
                    const errBody = await emailRes.text();
                    emailError = `Resend ${emailRes.status}: ${errBody.substring(0, 200)}`;
                    console.error(`[Invite] SEND_EMAIL_FAIL email=${email} status=${emailRes.status} body=${errBody.substring(0, 200)}`);
                }
            } catch (err: any) {
                emailError = err.message || 'Unknown email error';
                console.error(`[Invite] SEND_EMAIL_ERROR email=${email} error=${emailError}`);
            }
        }

        console.log(`[Invite] SEND_OK email=${email} clientId=${clientId} sent=${sent} provider=${provider}`);

        res.json({
            success: true,
            clientId,
            inviteToken,
            inviteUrl,
            sent,
            provider,
            message: sent
                ? 'Invite sent successfully via email'
                : 'Invite created. Copy the link and share it manually.',
            ...(emailError ? { emailError } : {}),
        });
    } catch (error: any) {
        const errorId = randomBytes(4).toString('hex');
        console.error(`[Invite] SEND_FATAL errorId=${errorId} error=`, error);
        res.status(500).json({ error: 'Server error', errorId });
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
 * Requires: Authorization: Bearer <ADMIN_KEY>
 */
router.get('/status', async (req: Request, res: Response) => {
    try {
        const teamId = (req as any).user?.teamId || process.env.DEFAULT_TEAM_ID || '00000000-0000-0000-0000-000000000001';

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

/**
 * GET /api/invites/latest
 * Returns last 20 invites with masked tokens (admin-only debugging).
 */
router.get('/latest', async (req: Request, res: Response) => {
    try {
        const teamId = (req as any).user?.teamId || process.env.DEFAULT_TEAM_ID || '00000000-0000-0000-0000-000000000001';
        const appUrl = process.env.APP_URL || 'https://wassel-alpha.vercel.app';

        const { data: invites, error } = await supabase
            .from('client_invites')
            .select(`
                id,
                token,
                expires_at,
                used_at,
                created_at,
                clients(id, email, name, status)
            `)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) {
            console.error('[Invites] Latest error:', error);
            return res.status(500).json({ error: 'Failed to fetch invites' });
        }

        const result = (invites || []).map((inv: any) => ({
            id: inv.id,
            email: inv.clients?.email || 'unknown',
            name: inv.clients?.name || null,
            status: inv.used_at ? 'used' : (new Date(inv.expires_at) < new Date() ? 'expired' : 'pending'),
            clientStatus: inv.clients?.status || 'unknown',
            created_at: inv.created_at,
            expires_at: inv.expires_at,
            used_at: inv.used_at,
            tokenMasked: inv.token ? `${inv.token.substring(0, 8)}...` : null,
            inviteUrl: `${appUrl}/invite/${inv.token}`,
        }));

        res.json({ invites: result });
    } catch (error) {
        console.error('[Invites] Latest error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * POST /api/clients/:id/disconnect
 * Disconnects LinkedIn from a client: deletes linkedin_connections row, resets status.
 * Admin-only.
 */
router.post('/:id/disconnect', async (req: Request, res: Response) => {
    try {
        const clientId = req.params.id;

        console.log(`[Clients] DISCONNECT_START client_id=${clientId.substring(0, 8)}...`);

        // Delete LinkedIn connection
        const { error: delError } = await supabase
            .from('linkedin_connections')
            .delete()
            .eq('client_id', clientId);

        if (delError) {
            console.warn(`[Clients] DISCONNECT linkedin_connections delete warning:`, delError.message);
        }

        // Set status back to invited
        const { error: updateError } = await supabase
            .from('clients')
            .update({ status: 'invited', updated_at: new Date().toISOString() })
            .eq('id', clientId);

        if (updateError) {
            console.error(`[Clients] DISCONNECT status update fail:`, updateError.message);
            return res.status(500).json({ error: 'Failed to update client status' });
        }

        console.log(`[Clients] DISCONNECT_OK client_id=${clientId.substring(0, 8)}...`);
        res.json({ success: true, message: 'LinkedIn disconnected. Client can reconnect via invite link.' });
    } catch (error: any) {
        console.error('[Clients] Disconnect error:', error.message || error);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * DELETE /api/clients/:id
 * Deletes a client and all associated data (cascade).
 * Admin-only.
 */
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const clientId = req.params.id;

        console.log(`[Clients] DELETE_START client_id=${clientId.substring(0, 8)}...`);

        // Cascade delete in order (children first)
        // 1. Delete prospects
        const { error: e1 } = await supabase.from('prospects').delete().eq('client_id', clientId);
        if (e1) console.warn(`[Clients] DELETE prospects warn:`, e1.message);

        // 2. Delete prospect_import_jobs
        const { error: e2 } = await supabase.from('prospect_import_jobs').delete().eq('client_id', clientId);
        if (e2) console.warn(`[Clients] DELETE import_jobs warn:`, e2.message);

        // 3. Delete linkedin_connections
        const { error: e3 } = await supabase.from('linkedin_connections').delete().eq('client_id', clientId);
        if (e3) console.warn(`[Clients] DELETE linkedin_connections warn:`, e3.message);

        // 4. Delete client_invites
        const { error: e4 } = await supabase.from('client_invites').delete().eq('client_id', clientId);
        if (e4) console.warn(`[Clients] DELETE invites warn:`, e4.message);

        // 5. Delete oauth_states referencing this client
        const { error: e5 } = await supabase.from('oauth_states').delete().eq('client_id', clientId);
        if (e5) console.warn(`[Clients] DELETE oauth_states warn:`, e5.message);

        // 6. Delete client record
        const { error: e6 } = await supabase.from('clients').delete().eq('id', clientId);
        if (e6) {
            console.error(`[Clients] DELETE client fail:`, e6.message);
            return res.status(500).json({ error: 'Failed to delete client record' });
        }

        console.log(`[Clients] DELETE_OK client_id=${clientId.substring(0, 8)}...`);
        res.json({ success: true, message: 'Client and all associated data deleted.' });
    } catch (error: any) {
        console.error('[Clients] Delete error:', error.message || error);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * DELETE /api/invites/:id
 * Deletes a specific invite by ID.
 * Admin-only.
 */
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const inviteId = req.params.id;

        console.log(`[Invites] DELETE invite_id=${inviteId.substring(0, 8)}...`);

        const { error } = await supabase.from('client_invites').delete().eq('id', inviteId);

        if (error) {
            console.error(`[Invites] DELETE fail:`, error.message);
            return res.status(500).json({ error: 'Failed to delete invite' });
        }

        res.json({ success: true, message: 'Invite deleted.' });
    } catch (error: any) {
        console.error('[Invites] Delete error:', error.message || error);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;

