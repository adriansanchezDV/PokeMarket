/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('products', 'is_active', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('products', 'is_active');
  },
};
