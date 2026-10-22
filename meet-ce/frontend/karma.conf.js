const fs = require('fs');
const path = require('path');

// Locate a Chromium browser for karma-chrome-launcher without requiring a
// CHROME_BIN environment variable: prefer an explicit CHROME_BIN, then
// Chrome, then Edge (Edge is Chromium-based and works the same way).
const CHROMIUM_CANDIDATES = [
	process.env.CHROME_BIN,
	'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
	'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
	path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
	'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
	'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
];
for (const candidate of CHROMIUM_CANDIDATES) {
	if (candidate && fs.existsSync(candidate)) {
		process.env.CHROME_BIN = candidate;
		break;
	}
}

module.exports = function (config) {
	config.set({
		basePath: '',
		frameworks: ['jasmine', '@angular-devkit/build-angular'],
		plugins: [
			require('karma-jasmine'),
			require('karma-chrome-launcher'),
			require('karma-jasmine-html-reporter'),
			require('karma-coverage'),
			require('@angular-devkit/build-angular/plugins/karma')
		],
		client: {
			clearContext: false // Leave Jasmine Spec Runner output visible in browser
		},
		jasmineHtmlReporter: {
			suppressAll: true // Removes the duplicated traces
		},
		coverageReporter: {
			dir: path.join(__dirname, './coverage/shared-meet-components'),
			subdir: '.',
			reporters: [{ type: 'html' }, { type: 'text-summary' }]
		},
		reporters: ['progress', 'kjhtml', 'coverage'],
		port: 9876,
		colors: true,
		logLevel: config.LOG_INFO,
		autoWatch: true,
		customLaunchers: {
			// Headless Chrome for CI: no sandbox / shared-memory tweaks so it runs
			// inside containerized GitHub Actions runners.
			ChromeHeadlessCI: {
				base: 'ChromeHeadless',
				flags: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
			}
		},
		// Headless by default so no browser window pops up on developer machines;
		// select a visible browser explicitly with `--browsers=Chrome` if needed.
		browsers: ['ChromeHeadlessCI'],
		singleRun: false,
		restartOnFileChange: true,
	});
};
