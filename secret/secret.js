// Keep the real NASA API key in server/.env.
// Files in this folder are loaded by the browser and cannot safely contain secrets.
const nasaApiConfig = {
	apiUrl: '/api/apod'
};
