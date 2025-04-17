import { db } from '../db/index.js';
import { clients } from '../db/schema.js';
import {and, eq, sql} from 'drizzle-orm';

export class Client {
    constructor(client_profile) {
        this.id = client_profile.client_id;
        this.client_id = client_profile.client_id;
        this.client_secret = client_profile.client_secret;
        this.grant_requirements = JSON.parse(client_profile.grant_requirements);
        this.grant_types = JSON.parse(client_profile.grant_types);
        this.redirect_uris = JSON.parse(client_profile.redirect_uris);
        this.post_logout_redirect_uris = JSON.parse(client_profile.post_logout_redirect_uris);
        this.created_at = client_profile.created_at;
    }

    static async findByClientId(client_id) {
        const client = await db.select()
            .from(clients)
            .where(eq(clients.client_id, client_id))
            .limit(1);

        // OIDC Client site not found
        if(!client.length) return null;

        return new Client(client[0]);
    }
}