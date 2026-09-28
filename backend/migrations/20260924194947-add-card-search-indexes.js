/** @type {import('sequelize-cli').Migration} */

export default {
  async up(queryInterface, _Sequelize) {
    await queryInterface.sequelize.query(`
      CREATE EXTENSION IF NOT EXISTS pg_trgm;
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX cards_name_trgm_idx
      ON cards
      USING GIN (name gin_trgm_ops);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX cards_artist_trgm_idx
      ON cards
      USING GIN (artist gin_trgm_ops);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX cards_number_trgm_idx
      ON cards
      USING GIN (number gin_trgm_ops);
    `);
  },

  async down(queryInterface, _Sequelize) {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS cards_name_trgm_idx;
    `);

    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS cards_artist_trgm_idx;
    `);

    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS cards_number_trgm_idx;
    `);
  },
};
