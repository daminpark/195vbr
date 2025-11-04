// --- Create a NEW FILE at /api/ha-webhook.js ---

import Pusher from 'pusher';

// Initialize Pusher with your server-side credentials
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true
});

export default async function handler(req, res) {
  // We only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // --- Security Check ---
  // Verify that the request is coming from Home Assistant
  const providedSecret = req.headers['x-webhook-secret'];
  if (providedSecret !== process.env.HA_WEBHOOK_SECRET) {
    console.warn('[SECURITY] Invalid webhook secret received.');
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const { entity_id, state, attributes, house } = req.body;
    
    if (!entity_id || !state || !house) {
        return res.status(400).json({ message: 'Bad Request: Missing entity_id, state, or house.' });
    }

    // The "channel" is like a TV channel. The frontend will subscribe to this.
    // We make it specific to the house.
    const channel = `house-${house}`;
    
    // The "event" is the name of the message.
    const event = 'state-update';
    
    // The "payload" is the data we're sending.
    const payload = { entity_id, state, attributes };

    // Trigger the event on the channel with the payload
    await pusher.trigger(channel, event, payload);
    
    console.log(`Pushed update for ${entity_id} to channel ${channel}`);
    
    res.status(200).json({ message: 'Update pushed successfully.' });

  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}