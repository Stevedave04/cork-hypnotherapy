/*
 * Contact form handler (Cloudflare Pages Function).
 *
 * Replaces the placeholder that used to fake a successful submission on the
 * client while sending nothing, so every enquiry was silently discarded.
 *
 * Delivery goes through Resend. Two environment variables are needed, set in
 * the Cloudflare Pages dashboard (Settings > Environment variables), never in
 * this repository:
 *
 *   RESEND_API_KEY  (required, encrypted)  API key from resend.com
 *   CONTACT_TO      (optional)             defaults to info@corkhypnotherapy.com
 *
 * Without RESEND_API_KEY the endpoint returns 503 and the form tells the
 * visitor to email or ring instead. It never reports success it cannot back up.
 */

const DEFAULT_TO = 'info@corkhypnotherapy.com';

// Must be a domain verified in Resend, not the visitor's address. The
// visitor's address goes in Reply-To so replying from the inbox just works.
const FROM = 'Cork Hypnotherapy <website@corkhypnotherapy.com>';

const LIMITS = { name: 100, email: 254, phone: 40, choice: 100, message: 5000 };

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

const clean = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export async function onRequestPost({ request, env }) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json(400, { ok: false, error: 'Could not read that submission.' });
  }

  // Honeypot: a real person never fills a field they cannot see. Answer 200 so
  // a bot has no signal that it was caught.
  if (clean(payload.website, 200)) return json(200, { ok: true });

  const firstName = clean(payload['first-name'], LIMITS.name);
  const lastName = clean(payload['last-name'], LIMITS.name);
  const email = clean(payload.email, LIMITS.email);
  const phone = clean(payload.phone, LIMITS.phone);
  const treatment = clean(payload.treatment, LIMITS.choice);
  const sessionType = clean(payload['session-type'], LIMITS.choice);
  const location = clean(payload.location, LIMITS.choice);
  const message = clean(payload.message, LIMITS.message);
  const privacy = payload.privacy === true || payload.privacy === 'on';

  const errors = {};
  if (!firstName) errors['first-name'] = 'Please enter your first name.';
  if (!lastName) errors['last-name'] = 'Please enter your last name.';
  if (!isEmail(email)) errors.email = 'Please enter a valid email address.';
  if (!message) errors.message = 'Please tell us a little about your enquiry.';
  if (!privacy) errors.privacy = 'Please confirm you have read the privacy policy.';

  if (Object.keys(errors).length) {
    return json(422, { ok: false, error: 'Please check the form and try again.', errors });
  }

  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    // Better to admit the enquiry did not send than to repeat the old bug.
    console.error('RESEND_API_KEY is not set; contact form cannot deliver mail.');
    return json(503, {
      ok: false,
      error: 'Sorry, the enquiry form is temporarily unavailable. Please email '
        + 'info@corkhypnotherapy.com or ring 089 411 9837 and we will get straight back to you.',
    });
  }

  const name = `${firstName} ${lastName}`;
  const rows = [
    ['Name', name],
    ['Email', email],
    ['Phone', phone || 'Not given'],
    ['Interested in', treatment || 'Not specified'],
    ['Session type', sessionType || 'Not specified'],
    ['Location', location || 'Not specified'],
  ];

  const html = `
    <h2 style="margin:0 0 16px;font:600 18px system-ui,sans-serif;">New website enquiry</h2>
    <table style="border-collapse:collapse;font:14px system-ui,sans-serif;">
      ${rows.map(([label, value]) => `
        <tr>
          <td style="padding:4px 16px 4px 0;color:#666;vertical-align:top;">${escapeHtml(label)}</td>
          <td style="padding:4px 0;"><strong>${escapeHtml(value)}</strong></td>
        </tr>`).join('')}
    </table>
    <h3 style="margin:24px 0 8px;font:600 15px system-ui,sans-serif;">Message</h3>
    <p style="white-space:pre-wrap;font:14px/1.6 system-ui,sans-serif;margin:0;">${escapeHtml(message)}</p>
    <p style="margin:24px 0 0;font:12px system-ui,sans-serif;color:#888;">
      Sent from the contact form at corkhypnotherapy.com. Reply directly to answer ${escapeHtml(name)}.
    </p>`;

  const text = [
    'New website enquiry',
    '',
    ...rows.map(([label, value]) => `${label}: ${value}`),
    '',
    'Message:',
    message,
  ].join('\n');

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: [env.CONTACT_TO || DEFAULT_TO],
        reply_to: email,
        subject: `Website enquiry from ${name}${treatment ? ` (${treatment})` : ''}`,
        html,
        text,
      }),
    });

    if (!res.ok) {
      // Log the provider's reason for us; show the visitor a way through.
      console.error('Resend rejected the message:', res.status, await res.text());
      return json(502, {
        ok: false,
        error: 'Sorry, we could not send that just now. Please email '
          + 'info@corkhypnotherapy.com or ring 089 411 9837 and we will pick it up.',
      });
    }
  } catch (err) {
    console.error('Contact form delivery failed:', err);
    return json(502, {
      ok: false,
      error: 'Sorry, we could not send that just now. Please email '
        + 'info@corkhypnotherapy.com or ring 089 411 9837 and we will pick it up.',
    });
  }

  return json(200, { ok: true });
}

// Only POST is exported, so Pages answers any other method on this path with
// 405 on its own.
