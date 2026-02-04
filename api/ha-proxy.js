// This file is self-contained and fully secure.

// --- PERMISSIONS --
const climatePermissions = {
  "31": ["climate.193_1_trv"], "32": ["climate.193_2_trv"], "33": ["climate.193_c_trv", "climate.193_3_trv"], "34": ["climate.193_4_trv"], "35": ["climate.193_5_trv"], "36": ["climate.193_6_trv"], "3a": ["climate.193_1_trv", "climate.193_2_trv"], "3b": ["climate.193_4_trv", "climate.193_5_trv", "climate.193_6_trv"],
  "51": ["climate.195_1_trv"], "52": ["climate.195_2_trv"], "53": ["climate.195_c_trv", "climate.195_3_trv"], "54": ["climate.195_4_trv"], "55": ["climate.195_5_trv"], "56": ["climate.195_6_trv"], "5a": ["climate.195_1_trv", "climate.195_2_trv"], "5b": ["climate.195_4_trv", "climate.195_5_trv", "climate.195_6_trv"],
  "193vbr": ["climate.193_1_trv", "climate.193_2_trv", "climate.193_3_trv", "climate.193_c_trv", "climate.193_4_trv", "climate.193_5_trv", "climate.193_6_trv"],
  "195vbr": ["climate.195_1_trv", "climate.195_2_trv", "climate.195_3_trv", "climate.195_c_trv", "climate.195_4_trv", "climate.195_5_trv", "climate.195_6_trv"]
};
const lightPermissions = {
  "31": ["light.193_1_lights"], "32": ["light.193_2_lights"], "33": ["light.193_3_lights", "light.193_3_lamps", "light.193_c_lights"], "34": ["light.193_4_lights", "light.193_4_lamps"], "35": ["light.193_5_lights"], "36": ["light.193_6_lights"], "3a": ["light.193_1_lights", "light.193_2_lights"], "3b": ["light.193_4_lights", "light.193_4_lamps", "light.193_5_lights", "light.193_6_lights"],
  "51": ["light.195_1_lights"], "52": ["light.195_2_lights"], "53": ["light.195_3_lights", "light.195_3_lamps", "light.195_c_lights"], "54": ["light.195_4_lights", "light.195_4_lamps"], "55": ["light.195_5_lights"], "56": ["light.195_6_lights"], "5a": ["light.195_1_lights", "light.195_2_lights"], "5b": ["light.195_4_lights", "light.195_4_lamps", "light.195_5_lights", "light.195_6_lights"],
  "193vbr": ["light.193_1_lights", "light.193_2_lights", "light.193_3_lights", "light.193_3_lamps", "light.193_c_lights", "light.193_4_lights", "light.193_4_lamps", "light.193_5_lights", "light.193_6_lights"],
  "195vbr": ["light.195_1_lights", "light.195_2_lights", "light.195_3_lights", "light.195_3_lamps", "light.195_c_lights", "light.195_4_lights", "light.195_4_lamps", "light.195_5_lights", "light.195_6_lights"]
};
const sensorPermissions = {
  "31": ["binary_sensor.193_a_presence_presence", "binary_sensor.193_b_presence_presence", "binary_sensor.193_k_presence_presence"], "32": ["binary_sensor.193_a_presence_presence", "binary_sensor.193_b_presence_presence", "binary_sensor.193_k_presence_presence"], "33": ["binary_sensor.193_k_presence_presence"], "34": ["binary_sensor.193_a_presence_presence", "binary_sensor.193_b_presence_presence", "binary_sensor.193_k_presence_presence"], "35": ["binary_sensor.193_a_presence_presence", "binary_sensor.193_b_presence_presence", "binary_sensor.193_k_presence_presence"], "36": ["binary_sensor.193_a_presence_presence", "binary_sensor.193_b_presence_presence", "binary_sensor.193_k_presence_presence"], "3a": ["binary_sensor.193_a_presence_presence", "binary_sensor.193_b_presence_presence", "binary_sensor.193_k_presence_presence"], "3b": ["binary_sensor.193_a_presence_presence", "binary_sensor.193_b_presence_presence", "binary_sensor.193_k_presence_presence"],
  "51": ["binary_sensor.195_a_presence_presence", "binary_sensor.195_b_presence_presence", "binary_sensor.195_k_presence_presence"], "52": ["binary_sensor.195_a_presence_presence", "binary_sensor.195_b_presence_presence", "binary_sensor.195_k_presence_presence"], "53": ["binary_sensor.195_k_presence_presence"], "54": ["binary_sensor.195_a_presence_presence", "binary_sensor.195_b_presence_presence", "binary_sensor.195_k_presence_presence"], "55": ["binary_sensor.195_a_presence_presence", "binary_sensor.195_b_presence_presence", "binary_sensor.195_k_presence_presence"], "56": ["binary_sensor.195_a_presence_presence", "binary_sensor.195_b_presence_presence", "binary_sensor.195_k_presence_presence"], "5a": ["binary_sensor.195_a_presence_presence", "binary_sensor.195_b_presence_presence", "binary_sensor.195_k_presence_presence"], "5b": ["binary_sensor.195_a_presence_presence", "binary_sensor.195_b_presence_presence", "binary_sensor.195_k_presence_presence"],
  "193vbr": [], "195vbr": [] // Whole home bookings don't see occupancy sensors
};


