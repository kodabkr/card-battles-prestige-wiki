// npm run serve  ->  preview the already-built dist/ at http://localhost:4321
import { startServer } from './server.mjs';
const port = +(process.env.PORT || 4321);
startServer({ dir: 'dist', port });
console.log(`Serving dist/ at http://localhost:${port}  (Ctrl+C to stop)`);
