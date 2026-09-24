/** @type {import('sequelize-cli').Migration} */

export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('order_items', 'seller_profile_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'seller_profiles',
        key: 'id',
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });

    await queryInterface.addColumn('order_items', 'seller_name', {
      type: Sequelize.STRING(100),
      allowNull: true,
    });

    await queryInterface.addColumn('order_items', 'status', {
      type: Sequelize.STRING(30),
      allowNull: false,
      defaultValue: 'pending',
    });

    await queryInterface.sequelize.query(`
      UPDATE order_items oi
      SET seller_profile_id = p.seller_profile_id
      FROM products p
      WHERE oi.product_id = p.id
        AND oi.product_id IS NOT NULL;
    `);

    await queryInterface.sequelize.query(`
      UPDATE order_items oi
      SET seller_name = sp.store_name
      FROM seller_profiles sp
      WHERE oi.seller_profile_id = sp.id;
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('order_items', 'status');
    await queryInterface.removeColumn('order_items', 'seller_name');
    await queryInterface.removeColumn('order_items', 'seller_profile_id');
  },
};
