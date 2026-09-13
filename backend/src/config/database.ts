import { Sequelize } from 'sequelize';

import config from './env.js';

const sequelize = new Sequelize({
  dialect: 'postgres',
  host: config.DB_HOST,
  port: config.DB_PORT,
  database: config.DB_NAME,
  username: config.DB_USER,
  password: config.DB_PASSWORD,
  logging: false,
});

export default sequelize;
