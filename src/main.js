import '@material/web/button/filled-button.js';
import '@material/web/button/outlined-button.js';
import '@material/web/button/text-button.js';
import '@material/web/iconbutton/icon-button.js';
import '@material/web/icon/icon.js';
import '@material/web/slider/slider.js';
import '@material/web/progress/circular-progress.js';
import '@material/web/dialog/dialog.js';
import '@material/web/textfield/outlined-text-field.js';
import './style.css';

const BASE_URL = '/api';
const STORAGE_KEYS = {
  API_KEY: 'atomberg_api_key',
  REFRESH_TOKEN: 'atomberg_refresh_token'
};

class AtombergAPI {
  constructor() {
    this.accessToken = null;
    this.apiKey = localStorage.getItem(STORAGE_KEYS.API_KEY);
    this.refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  }

  updateCredentials(apiKey, refreshToken) {
    this.apiKey = apiKey;
    this.refreshToken = refreshToken;
    localStorage.setItem(STORAGE_KEYS.API_KEY, apiKey);
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
  }

  async getAccessToken() {
    if (!this.apiKey || !this.refreshToken) return false;
    
    try {
      const response = await fetch(`${BASE_URL}/v1/get_access_token`, {
        method: 'GET',
        headers: {
          'X-API-Key': this.apiKey,
          'Authorization': `Bearer ${this.refreshToken}`
        }
      });
      const data = await response.json();
      if (data.status === 'Success') {
        this.accessToken = data.message.access_token;
        return true;
      }
      throw new Error(data.message || 'Failed to get access token');
    } catch (error) {
      console.error('Auth Error:', error);
      return false;
    }
  }

  async request(endpoint, method = 'GET', body = null) {
    const headers = {
      'X-API-Key': this.apiKey,
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json'
    };
    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    const data = await response.json();
    if (data.status !== 'Success') throw new Error(data.message || 'API Error');
    return data.message;
  }

  async getDevices() {
    return this.request('/v1/get_list_of_devices');
  }

  async getDeviceStates() {
    return this.request('/v1/get_device_state?device_id=all');
  }

  async sendCommand(deviceId, command) {
    return this.request('/v1/send_command', 'POST', {
      device_id: deviceId,
      command: command
    });
  }
}

class App {
  constructor() {
    this.api = new AtombergAPI();
    this.devicesContainer = document.getElementById('devices-container');
    this.statusContainer = document.getElementById('status-container');
    this.statusText = document.getElementById('status-text');
    this.refreshBtn = document.getElementById('refresh-btn');
    this.settingsBtn = document.getElementById('settings-btn');
    this.setupBtn = document.getElementById('setup-btn');
    this.settingsDialog = document.getElementById('settings-dialog');
    this.apiKeyInput = document.getElementById('api-key-input');
    this.refreshTokenInput = document.getElementById('refresh-token-input');

    this.devices = [];
    this.states = {};

    this.init();
  }

  async init() {
    this.refreshBtn.addEventListener('click', () => this.loadData());
    this.settingsBtn.addEventListener('click', () => this.openSettings());
    this.setupBtn.addEventListener('click', () => this.openSettings());
    
    this.settingsDialog.addEventListener('closed', (e) => {
      if (this.settingsDialog.returnValue === 'save') {
        this.saveSettings();
      }
    });

    this.showStatus('Authenticating...');
    const authSuccess = await this.api.getAccessToken();
    if (authSuccess) {
      await this.loadData();
    } else {
      this.showStatus('Please enter your API Key and Refresh Token from the Atomberg app Settings.', false);
      this.setupBtn.style.display = 'inline-flex';
    }
  }

  openSettings() {
    this.apiKeyInput.value = this.api.apiKey || '';
    this.refreshTokenInput.value = this.api.refreshToken || '';
    this.settingsDialog.show();
  }

  async saveSettings() {
    const newApiKey = this.apiKeyInput.value.trim();
    const newRefreshToken = this.refreshTokenInput.value.trim();
    
    if (newApiKey && newRefreshToken) {
      this.api.updateCredentials(newApiKey, newRefreshToken);
      this.setupBtn.style.display = 'none';
      await this.init(); // Restart initialization with new keys
    } else {
      alert('Both API Key and Refresh Token are required.');
    }
  }

  showStatus(msg, loading = true) {
    this.statusContainer.style.display = 'flex';
    this.devicesContainer.style.display = 'none';
    this.statusText.textContent = msg;
    document.getElementById('loader').style.display = loading ? 'block' : 'none';
  }

