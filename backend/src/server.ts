import app from './app.js';
import config from './config/env.js';
import sequelize from './config/database.js';
import './models/indexModel.js';
import redisClient from './config/redis.js';

const startServer = async () => {
  try {
    await sequelize.authenticate();

    console.log('Database connection established');

    void redisClient
      .connect()
      .then(() => {
        console.log('Redis connection established');
      })
      .catch((error: unknown) => {
        console.error(
          'Redis unavailable; continuing without cache:',
          error instanceof Error ? error.name : 'UnknownError',
        );
      });

    app.listen(config.PORT, () => {
      console.log(`Server running on http://localhost:${config.PORT}`);
    });
  } catch (error) {
    console.error(
      'Unable to start the server:',
      error instanceof Error ? error.name : 'UnknownError',
    );

    if (redisClient.isOpen) {
      redisClient.destroy();
    }

    process.exit(1);
  }
};

startServer();
