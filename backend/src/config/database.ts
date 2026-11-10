import { Sequelize } from 'sequelize';
import config from './env.js';

const isTestEnvironment = process.env.NODE_ENV === 'test';
const databaseName = isTestEnvironment ? process.env.TEST_DB_NAME : config.DB_NAME;

export const assertTestDatabase = (selectedDatabase: string | undefined) => {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Test database operations require NODE_ENV=test');
  }

  const testDatabase = process.env.TEST_DB_NAME;
  if (testDatabase !== 'pokemarket_test') {
    throw new Error('TEST_DB_NAME must explicitly be pokemarket_test');
  }

  if (testDatabase === config.DB_NAME || testDatabase === process.env.DB_NAME) {
    throw new Error('The test database must differ from DB_NAME');
  }

  if (selectedDatabase !== testDatabase) {
    throw new Error('Refusing test operations on a different database');
  }
};

if (process.env.VITEST === 'true' && !isTestEnvironment) {
  throw new Error('Vitest requires NODE_ENV=test');
}

if (isTestEnvironment) {
  assertTestDatabase(databaseName);
}

const sequelize = new Sequelize({
  dialect: 'postgres',
  host: config.DB_HOST,
  port: config.DB_PORT,
  database: databaseName,
  username: config.DB_USER,
  password: config.DB_PASSWORD,
  logging: false,
});

export default sequelize;
