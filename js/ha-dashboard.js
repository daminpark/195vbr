// js/ha-dashboard.js

// This file handles all interactions with the Home Assistant dashboard.



/**
 * Utility function to debounce another function.
 * @param {Function} func The function to debounce.
 * @param {number} delay The debounce delay in milliseconds.
 * @returns {Function} The debounced function.
 */
function debounce(func, delay) {
    let timeout;
    return function (...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}

/**
 * Initializes the Pusher connection for real-time updates.
 * @param {string} house - The house identifier ('193' or '195').
 */
async function initializePusher(house) {
    if (AppState.channel) {
        AppState.channel.unbind_all();
        AppState.pusher.unsubscribe(AppState.channel.name);
    }
    try {
        const pusherConfigResponse = await fetch(`${BACKEND_API_BASE_URL}/api/pusher-config`);
        if (!pusherConfigResponse.ok) throw new Error('Could not fetch Pusher configuration.');
        const pusherConfig = await pusherConfigResponse.json();
        AppState.pusher = new Pusher(pusherConfig.key, { cluster: pusherConfig.cluster });
        const channelName = `house-${house}`;
        AppState.channel = AppState.pusher.subscribe(channelName);
        AppState.channel.bind('state-update', function (data) {
            console.log('Received real-time update:', data);
            updateCardFromPush(data);
        });
    } catch (error) {
        console.error("Failed to initialize real-time updates:", error);
    }
}

/**
 * Creates the initial HTML for all Home Assistant cards.
 * @param {object} bookingConfig - The configuration for the current booking.
 */
function createDashboardCards(bookingConfig) {
    const { entities } = bookingConfig;
    const dashboard = document.getElementById('ha-dashboard');
    if (!dashboard) return;
    let cardsHtml = '';
    const entityKeys = Object.keys(entities);

    entityKeys.forEach(key => {
        if (key === 'climate' && AppState.guestAccessLevel === 'full') {
            const climateEntities = entities[key];
            let climateHtml = '';
            for (const [entityId, nameKey] of Object.entries(climateEntities)) {
                const friendlyName = t(nameKey);
                climateHtml += `<div class="climate-entity" id="climate-${entityId}"><div class="climate-name">${friendlyName}</div><div class="climate-current-temp">${t('ha_dashboard.current_temp_prefix')}: --°</div><div class="climate-set-temp-display">--°</div><div class="climate-slider-container"><input type="range" min="14" max="24" step="0.5" class="climate-slider" data-entity="${entityId}" disabled></div></div>`;
            }
            cardsHtml += `<div class="ha-card climate-card">${climateHtml}</div>`;
        } else if (key === 'lights' && AppState.guestAccessLevel === 'full') {
            for (const [entityId, nameKey] of Object.entries(entities[key])) {
                const friendlyName = t(nameKey);
                cardsHtml += `
                    <div class="ha-card light-control-card" id="light-card-${entityId.replace(/\./g, '-')}" data-entity-id="${entityId}">
                        <div class="light-controls-wrapper">
                            <div class="light-control-header">
                                <span class="light-control-name">${friendlyName}</span>
                                <div class="light-header-controls">
                                    <button class="light-refresh-btn" aria-label="${t('ha_dashboard.light_refresh_aria')}">
                                        <span class="material-symbols-outlined">refresh</span>
                                    </button>
                                    <label class="switch">
                                        <input type="checkbox" class="light-switch" data-entity="${entityId}" disabled>
                                        <span class="slider"></span>
                                    </label>
                                </div>
                            </div>
                            <div class="light-slider-group" data-controls-for="${entityId}">
                                <div class="light-slider-row" data-control="brightness">
                                    <span class="material-symbols-outlined">brightness_medium</span>
                                    <input type="range" class="light-slider" data-type="brightness" min="0" max="255" data-entity="${entityId}" disabled>
                                    <span class="light-slider-value" data-value-for="brightness">--%</span>
                                </div>
                                <div class="light-slider-row" data-control="color_temp">
                                    <span class="material-symbols-outlined">wb_sunny</span>
                                    <input type="range" class="light-slider" data-type="color_temp" min="250" max="454" data-entity="${entityId}" disabled>
                                    <span class="light-slider-value" data-value-for="color_temp">--K</span>
                                </div>
                            </div>
                        </div>
                        <div class="light-unavailable-notice">
                            <span class="material-symbols-outlined">power_off</span>
                            <span>${t('ha_dashboard.light_unavailable')}</span>
                        </div>
                    </div>
                `;
            }
        } else if (AppState.guestAccessLevel === 'full') {
            // **THE FIX: Use 'ha_card_titles' instead of 'content_titles'**
            const cardTitleKey = `ha_card_titles.${key}`;
            const cardTitle = t(cardTitleKey);
            cardsHtml += `<div class="ha-card"><div class="ha-card-title">${cardTitle}</div><div class="ha-card-status" id="ha-status-${key}">Loading...</div></div>`;
        }
    });

    if (!cardsHtml.trim()) {
        dashboard.style.display = 'none';
    } else {
        dashboard.innerHTML = cardsHtml;
    }

    // EVENT LISTENERS remain the same, as they are logic-based
    document.querySelectorAll('.climate-slider').forEach(slider => {
        slider.addEventListener('input', (event) => {
            const currentSlider = event.currentTarget;
            const entityId = currentSlider.dataset.entity;
            const container = document.getElementById(`climate-${entityId}`);
            if (container) {
                container.querySelector('.climate-set-temp-display').textContent = `${parseFloat(currentSlider.value).toFixed(1)}°`;
            }
        });
        slider.addEventListener('change', debounce(function () {
            setTemperature(this.dataset.entity, parseFloat(this.value), AppState.currentBookingConfig.house);
        }, 500));
    });

    document.querySelectorAll('.light-switch').forEach(toggle => {
        toggle.addEventListener('change', handleLightToggle);
    });

    document.querySelectorAll('.light-slider').forEach(slider => {
        const debouncedSliderChange = debounce(async (value) => {
            const entityId = slider.dataset.entity;
            const type = slider.dataset.type;
            const apiType = type === 'brightness' ? 'light_set_brightness' : 'light_set_color_temp';
            pingSingleLight(entityId, AppState.currentBookingConfig.house);
            try {
                await fetch(`${BACKEND_API_BASE_URL}/api/ha-proxy`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ house: AppState.currentBookingConfig.house, entity: entityId, type: apiType, value: value, opaqueBookingKey: AppState.opaqueBookingKey })
                });
            } catch (error) {
                console.error(`Error setting light ${type}:`, error);
            }
        }, 500);

        slider.addEventListener('input', (e) => {
            const card = e.target.closest('.light-control-card');
            const type = e.target.dataset.type;
            const valueDisplay = card.querySelector(`[data-value-for="${type}"]`);
            if (type === 'brightness') {
                valueDisplay.textContent = `${Math.round(e.target.value / 2.55)}%`;
            } else {
                valueDisplay.textContent = `${Math.round(1000000 / e.target.value)}K`;
            }
        });

        slider.addEventListener('change', (e) => {
            debouncedSliderChange(e.target.value);
        });
    });

    document.querySelectorAll('.light-refresh-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const card = e.currentTarget.closest('.light-control-card');
            if (card && !card.classList.contains('is-refreshing')) {
                const entityId = card.dataset.entityId;
                card.classList.add('is-refreshing');
                pingSingleLight(entityId, AppState.currentBookingConfig.house);
                setTimeout(() => card.classList.remove('is-refreshing'), 4000);
            }
        });
    });
}



