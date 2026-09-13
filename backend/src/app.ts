import cors from 'cors';
import express from 'express';
import errorHandler from './middleware/errorHandler.js';
import notFound from './middleware/notFound.js';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/ping', (_req, res) => {
  res.json({ message: 'pong' });
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
  });
});

app.use(notFound);
app.use(errorHandler);

export default app;
