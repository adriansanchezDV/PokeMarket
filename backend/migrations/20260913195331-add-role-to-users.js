/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'role', {
      type: Sequelize.ENUM('customer', 'seller', 'admin'),
      allowNull: false,
      defaultValue: 'customer',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'role');

    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_users_role";');
  },
};