/**
 * Fetches the initial state of all HA entities and populates the dashboard.
 * @param {object} bookingConfig - The configuration for the current booking.
 */
async function displayHomeAssistantStatus(bookingConfig) {
    const { house, entities } = bookingConfig;
    if (!house || !entities) return;

    let entitiesToFetch = [];
    for (const [key, entityValue] of Object.entries(entities)) {
        if (key === 'climate' || key === 'lights') {
            entitiesToFetch.push(...Object.keys(entityValue));
        } else {
            entitiesToFetch.push(entityValue);
        }
    }

    let allStates = {};
    if (entitiesToFetch.length > 0) {
        try {
            const proxyUrl = `${BACKEND_API_BASE_URL}/api/ha-proxy`;
            const response = await fetch(`${proxyUrl}?house=${house}&type=batch_states&entities=${entitiesToFetch.join(',')}&opaqueBookingKey=${AppState.opaqueBookingKey}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Batch State Fetch Error: ${errorData.error || response.statusText}`);
            }
            allStates = await response.json();
        } catch (error) {
            console.error("Failed to fetch batch entity states:", error);
        }
    }

    for (const [key, entityValue] of Object.entries(entities)) {
        if (key === 'climate' && AppState.guestAccessLevel === 'full') {
            for (const entityId of Object.keys(entityValue)) {
                const container = document.getElementById(`climate-${entityId}`);
                const state = allStates[entityId];
                if (container && state) {
                    container.querySelector('.climate-current-temp').textContent = `${t('ha_dashboard.current_temp_prefix')}: ${state.attributes.current_temperature.toFixed(1)}°`;
                    container.querySelector('.climate-set-temp-display').textContent = `${state.attributes.temperature.toFixed(1)}°`;
                    const slider = container.querySelector('.climate-slider');
                    slider.value = state.attributes.temperature;
                    slider.disabled = false;
                } else if (container) {
                    container.querySelector('.climate-current-temp').textContent = t('ha_dashboard.occupancy_unavailable');
                }
            }
        } else if (key === 'lights' && AppState.guestAccessLevel === 'full') {
            for (const entityId of Object.keys(entityValue)) {
                const card = document.getElementById(`light-card-${entityId.replace(/\./g, '-')}`);
                if (!card) continue;
                const state = allStates[entityId];
                if (state) {
                    if (state.state === 'unavailable') {
                        card.classList.add('is-unavailable');
                    } else {
                        card.classList.remove('is-unavailable');
                        const { attributes, state: onOffState } = state;
                        const toggle = card.querySelector('.light-switch');
                        toggle.checked = onOffState === 'on';
                        toggle.disabled = false;
                        const brightnessRow = card.querySelector('[data-control="brightness"]');
                        const colorTempRow = card.querySelector('[data-control="color_temp"]');
                        let hasControls = false;
                        if (attributes.hasOwnProperty('brightness')) {
                            hasControls = true;
                            brightnessRow.style.display = 'flex';
                            const slider = brightnessRow.querySelector('.light-slider');
                            slider.value = attributes.brightness || 0;
                            slider.disabled = false;
                            brightnessRow.querySelector('.light-slider-value').textContent = `${Math.round((attributes.brightness || 0) / 2.55)}%`;
                        } else {
                            brightnessRow.style.display = 'none';
                        }
                        if (attributes.supported_color_modes?.includes('color_temp')) {
                            hasControls = true;
                            colorTempRow.style.display = 'flex';
                            const slider = colorTempRow.querySelector('.light-slider');
                            slider.min = attributes.min_mireds;
                            slider.max = attributes.max_mireds;
                            slider.style.direction = 'rtl';
                            const temp = attributes.color_temp || attributes.min_mireds;
                            slider.value = temp;
                            slider.disabled = false;
                            colorTempRow.querySelector('.light-slider-value').textContent = `${Math.round(1000000 / temp)}K`;
                        } else {
                            colorTempRow.style.display = 'none';
                        }
                        card.querySelector('.light-slider-group').style.display = hasControls ? 'flex' : 'none';
                    }
                } else {
                    card.classList.add('is-unavailable');
                }
            }
        } else if (AppState.guestAccessLevel === 'full') {
            const statusElement = document.getElementById(`ha-status-${key}`);
            const state = allStates[entityValue];
            if (statusElement && state) {
                statusElement.textContent = state.state === 'on' ? t('ha_dashboard.occupancy_occupied') : t('ha_dashboard.occupancy_vacant');
                statusElement.style.color = state.state === 'on' ? '#d9534f' : '#5cb85c';
            } else if (statusElement) {
                statusElement.textContent = t('ha_dashboard.occupancy_unavailable');
                statusElement.style.color = 'gray';
            }
        }
    }
    pingAllLights(bookingConfig);
}



