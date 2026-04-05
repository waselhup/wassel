import { Router, Request, Response } from 'express';
import { supabase } from '../supabase';

const router = Router();

// NOTE: Auth is handled by expressAuthMiddleware + requireRole('super_admin') in vercel.ts


/**
 * POST /api/admin/clients/:id/disconnect
 * Disconnects LinkedIn from a client: deletes linkedin_connections row, resets status.
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
 * DELETE /api/admin/clients/:id
 * Deletes a client and all associated data (cascade).
 */
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const clientId = req.params.id;

        console.log(`[Clients] DELETE_START client_id=${clientId.substring(0, 8)}...`);

        // Cascade delete in order (children first)
        const { error: e1 } = await supabase.from('prospects').delete().eq('client_id', clientId);
        if (e1) console.warn(`[Clients] DELETE prospects warn:`, e1.message);

        const { error: e2 } = await supabase.from('prospect_import_jobs').delete().eq('client_id', clientId);
        if (e2) console.warn(`[Clients] DELETE import_jobs warn:`, e2.message);

        const { error: e3 } = await supabase.from('linkedin_connections').delete().eq('client_id', clientId);
        if (e3) console.warn(`[Clients] DELETE linkedin_connections warn:`, e3.message);

        const { error: e4 } = await supabase.from('client_invites').delete().eq('client_id', clientId);
        if (e4) console.warn(`[Clients] DELETE invites warn:`, e4.message);

        const { error: e5 } = await supabase.from('oauth_states').delete().eq('client_id', clientId);
        if (e5) console.warn(`[Clients] DELETE oauth_states warn:`, e5.message);

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

export default router;
