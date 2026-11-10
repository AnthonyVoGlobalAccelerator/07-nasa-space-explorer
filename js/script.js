// Find the page controls and display areas.
const startInput = document.getElementById('startDate');
const endInput = document.getElementById('endDate');
const searchButton = document.getElementById('searchButton');
const gallery = document.getElementById('gallery');
const statusMessage = document.getElementById('status');
const factText = document.getElementById('factText');
const imageModal = document.getElementById('imageModal');
const closeModalButton = document.getElementById('closeModal');
const modalMedia = document.getElementById('modalMedia');
const modalTitle = document.getElementById('modalTitle');
const modalDate = document.getElementById('modalDate');
const modalExplanation = document.getElementById('modalExplanation');
const offlineIndicator = document.getElementById('offlineIndicator');
const installButton = document.getElementById('installButton');
const installMessage = document.getElementById('installMessage');
const notificationButton = document.getElementById('notificationButton');
const notificationMessage = document.getElementById('notificationMessage');

const apiUrl = 'https://science.nasa.gov/wp-json/wp/v2/apod-basic';
const facts = [
	'A day on Venus is longer than its year.',
	'Neutron stars can spin about 600 times every second.',
	'One million Earths could fit inside the Sun.',
	'Space is completely silent because sound needs a medium to travel.',
	'Olympus Mons on Mars is the tallest volcano in the solar system.',
	'A light-year measures distance, not time.',
	'Jupiter has the shortest day of any planet, lasting about 10 hours.',
	'The footprints left on the Moon may remain for millions of years.',
	'Saturn would float in water because its average density is lower than water.',
	'The Milky Way and Andromeda galaxies are expected to collide in about 4.5 billion years.'
];

// Pick a new fact whenever the app loads.
factText.textContent = facts[Math.floor(Math.random() * facts.length)];

// Call the setupDateInputs function from dateRange.js
// This sets up the date pickers to:
// - Default to a range of 9 days (from 9 days ago to today)
// - Restrict dates to NASA's image archive (starting from 1995)
setupDateInputs(startInput, endInput);

let deferredInstallPrompt;

function updateConnectionStatus() {
	offlineIndicator.hidden = navigator.onLine;
}

function registerServiceWorker() {
	if (!('serviceWorker' in navigator)) return;

	navigator.serviceWorker.register('./service-worker.js', { scope: './' })
		.catch(() => {
			installMessage.textContent = 'App installation is unavailable in this browser.';
		});
}

function setupInstallPrompt() {
	window.addEventListener('beforeinstallprompt', (event) => {
		event.preventDefault();
		deferredInstallPrompt = event;
		installButton.hidden = false;
		installMessage.textContent = 'Install Space Explorer for a faster, app-like launch.';
	});

	installButton.addEventListener('click', async () => {
		if (!deferredInstallPrompt) {
			installMessage.textContent = 'Use your browser menu to install this app when available.';
			return;
		}

		deferredInstallPrompt.prompt();
		const choice = await deferredInstallPrompt.userChoice;
		installMessage.textContent = choice.outcome === 'accepted'
			? 'Space Explorer is ready to launch from your apps.'
			: 'Installation was dismissed. You can install it later.';
		deferredInstallPrompt = null;
		installButton.hidden = true;
	});

	window.addEventListener('appinstalled', () => {
		installButton.hidden = true;
		installMessage.textContent = 'Space Explorer is installed and ready to launch.';
		deferredInstallPrompt = null;
	});

	window.addEventListener('load', () => {
		if (!deferredInstallPrompt && !window.matchMedia('(display-mode: standalone)').matches) {
			installMessage.textContent = 'Use your browser menu to install this app when available.';
		}
	});
}

function setupNotifications() {
	if (!('Notification' in window)) {
		notificationButton.disabled = true;
		notificationMessage.textContent = 'Notifications are not supported by this browser.';
		return;
	}

	notificationButton.addEventListener('click', async () => {
		try {
			const permission = await Notification.requestPermission();
			if (permission === 'granted') {
				notificationMessage.textContent = 'Notifications are enabled.';
				new Notification('NASA Space Explorer', {
					body: 'Your space briefing system is ready.'
				});
			} else if (permission === 'denied') {
				notificationMessage.textContent = 'Notifications are blocked. You can allow them in browser settings.';
			} else {
				notificationMessage.textContent = 'Notification permission was not granted.';
			}
		} catch (error) {
			notificationMessage.textContent = 'Notifications could not be enabled in this browser.';
		}
	});
}

updateConnectionStatus();
window.addEventListener('online', updateConnectionStatus);
window.addEventListener('offline', updateConnectionStatus);
registerServiceWorker();
setupInstallPrompt();
setupNotifications();