  async loadData() {
    if (!this.api.accessToken) {
      this.showStatus('Missing access token. Check credentials limit or format.', false);
      return;
    }

    try {
      this.showStatus('Fetching devices...');
      const devicesData = await this.api.getDevices();
      const stateData = await this.api.getDeviceStates();

      this.devices = devicesData.devices_list || [];
      this.states = {};
      if (stateData && stateData.device_state) {
        stateData.device_state.forEach(s => {
          this.states[s.device_id] = s;
        });
      }

      this.render();
    } catch (e) {
      this.showStatus(`Error loading data: ${e.message}`, false);
    }
  }

  async handleCommand(deviceId, param, value) {
    try {
      // Optimistic UI could be added here
      const command = { [param]: value };
      console.log(`Sending command to ${deviceId}:`, command);
      await this.api.sendCommand(deviceId, command);
      // Refresh specific device state ideally, or just reload all
      setTimeout(() => this.loadData(), 1000);
    } catch (e) {
      console.error("Command failed", e);
      alert(`Command failed: ${e.message}`);
      this.loadData(); // Revert optimistic changes
    }
  }

  render() {
    this.statusContainer.style.display = 'none';
    this.devicesContainer.style.display = 'grid';
    this.devicesContainer.innerHTML = '';

    if (this.devices.length === 0) {
      this.devicesContainer.innerHTML = '<p>No supported devices found on this account.</p>';
      return;
    }

    this.devices.forEach(device => {
      const state = this.states[device.device_id] || {};
      const isPowerOn = state.power === true;
      const speed = state.last_recorded_speed || 0;

      const card = document.createElement('div');
      card.className = 'device-card';

      let icon = 'mode_fan';
      if (device.type?.toLowerCase().includes('light')) icon = 'lightbulb';

      card.innerHTML = `
        <div class="device-header">
          <div class="device-title">
            <div class="device-icon"><md-icon>${icon}</md-icon></div>
            <div>
              <h2>${device.name || 'Unknown Device'}</h2>
              <p style="margin: 4px 0 0; font-size: 0.85rem; opacity: 0.8;">
                ${device.model ? device.model.toUpperCase() : 'FAN'} | ${device.room || 'No Room'}
                <br>
                <span style="color: ${state.is_online ? 'var(--md-sys-color-primary)' : '#d32f2f'}; font-weight: bold;">
                  ${state.is_online ? '● ONLINE' : '○ OFFLINE'}
                </span>
              </p>
            </div>
          </div>
          <md-icon-button class="power-btn" toggle ${isPowerOn ? 'selected' : ''}>
            <md-icon>power_settings_new</md-icon>
            <md-icon slot="selected">power_settings_new</md-icon>
          </md-icon-button>
        </div>
        
        <div class="controls">
          <div class="control-label">
            <span class="speed-title">Fan Speed</span>
            <span class="speed-badge">${speed}</span>
          </div>
          <md-slider 
            min="1" max="6" step="1" 
            value="${speed}" 
            labeled
            ${!isPowerOn ? 'disabled' : ''}
          ></md-slider>
          
          <div class="control-row" style="margin-top: 16px">
             <md-outlined-button class="light-btn" ${!isPowerOn ? 'disabled' : ''}>
                <md-icon slot="icon">lightbulb</md-icon>
                Toggle Light
             </md-outlined-button>
             <md-outlined-button class="sleep-btn" ${!isPowerOn ? 'disabled' : ''}>
                <md-icon slot="icon">snooze</md-icon>
                Sleep Mode
             </md-outlined-button>
          </div>
        </div>
      `;

      // Event Listeners
      const powerBtn = card.querySelector('.power-btn');
      powerBtn.addEventListener('click', () => {
        this.handleCommand(device.device_id, 'power', !isPowerOn);
      });

      const slider = card.querySelector('md-slider');
      slider.addEventListener('change', () => {
        this.handleCommand(device.device_id, 'speed', slider.value);
      });

      const lightBtn = card.querySelector('.light-btn');
      lightBtn.addEventListener('click', () => {
        const currentLight = state.led === true;
        this.handleCommand(device.device_id, 'led', !currentLight);
      });

      const sleepBtn = card.querySelector('.sleep-btn');
      sleepBtn.addEventListener('click', () => {
        const currentSleep = state.sleep_mode === true;
        this.handleCommand(device.device_id, 'sleep', !currentSleep);
      });

      this.devicesContainer.appendChild(card);
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
