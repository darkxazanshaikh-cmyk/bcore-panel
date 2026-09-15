// ==================== Hcore Cloudflare Worker ====================
// This worker acts as the API endpoint for Hcore license validation.
// It reads keys from a GitHub-hosted JSON file and responds to POST requests.

// Environment variables (set in Cloudflare dashboard):
// GITHUB_RAW_URL - Raw URL to your keys.json file
// Example: https://raw.githubusercontent.com/username/repo/main/keys.json

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
};

export default {
    async fetch(request, env) {
        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: CORS_HEADERS });
        }

        // GET / - Health check
        if (request.method === 'GET') {
            return new Response(JSON.stringify({
                status: 'ok',
                message: 'Hcore Activation API is running',
                timestamp: new Date().toISOString()
            }), { headers: CORS_HEADERS });
        }

        // POST / - License activation (Hcore connects here)
        if (request.method === 'POST') {
            return handleActivation(request, env);
        }

        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: CORS_HEADERS
        });
    }
};

async function handleActivation(request, env) {
    try {
        // Parse POST body
        const body = await request.text();
        const params = new URLSearchParams(body);

        const userKey = params.get('user_key') || '';
        const packageName = params.get('package_name') || '';
        const appName = params.get('app_name') || '';
        const deviceId = params.get('device_id') || '';

        // Validate input
        if (!userKey) {
            return jsonResponse({
                status: 'fail',
                reason: 'user_key is required'
            });
        }

        // Fetch keys.json from GitHub
        const keysUrl = env.GITHUB_RAW_URL;
        if (!keysUrl) {
            return jsonResponse({
                status: 'fail',
                server_mode: 'offline',
                reason: 'Server not configured'
            });
        }

        const keysResp = await fetch(keysUrl, {
            headers: { 'Accept': 'application/json' },
            cf: { cacheTtl: 30 } // Cache for 30 seconds
        });

        if (!keysResp.ok) {
            return jsonResponse({
                status: 'fail',
                server_mode: 'offline',
                reason: 'Failed to load keys database'
            });
        }

        const keysData = await keysResp.json();

        // Check server mode
        const serverMode = keysData.server_mode || 'online';

        if (serverMode === 'offline') {
            return jsonResponse({
                status: 'fail',
                server_mode: 'offline',
                message: 'Server is offline',
                reason: 'Server is currently offline'
            });
        }

        if (serverMode === 'maintenance') {
            return jsonResponse({
                status: 'fail',
                server_mode: 'maintenance',
                message: 'Server under maintenance',
                reason: 'Server is under maintenance. Please try again later.'
            });
        }

        // Find the key
        const keyEntry = keysData.keys.find(k => k.key === userKey);

        if (!keyEntry) {
            return jsonResponse({
                status: 'fail',
                reason: 'Invalid license key'
            });
        }

        // Check if disabled
        if (keyEntry.disabled === 1) {
            return jsonResponse({
                status: 'fail',
                reason: 'This key has been disabled',
                disabled: 1
            });
        }

        // Check expiry
        if (keyEntry.expiry) {
            const expiryDate = new Date(keyEntry.expiry.replace(' ', 'T'));
            const now = new Date();

            if (now > expiryDate) {
                return jsonResponse({
                    status: 'fail',
                    reason: `License expired on ${keyEntry.expiry}`,
                    expiry: keyEntry.expiry
                });
            }
        }

        // Check device limit
        const maxDevices = keyEntry.max_devices || 1;
        const devices = keyEntry.devices || [];

        if (deviceId && !devices.includes(deviceId)) {
            if (devices.length >= maxDevices) {
                return jsonResponse({
                    status: 'fail',
                    reason: `Device limit reached (${maxDevices} devices max)`,
                    devices_used: devices.length,
                    devices_max: maxDevices
                });
            }
            // Note: Device tracking requires write access to GitHub repo
            // For now, we just validate the key without tracking
        }

        // Build success response
        const response = {
            status: 'success',
            expiry: keyEntry.expiry || '',
            feature1: keyEntry.feature1 || 0,
            feature2: keyEntry.feature2 || 0,
            toggle_expiry: 1,
            server_mode: 'online',
            server_notification: {
                enabled: 0,
                title: '',
                message: '',
                iconType: 'event'
            },
            extra_notification: {
                enabled: 0,
                title: '',
                message: '',
                image: '',
                base_url: ''
            }
        };

        return jsonResponse(response);

    } catch (e) {
        return jsonResponse({
            status: 'fail',
            reason: 'Internal server error'
        }, 500);
    }
}

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status: status,
        headers: CORS_HEADERS
    });
}
