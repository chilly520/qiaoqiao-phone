// Cloudflare Workers Web Push — pure Web Crypto API, zero external crypto deps
import { SignJWT, importJWK } from 'jose';

function b64url2buf(b64) {
    const pad = b64.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (4 - b64.length % 4) % 4);
    return Uint8Array.from(atob(pad), c => c.charCodeAt(0));
}

function buf2b64url(buf) {
    return btoa(String.fromCharCode(...new Uint8Array(buf)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function concat(...arrays) {
    const total = arrays.reduce((s, a) => s + a.length, 0);
    const out = new Uint8Array(total);
    let off = 0;
    for (const a of arrays) { out.set(a, off); off += a.length; }
    return out;
}

// HKDF-Extract: PRK = HMAC-Hash(salt, IKM)
async function hkdfExtract(salt, ikm) {
    const key = await crypto.subtle.importKey(
        'raw', salt, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    return new Uint8Array(await crypto.subtle.sign('HMAC', key, ikm));
}

// HKDF-Expand: OKM = HKDF-Expand(PRK, info, L) — manual implementation
// Web Crypto's HKDF deriveBits always does Extract+Expand, so we implement Expand manually
async function hkdfExpand(prk, info, length) {
    const hmacKey = await crypto.subtle.importKey(
        'raw', prk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const n = Math.ceil(length / 32);
    const okm = new Uint8Array(length);
    let prev = new Uint8Array(0);
    for (let i = 1; i <= n; i++) {
        const input = new Uint8Array(prev.length + info.length + 1);
        input.set(prev);
        input.set(info, prev.length);
        input[input.length - 1] = i;
        prev = new Uint8Array(await crypto.subtle.sign('HMAC', hmacKey, input));
        okm.set(prev.slice(0, length - (i - 1) * 32), (i - 1) * 32);
    }
    return okm;
}

// --- VAPID JWT ---
async function generateVapidJwt(publicKey, privateKey, subject, endpointUrl) {
    const rawPub = b64url2buf(publicKey);
    const jwk = {
        kty: 'EC',
        crv: 'P-256',
        d: privateKey,
        x: buf2b64url(rawPub.slice(1, 33)),
        y: buf2b64url(rawPub.slice(33, 65)),
    };
    const key = await importJWK(jwk, 'ES256');
    const origin = new URL(endpointUrl).origin;

    return new SignJWT({ aud: origin, sub: subject })
        .setProtectedHeader({ alg: 'ES256', kid: publicKey })
        .setIssuedAt()
        .setExpirationTime('12h')
        .sign(key);
}

// --- Web Push Encryption (RFC 8291) ---
async function encryptPayload(payload, subscription) {
    const uaPublic = b64url2buf(subscription.keys.p256dh);
    const authSecret = b64url2buf(subscription.keys.auth);
    const content = typeof payload === 'string' ? new TextEncoder().encode(payload) : payload;

    // 1. Generate ephemeral ECDH key pair
    const ephKeyPair = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']
    );
    const ephPub = new Uint8Array(await crypto.subtle.exportKey('raw', ephKeyPair.publicKey));

    // 2. ECDH shared secret
    const userKey = await crypto.subtle.importKey(
        'raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []
    );
    const ikm = new Uint8Array(await crypto.subtle.deriveBits(
        { name: 'ECDH', public: userKey }, ephKeyPair.privateKey, 256
    ));

    // 3. RFC 8291 key derivation (two Extracts, then Expand)
    const authKey = await hkdfExtract(authSecret, ikm);
    const keyInfo = concat(new TextEncoder().encode('WebPush: info'), new Uint8Array([0x02]), uaPublic);
    const keyPrk = await hkdfExtract(authKey, keyInfo);
    const cek = await hkdfExpand(keyPrk, new TextEncoder().encode('Content-Encoding: aes128gcm\x00'), 16);
    const nonce = await hkdfExpand(keyPrk, new TextEncoder().encode('Content-Encoding: nonce\x00'), 12);

    // 4. Build aes128gcm record
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const plaintext = concat(content, new Uint8Array([0x01]));
    const rs = new Uint8Array(4);
    new DataView(rs.buffer).setUint32(0, plaintext.length, false);

    // 5. Encrypt with AES-128-GCM
    const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: nonce, tagLength: 128 }, aesKey, plaintext
    ));

    return { body: concat(salt, rs, new Uint8Array([65]), ephPub, ciphertext) };
}

// --- Main send function ---
export async function sendWebPush(subscription, payload, env) {
    if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
        throw new Error('VAPID keys not configured');
    }

    const { body } = await encryptPayload(payload, subscription);

    const jwt = await generateVapidJwt(
        env.VAPID_PUBLIC_KEY,
        env.VAPID_PRIVATE_KEY,
        env.VAPID_SUBJECT || 'mailto:admin@chilly-phone.local',
        subscription.endpoint
    );

    const response = await fetch(subscription.endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Encoding': 'aes128gcm',
            'TTL': '3600',
            'Authorization': `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`,
        },
        body,
    });

    if (response.status === 410 || response.status === 404) {
        return { ok: false, reason: 'subscription_gone', shouldCleanup: true };
    }
    if (!response.ok) {
        const text = await response.text().catch(() => '');
        return { ok: false, reason: `HTTP ${response.status}: ${text}` };
    }
    return { ok: true };
}