/**
 * Handles incoming real-time updates from Pusher.
 * @param {object} data - The data payload from the webhook.
 */
function updateCardFromPush(data) {
    let { entity_id, state, attributes } = data;
    if (typeof attributes === 'string') {
        try {
            const cleanString = attributes.replace(/<[^>]+>/g, 'null').replace(/\bNone\b/g, 'null').replace(/\bTrue\b/g, 'true').replace(/\bFalse\b/g, 'false').replace(/\(/g, '[').replace(/\)/g, ']').replace(/'/g, '"');
            attributes = JSON.parse(cleanString);
        } catch (e) {
            console.error("Could not parse attributes string from push update:", attributes);
            attributes = {};
        }
    }
    if (!attributes || typeof attributes !== 'object') { attributes = {}; }

    if (attributes.type === 'log') {
        const logStyle = "font-weight: bold; color: #4f4f4f;";
        switch (attributes.level) {
            case 'info': console.info(`%c[HA INFO]%c ${attributes.message}`, logStyle, ""); break;
            case 'warn': console.warn(`%c[HA WARN]%c ${attributes.message}`, logStyle, ""); break;
            case 'success': console.log(`%c[HA SUCCESS]%c ${attributes.message}`, "font-weight: bold; color: green;", ""); break;
            default: console.log(`%c[HA LOG]%c ${attributes.message}`, logStyle, "");
        }
        return;
    }

    if (entity_id.startsWith('climate.')) {
        const container = document.getElementById(`climate-${entity_id}`);
        if (container && attributes.current_temperature !== undefined) {
            container.querySelector('.climate-current-temp').textContent = `${t('ha_dashboard.current_temp_prefix')}: ${attributes.current_temperature.toFixed(1)}°`;
            const display = container.querySelector('.climate-set-temp-display');
            const slider = container.querySelector('.climate-slider');
            display.textContent = `${attributes.temperature.toFixed(1)}°`;
            if (document.activeElement !== slider) { slider.value = attributes.temperature; }
        }
    }

    if (entity_id.startsWith('binary_sensor.')) {
        const entityKey = Object.keys(AppState.currentBookingConfig.entities).find(key => AppState.currentBookingConfig.entities[key] === entity_id);
        if (entityKey) {
            const statusElement = document.getElementById(`ha-status-${entityKey}`);
            if (statusElement) {
                statusElement.textContent = state === 'on' ? t('ha_dashboard.occupancy_occupied') : t('ha_dashboard.occupancy_vacant');
                statusElement.style.color = state === 'on' ? '#d9534f' : '#5cb85c';
            }
        }
    }

    if (entity_id.startsWith('light.')) {
        const card = document.getElementById(`light-card-${entity_id.replace(/\./g, '-')}`);
        if (!card) return;
        if (state === 'unavailable') {
            card.classList.add('is-unavailable');
        } else {
            card.classList.remove('is-unavailable');
            card.querySelector('.light-switch').checked = state === 'on';
            const brightnessRow = card.querySelector('[data-control="brightness"]');
            if (brightnessRow && attributes.hasOwnProperty('brightness')) {
                brightnessRow.querySelector('.light-slider').value = attributes.brightness || 0;
                brightnessRow.querySelector('.light-slider-value').textContent = `${Math.round((attributes.brightness || 0) / 2.55)}%`;
            }
            const colorTempRow = card.querySelector('[data-control="color_temp"]');
            if (colorTempRow && attributes.supported_color_modes?.includes('color_temp')) {
                const temp = attributes.color_temp || attributes.min_mireds;
                colorTempRow.querySelector('.light-slider').value = temp;
                colorTempRow.querySelector('.light-slider-value').textContent = `${Math.round(1000000 / temp)}K`;
            }
        }
    }
}

// --- API Command Functions ---

async function setTemperature(entityId, newTemp, house) {
    try {
        await fetch(`${BACKEND_API_BASE_URL}/api/ha-proxy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ house, entity: entityId, type: 'set_temperature', value: newTemp, opaqueBookingKey: AppState.opaqueBookingKey })
        });
    } catch (error) {
        console.error('Error setting temperature:', error);
    }
}

async function handleLightToggle(event) {
    const toggle = event.currentTarget;
    const entityId = toggle.dataset.entity;
    toggle.disabled = true;
    pingSingleLight(entityId, AppState.currentBookingConfig.house);
    try {
        await fetch(`${BACKEND_API_BASE_URL}/api/ha-proxy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ house: AppState.currentBookingConfig.house, entity: entityId, type: 'light_toggle', opaqueBookingKey: AppState.opaqueBookingKey })
        });
    } catch (error) {
        console.error('Error toggling light:', error);
        toggle.checked = !toggle.checked;
    } finally {
        toggle.disabled = false;
    }
}

async function pingSingleLight(entityId, house) {
    try {
        await fetch(`${BACKEND_API_BASE_URL}/api/ha-proxy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ house, entity: entityId, type: 'ping_light', opaqueBookingKey: AppState.opaqueBookingKey })
        });
    } catch (error) {
        console.error(`Error pinging light ${entityId}:`, error);
    }
}

async function pingAllLights(bookingConfig) {
    const { house, entities } = bookingConfig;
    if (!house || !entities || !entities.lights) return;
    console.log("Pinging all lights for live status...");
    for (const entityId of Object.keys(entities.lights)) {
        try {
            await fetch(`${BACKEND_API_BASE_URL}/api/ha-proxy`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ house, entity: entityId, type: 'ping_light', opaqueBookingKey: AppState.opaqueBookingKey })
            });
        } catch (error) {
            console.error(`Error pinging light ${entityId}:`, error);
        }
    }
}