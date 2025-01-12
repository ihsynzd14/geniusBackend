import axios from 'axios';
import { geniusConfig } from '../config/genius.js';

class AuthService {
  constructor() {
    this.accessToken = null;
    this.idToken = null;
    this.refreshToken = null;
  }

  async authenticate() {
    try {
      const [geniusAuth, geniusAuthV1] = await Promise.all([
        this.authGenius(),
        this.authGeniusV1()
      ]);

      if (geniusAuth.access_token && geniusAuthV1.IdToken) {
        this.accessToken = geniusAuth.access_token;
        this.idToken = geniusAuthV1.IdToken;
        this.refreshToken = geniusAuthV1.RefreshToken;
        return true;
      }
      return false;
    } catch (error) {
      console.error('Authentication failed:', error);
      return false;
    }
  }

  async authGenius() {
    const params = new URLSearchParams({
      audience: "https://api.geniussports.com",
      grant_type: "client_credentials",
      client_id: geniusConfig.clientProdId,
      client_secret: geniusConfig.clientProdSecret
    });

    const response = await axios.post(geniusConfig.authProdUrl, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    return response.data;
  }

  async authGeniusV1(refresh = false) {
    const body = refresh ? {
      user: geniusConfig.user,
      refreshtoken: this.refreshToken
    } : {
      user: geniusConfig.user,
      password: geniusConfig.password
    };

    const url = refresh ? geniusConfig.refreshUrl : geniusConfig.authUrlV1;
    const response = await axios.post(url, body, {
      headers: { 'Content-Type': 'application/json' }
    });
    return response.data;
  }

  getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.accessToken}`,
      'x-api-key': geniusConfig.apiProdKey
    };
  }

  getHeadersV1() {
    return {
      'Content-Type': 'application/json',
      'Authorization': this.idToken,
      'x-api-key': geniusConfig.apiKeyV1
    };
  }
}

export const authService = new AuthService();