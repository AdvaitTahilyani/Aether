/**
 * axios-config.ts
 *
 * Configures Axios instances for API requests with authentication handling.
 * This file provides a factory function to create authenticated Axios instances
 * for making requests to the Gmail API.
 */

import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import { OAuth2Client } from "google-auth-library";

/**
 * Base URL for Gmail API requests
 */
const GMAIL_API_BASE_URL = "https://gmail.googleapis.com/gmail/v1";

/**
 * Creates an authenticated Axios instance for Gmail API requests
 *
 * @param auth - Authenticated OAuth2Client instance
 * @returns Configured Axios instance with authentication headers
 */
export const createGmailApiClient = async (
  auth: OAuth2Client
): Promise<AxiosInstance> => {
  // Ensure we have a valid token
  const tokenInfo = await auth.getAccessToken();
  const token = tokenInfo.token;

  if (!token) {
    throw new Error("No valid access token available");
  }

  // Create Axios instance with default configuration
  const axiosConfig: AxiosRequestConfig = {
    baseURL: GMAIL_API_BASE_URL,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    // Add reasonable timeout
    timeout: 10000,
  };

  const instance = axios.create(axiosConfig);

  // Add response interceptor for error handling
  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      // Handle 401 Unauthorized errors (token expired)
      if (error.response && error.response.status === 401) {
        try {
          // Attempt to refresh the token
          const refreshedTokens = await auth.refreshAccessToken();
          // Update the Authorization header with the new token
          error.config.headers[
            "Authorization"
          ] = `Bearer ${refreshedTokens.credentials.access_token}`;
          // Retry the request with the new token
          return axios(error.config);
        } catch (refreshError) {
          // If refresh fails, throw an error that can be handled by the caller
          throw new Error("Authentication token expired and refresh failed");
        }
      }
      return Promise.reject(error);
    }
  );

  return instance;
};
