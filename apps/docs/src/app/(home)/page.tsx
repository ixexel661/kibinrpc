import Image from 'next/image';
import Link from 'next/link';
import { InstallTabs } from '@/components/install-tabs';

export default function HomePage() {
	return (
		<div className="flex flex-col justify-center text-center flex-1 gap-4">
			<Image
				src="/kibin-logo.png"
				alt="kibinrpc"
				width={240}
				height={160}
				className="mx-auto"
				priority
			/>
			<h1 className="text-4xl font-bold">kibinrpc</h1>
			<p className="text-fd-muted-foreground text-lg max-w-md mx-auto">
				Lightweight TypeScript RPC-like with end-to-end type safety. No code generation, no schema
				files - just TypeScript.
			</p>
			<div className="flex gap-3 justify-center mt-2">
				<Link
					href="/docs"
					className="bg-fd-primary text-fd-primary-foreground px-4 py-2 rounded-md font-medium text-sm hover:opacity-90 transition-opacity"
				>
					Get started
				</Link>
				<a
					href="https://github.com/ixexel661/kibinrpc"
					className="border border-fd-border px-4 py-2 rounded-md font-medium text-sm hover:bg-fd-accent transition-colors"
				>
					GitHub
				</a>
			</div>
			<InstallTabs />
		</div>
	);
}