function showStatus(message, isError = false) {
	statusMessage.textContent = message;
	statusMessage.classList.toggle('error', isError);
}

function clearGallery() {
	gallery.innerHTML = '';
}

function escapeHtml(value) {
	return String(value).replace(/[&<>'"]/g, (character) => ({
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		"'": '&#39;',
		'"': '&quot;'
	}[character]));
}

function formatApiDate(dateValue) {
	const [year, month, day] = dateValue.split('-');
	return `${year.slice(2)}${month}${day}`;
}

function getPlainText(value) {
	const parser = new DOMParser();
	const documentFragment = parser.parseFromString(String(value || ''), 'text/html');
	return documentFragment.body.textContent.trim();
}

function normalizeEntry(entry) {
	return {
		date: entry.date,
		title: entry.title,
		media_type: entry.media_type,
		explanation: getPlainText(entry.explanation),
		url: entry.url || entry.permalink,
		hdurl: entry.hdurl || entry.url || entry.permalink
	};
}

function createGalleryCard(entry) {
	const card = document.createElement('article');
	card.className = 'gallery-item';
	const imageUrl = entry.hdurl || entry.url;
	const title = escapeHtml(entry.title || 'Untitled space image');
	const date = escapeHtml(entry.date || 'Date unavailable');

	if (entry.media_type === 'video') {
		card.classList.add('video-card');
		card.innerHTML = `
			<div class="placeholder-icon">▶</div>
			<p class="video-label">NASA video</p>
			<h2>${title}</h2>
			<p class="date">${date}</p>
			<p><a href="${escapeHtml(entry.url || '#')}" target="_blank" rel="noopener">Watch this entry on NASA</a></p>`;
		return card;
	}

	if (!imageUrl) return null;
	card.tabIndex = 0;
	card.innerHTML = `
		<img src="${escapeHtml(imageUrl)}" alt="${title}" loading="lazy">
		<h2>${title}</h2>
		<p class="date">${date}</p>`;
	card.addEventListener('click', () => openModal(entry));
	card.addEventListener('keydown', (event) => {
		if (event.key === 'Enter' || event.key === ' ') openModal(entry);
	});
	return card;
}

function openModal(entry) {
	const imageUrl = entry.hdurl || entry.url;
	modalMedia.innerHTML = imageUrl ? `<img src="${imageUrl}" alt="${entry.title || 'NASA space image'}">` : '';
	modalTitle.textContent = entry.title || 'Untitled space image';
	modalDate.textContent = entry.date || 'Date unavailable';
	modalExplanation.textContent = entry.explanation || 'NASA has not provided an explanation for this entry.';
	imageModal.hidden = false;
	document.body.style.overflow = 'hidden';
	closeModalButton.focus();
}

function closeModal() {
	imageModal.hidden = true;
	modalMedia.innerHTML = '';
	document.body.style.overflow = '';
}

async function getSpaceImages() {
	if (!startInput.value || !endInput.value) {
		showStatus('Please select both a start date and an end date.', true);
		return;
	}
	if (startInput.value > endInput.value) {
		showStatus('The start date must be on or before the end date.', true);
		return;
	}

	searchButton.disabled = true;
	showStatus('🔄 Loading space photos...');
	clearGallery();

	try {
		const params = new URLSearchParams({
			date_from: formatApiDate(startInput.value),
			date_to: formatApiDate(endInput.value)
		});
		const response = await fetch(`${apiUrl}?${params}`);
		if (!response.ok) throw new Error('NASA API request failed');
		const responseData = await response.json();
		if (!Array.isArray(responseData)) throw new Error('NASA API returned an unexpected response');
		const entries = responseData.map(normalizeEntry);
		const validEntries = entries.filter((entry) => entry.media_type === 'video' || entry.hdurl || entry.url);

		if (!validEntries.length) {
			gallery.innerHTML = '<div class="placeholder"><p>No space entries were found for that date range.</p></div>';
			showStatus('No space entries found. Try another date range.');
			return;
		}
		validEntries.forEach((entry) => {
			const card = createGalleryCard(entry);
			if (card) gallery.appendChild(card);
		});
		showStatus(`${validEntries.length} space entr${validEntries.length === 1 ? 'y' : 'ies'} loaded.`);
	} catch (error) {
		gallery.innerHTML = '<div class="placeholder"><p>We could not reach NASA right now. Please try again.</p></div>';
		showStatus('Unable to load space photos. Check your connection and try again.', true);
	} finally {
		searchButton.disabled = false;
	}
}

searchButton.addEventListener('click', getSpaceImages);
closeModalButton.addEventListener('click', closeModal);
imageModal.addEventListener('click', (event) => {
	if (event.target === imageModal) closeModal();
});
document.addEventListener('keydown', (event) => {
	if (event.key === 'Escape' && !imageModal.hidden) closeModal();
});
