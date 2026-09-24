import cors from 'cors';
import express from 'express';
import errorHandler from './middleware/errorHandler.js';
import notFound from './middleware/notFound.js';
import authRoutes from './routes/authRoutes.js';
import usersRoutes from './routes/usersRoutes.js';
import sellerRoutes from './routes/sellersProfileRoutes.js';
import setRoutes from './routes/setsRoutes.js';
import cardRoutes from './routes/cardsRoutes.js';
import productRoutes from './routes/productsRoutes.js';
import favoritesRoutes from './routes/favoritesRoutes.js';
import cartRoutes from './routes/cartRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import sellerOrderRoutes from './routes/sellerOrderRoutes.js';
import sellerStatsRoutes from './routes/sellerStatsRoutes.js';
const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/sellers', sellerRoutes);
app.use('/api/sets', setRoutes);
app.use('/api/cards', cardRoutes);
app.use('/api/products', productRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/seller/orders', sellerOrderRoutes);
app.use('/api/seller/stats', sellerStatsRoutes);

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
