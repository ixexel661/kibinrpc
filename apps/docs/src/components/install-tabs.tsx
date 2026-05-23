'use client';

import { useState } from 'react';

const managers = ['pnpm', 'npm', 'yarn', 'bun'] as const;
type Manager = (typeof managers)[number];

const commands: Record<Manager, string> = {
	pnpm: 'pnpm add @kibinrpc/server @kibinrpc/client',
	npm: 'npm install @kibinrpc/server @kibinrpc/client',
	yarn: 'yarn add @kibinrpc/server @kibinrpc/client',
	bun: 'bun add @kibinrpc/server @kibinrpc/client',
};

export function InstallTabs() {
	const [active, setActive] = useState<Manager>('pnpm');

	return (
		<div className="w-full max-w-lg mx-auto rounded-lg border border-fd-border overflow-hidden text-sm">
			<div className="flex border-b border-fd-border bg-fd-muted">
				{managers.map((m) => (
					<button
						key={m}
						type="button"
						onClick={() => setActive(m)}
						className={`px-4 py-2 text-xs font-medium transition-colors ${
							active === m
								? 'bg-fd-background text-fd-foreground border-b-2 border-fd-primary -mb-px'
								: 'text-fd-muted-foreground hover:text-fd-foreground'
						}`}
					>
						{m}
					</button>
				))}
			</div>
			<div className="bg-fd-background px-4 py-3 font-mono text-fd-foreground">
				{commands[active]}
			</div>
		</div>
	);
}
