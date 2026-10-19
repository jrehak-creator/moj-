import { createApp } from './app.mjs';

const port = Number(process.env.PORT || 3001);
const app = await createApp({ dataDir: process.env.DATA_DIR });
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Nest is ready at http://localhost:${server.address().port}`);
});

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
