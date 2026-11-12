const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const rootDirectory = path.resolve(__dirname, '..');
const port = Number(process.env.PORT) || 3000;
const nasaApiKey = loadSecret('NASA_API_KEY');
const contentTypes = {
	'.css': 'text/css',
	'.html': 'text/html',
	'.js': 'text/javascript',
	'.jpg': 'image/jpeg',
	'.json': 'application/json',
	'.png': 'image/png',
	'.webmanifest': 'application/manifest+json'
};

function loadSecret(name) {
	const envPath = path.join(__dirname, '.env');
	if (!fs.existsSync(envPath)) return process.env[name] || '';

	const envLines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
	const secretLine = envLines.find((line) => line.startsWith(`${name}=`));
	return secretLine ? secretLine.slice(name.length + 1).trim().replace(/^['"]|['"]$/g, '') : '';
}

function sendJson(response, statusCode, data) {
	response.writeHead(statusCode, { 'Content-Type': 'application/json' });
	response.end(JSON.stringify(data));
}

async function handleApodRequest(request, response, requestUrl) {
	if (!nasaApiKey) {
		sendJson(response, 500, { error: 'NASA_API_KEY is not configured on the server.' });
		return;
	}

	const nasaUrl = new URL('https://api.nasa.gov/planetary/apod');
	nasaUrl.searchParams.set('api_key', nasaApiKey);
	for (const parameter of ['start_date', 'end_date']) {
		const value = requestUrl.searchParams.get(parameter);
		if (value) nasaUrl.searchParams.set(parameter, value);
	}

	try {
		const nasaResponse = await fetch(nasaUrl);
		const responseBody = await nasaResponse.text();
		response.writeHead(nasaResponse.status, {
			'Content-Type': nasaResponse.headers.get('content-type') || 'application/json'
		});
		response.end(responseBody);
	} catch (error) {
		sendJson(response, 502, { error: 'Could not reach NASA.' });
	}
}

function serveFile(request, response, requestUrl) {
	const requestedPath = requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname;
	const filePath = path.resolve(rootDirectory, `.${requestedPath}`);

	if (!filePath.startsWith(rootDirectory + path.sep)) {
		response.writeHead(403);
		response.end('Forbidden');
		return;
	}

	fs.readFile(filePath, (error, file) => {
		if (error) {
			response.writeHead(error.code === 'ENOENT' ? 404 : 500);
			response.end(error.code === 'ENOENT' ? 'Not found' : 'Could not read file');
			return;
		}

		const contentType = contentTypes[path.extname(filePath)] || 'application/octet-stream';
		response.writeHead(200, { 'Content-Type': contentType });
		response.end(file);
	});
}

const server = http.createServer((request, response) => {
	const requestUrl = new URL(request.url, `http://${request.headers.host}`);

	if (request.method === 'GET' && requestUrl.pathname === '/api/apod') {
		handleApodRequest(request, response, requestUrl);
		return;
	}

	if (request.method === 'GET') {
		serveFile(request, response, requestUrl);
		return;
	}

	response.writeHead(405);
	response.end('Method not allowed');
});

server.listen(port, () => {
	console.log(`NASA Space Explorer is running at http://localhost:${port}`);
});
