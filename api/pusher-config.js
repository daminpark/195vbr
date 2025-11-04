// This function securely provides the public Pusher credentials to the client.

export default async function handler(req, res) {
  // CORS is handled by vercel.json, but for local dev this is good


  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Ensure the server has the necessary environment variables configured
  if (!process.env.PUSHER_KEY || !process.env.PUSHER_CLUSTER) {
    console.error("Server Error: PUSHER_KEY or PUSHER_CLUSTER is not configured.");
    return res.status(500).json({ error: "Server configuration error." });
  }
  
  // Send the public key and cluster to the client
  res.status(200).json({
    key: process.env.PUSHER_KEY,
    cluster: process.env.PUSHER_CLUSTER,
  });
}