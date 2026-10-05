/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('shipping_addresses', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },

      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },

      recipient_name: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },

      street: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },

      city: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },

      postal_code: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },

      province: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },

      country: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },

      phone: {
        type: Sequelize.STRING(30),
        allowNull: false,
      },

      is_default: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },

      updated_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('shipping_addresses');
  },
};
