// npm run build  ->  writes the finished static site to dist/
import { buildSite } from './lib/site.mjs';

const { warnings } = await buildSite({ dev: process.argv.includes('--dev') });
if (process.argv.includes('--strict') && warnings.length) process.exit(1);