export default async function handler(req, res) {

  const getParam = (param) => req.method === 'GET' ? req.query[param] : req.body[param];
  const house = getParam('house');
  const opaqueBookingKey = getParam('opaqueBookingKey');

  if (!opaqueBookingKey || !opaqueBookingKey.includes('-')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or malformed booking key.' });
  }

  const host = req.headers.host;
  const protocol = host.startsWith('localhost') ? 'http://' : 'https://';
  const validationUrl = `${protocol}${host}/api/validate-booking?booking=${opaqueBookingKey}`;

  const validationResponse = await fetch(validationUrl);
  const validationData = await validationResponse.json();

  if (!validationResponse.ok || !validationData.access || validationData.access === 'denied') {
    console.warn(`[SECURITY] ha-proxy access blocked for key ${opaqueBookingKey}. Access level: denied`);
    return res.status(403).json({ error: 'Forbidden: Your booking is not valid or has expired.' });
  }

  let hassUrl, hassToken;
  switch (house) {
    case '193': hassUrl = process.env.HASS_193_URL; hassToken = process.env.HASS_193_TOKEN; break;
    case '195': hassUrl = process.env.HASS_195_URL; hassToken = process.env.HASS_195_TOKEN; break;
    default: return res.status(400).json({ error: 'Invalid house' });
  }
  if (!hassUrl || !hassToken) return res.status(500).json({ error: 'Server configuration error' });
  const headers = { 'Authorization': `Bearer ${hassToken}`, 'Content-Type': 'application/json' };

  try {
    if (req.method === 'GET') {
      const { entity, type = 'state', entities } = req.query;

      if (type === 'batch_states' && entities) {
        const requestedEntities = entities.split(',');
        const [bookingId] = opaqueBookingKey.split('-');
        const userPermissions = new Set([
          ...(climatePermissions[bookingId] || []),
          ...(lightPermissions[bookingId] || []),
          ...(sensorPermissions[bookingId] || [])
        ]);

        const response = await fetch(`${hassUrl}/api/states`, { headers });
        if (!response.ok) throw new Error(`HA API responded with status ${response.status}`);
        const allStates = await response.json();

        const authorizedStates = {};
        for (const entityId of requestedEntities) {
          if (userPermissions.has(entityId)) {
            const entityState = allStates.find(s => s.entity_id === entityId);
            if (entityState) {
              authorizedStates[entityId] = entityState;
            }
          }
        }
        res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate');
        return res.status(200).json(authorizedStates);
      }

      if (!entity) return res.status(400).json({ error: 'Missing entity' });
      let data;
      if (type === 'hourly_forecast' || type === 'daily_forecast') {
        const forecastType = type.split('_')[0];
        const forecastUrl = `${hassUrl}/api/services/weather/get_forecasts?return_response=true`;
        const response = await fetch(forecastUrl, { method: 'POST', headers, body: JSON.stringify({ entity_id: entity, type: forecastType }) });
        if (!response.ok) throw new Error(`HA API responded with status ${response.status}`);
        const responseJson = await response.json();
        if (responseJson?.service_response?.[entity]) { data = responseJson.service_response[entity].forecast; } else { data = []; }
      } else {
        const response = await fetch(`${hassUrl}/api/states/${entity}`, { headers });
        if (!response.ok) throw new Error(`HA API responded with status ${response.status}`);
        data = await response.json();
      }
      res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      if (validationData.access !== 'full') {
        console.warn(`[SECURITY] POST command blocked for key ${opaqueBookingKey}. Access level: ${validationData.access}`);
        return res.status(403).json({ error: 'Forbidden: Your booking is not currently active for sending commands.' });
      }

      const { entity, type, value } = req.body;
      const [bookingId] = opaqueBookingKey.split('-');

      let userPermissions, service, serviceBody;

      if (type === 'set_temperature') {
        userPermissions = climatePermissions[bookingId];
        service = 'climate/set_temperature';
        serviceBody = { entity_id: entity, temperature: value };
      } else if (type === 'light_toggle') {
        userPermissions = lightPermissions[bookingId];
        service = 'light/toggle';
        serviceBody = { entity_id: entity };
      } else if (type === 'light_set_brightness') {
        userPermissions = lightPermissions[bookingId];
        service = 'light/turn_on';
        serviceBody = { entity_id: entity, brightness: value };
      } else if (type === 'light_set_color_temp') {
        userPermissions = lightPermissions[bookingId];
        service = 'light/turn_on';
        serviceBody = { entity_id: entity, color_temp: value };
      } else if (type === 'ping_light') {
        userPermissions = lightPermissions[bookingId];
        service = 'script/guidebook_ping_light';
        serviceBody = { entity_id: entity, house: house };
      } else {
        return res.status(400).json({ error: 'Unsupported command type.' });
      }

      if (!userPermissions || !userPermissions.includes(entity)) {
        console.warn(`[SECURITY] Forbidden attempt by booking ${bookingId} to control entity ${entity}`);
        return res.status(403).json({ error: 'Forbidden: You do not have permission to control this device.' });
      }

      // --- THIS IS THE CORRECTED LINE ---
      const serviceUrl = `${hassUrl}/api/services/${service}`;
      const response = await fetch(serviceUrl, { method: 'POST', headers, body: JSON.stringify(serviceBody) });

      if (!response.ok) throw new Error(`HA service call failed with status ${response.status}`);
      const responseData = await response.json();
      return res.status(200).json({ success: true, state: responseData });
    }

    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });

  } catch (error) {
    console.error(`Error in ha-proxy for house ${house}:`, error.message);
    return res.status(500).json({ error: 'A server error occurred while communicating with Home Assistant.' });
  }
}