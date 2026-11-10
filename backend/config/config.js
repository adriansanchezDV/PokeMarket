import 'dotenv/config';

const connectionConfig = {
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  dialect: 'postgres',
};

const assertNonTestEnvironment = () => {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true') {
    throw new Error('Test operations require the Sequelize CLI --env test option');
  }
};

const assertTestDatabase = (database) => {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Test migrations require NODE_ENV=test');
  }

  if (process.env.TEST_DB_NAME !== 'pokemarket_test') {
    throw new Error('TEST_DB_NAME must explicitly be pokemarket_test');
  }

  if (process.env.TEST_DB_NAME === process.env.DB_NAME) {
    throw new Error('The test database must differ from DB_NAME');
  }

  if (database !== process.env.TEST_DB_NAME) {
    throw new Error('Refusing test migrations on a different database');
  }
};

export default {
  get development() {
    assertNonTestEnvironment();
    return { ...connectionConfig, database: process.env.DB_NAME };
  },

  get test() {
    const database = process.env.TEST_DB_NAME;
    assertTestDatabase(database);

    return {
      ...connectionConfig,
      database,
      hooks: {
        beforeConnect(config) {
          assertTestDatabase(config.database);
        },
      },
    };
  },

  get production() {
    assertNonTestEnvironment();
    return { ...connectionConfig, database: process.env.DB_NAME };
  },
};
