import app from './app.js';
import config from './config/env.js';
import sequelize from './config/database.js';
import './models/indexModel.js';
import redisClient from './config/redis.js';

const startServer = async () => {
  try {
    await sequelize.authenticate();

    console.log('Database connection established');

    await redisClient.connect();

    const redisResponse = await redisClient.ping();

    console.log('Redis connection established:', redisResponse);

    app.listen(config.PORT, () => {
      console.log(`Server running on http://localhost:${config.PORT}`);
    });
  } catch (error) {
    console.error('Unable to start the server:', error);

    if (redisClient.isOpen) {
      await redisClient.quit().catch(() => undefined);
    }

    process.exit(1);
  }
};

startServer();
