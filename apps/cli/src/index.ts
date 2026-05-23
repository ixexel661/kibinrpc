#!/usr/bin/env node
import { cancel, intro, isCancel, multiselect, outro, spinner, text } from '@clack/prompts';
import { scaffold, type TemplateId } from './scaffold.js';

async function main() {
	intro(' create kibinrpc ');

	const name = await text({
		message: 'Project name',
		placeholder: 'my-app',
		validate: (v) => {
			if (!v.trim()) return 'Please enter a project name';
			if (!/^[a-z0-9-]+$/.test(v.trim()))
				return 'Only lowercase letters, numbers and hyphens allowed';
		},
	});
	if (isCancel(name)) {
		cancel('Cancelled');
		process.exit(0);
	}

	const templates = await multiselect<
		{ value: TemplateId; label: string; hint: string }[],
		TemplateId
	>({
		message: 'What would you like to include?',
		options: [
			{ value: 'backend', label: 'Backend', hint: 'server router + actions' },
			{ value: 'frontend', label: 'Frontend', hint: 'React + Vite client' },
		],
		initialValues: ['backend', 'frontend'],
		required: true,
	});
	if (isCancel(templates)) {
		cancel('Cancelled');
		process.exit(0);
	}

	const s = spinner();
	s.start(`Creating ${name}`);
	scaffold({ name: name.trim(), templates });
	s.stop(`Created ${name}`);

	outro(`Next steps:\n  cd ${name}\n  pnpm install\n  pnpm dev`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
