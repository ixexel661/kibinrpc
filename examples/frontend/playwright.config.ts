import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './tests',
	use: {
		baseURL: 'http://localhost:5173',
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
	],
	webServer: [
		{
			command: 'pnpm dev',
			cwd: '../backend',
			port: 3000,
			reuseExistingServer: true,
		},
		{
			command: 'pnpm dev',
			port: 5173,
			reuseExistingServer: true,
		},
	],
});
