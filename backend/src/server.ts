import app from './app.js';
import config from './config/env.js';
import sequelize from './config/database.js';
import './models/index.js';

const startServer = async () => {
  try {
    await sequelize.authenticate();

    console.log('Database connection established');

    app.listen(config.PORT, () => {
      console.log(`Server running on http://localhost:${config.PORT}`);
    });
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    process.exit(1);
  }
};

startServer();
