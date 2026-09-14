import cors from 'cors';
import express from 'express';
import errorHandler from './middleware/errorHandler.js';
import notFound from './middleware/notFound.js';
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import sellerRoutes from './routes/sellers.js';
import setRoutes from './routes/sets.js';
import cardRoutes from './routes/cards.js';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/sellers', sellerRoutes);
app.use('/api/sets', setRoutes);
app.use('/api/cards', cardRoutes);

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
