// api/subscribe.js
// Vercel serverless function. Keeps the MailerLite API key off the page.
//
// Required environment variables (Vercel > Project Settings > Environment Variables):
//   MAILERLITE_API_KEY
//   MAILERLITE_GROUP_ID

// Only these chip values are accepted. Anything else is stored as blank,
// so nobody can push arbitrary text into your subscriber fields.
const ALLOWED = {
  archetype: ['first-timer', 'occasional', 'regular', 'veteran'],
  planning_style: ['planner', 'flexible', 'loose'],
  memory_wish: ['record', 'photos', 'notes', 'stats'],
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(field, value) {
  return ALLOWED[field].includes(value) ? value : '';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false });
  }

  const { MAILERLITE_API_KEY, MAILERLITE_GROUP_ID } = process.env;
  if (!MAILERLITE_API_KEY || !MAILERLITE_GROUP_ID) {
    console.error('Missing MAILERLITE_API_KEY or MAILERLITE_GROUP_ID');
    return res.status(500).json({ ok: false });
  }

  // Vercel parses JSON bodies automatically; this guard covers the string case.
  let body = req.body || {};
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      body = {};
    }
  }

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return res.status(400).json({ ok: false, error: 'invalid_email' });
  }

  const payload = {
    email,
    fields: {
      archetype: clean('archetype', body.archetype),
      planning_style: clean('planning_style', body.planning_style),
      memory_wish: clean('memory_wish', body.memory_wish),
    },
    groups: [MAILERLITE_GROUP_ID],
  };

  try {
    const mlRes = await fetch('https://connect.mailerlite.com/api/subscribers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${MAILERLITE_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!mlRes.ok) {
      // Log the detail server-side only. The browser gets a generic failure.
      console.error('MailerLite error', mlRes.status, await mlRes.text());
      return res.status(502).json({ ok: false });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Subscribe request failed', err);
    return res.status(502).json({ ok: false });
  }
};
