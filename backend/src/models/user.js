"use strict";
const { DataTypes } = require("sequelize");
const { ROLES } = require("../config/constants");

module.exports = (sequelize) => {
  const User = sequelize.define(
    "User",
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      email: {
        type: DataTypes.STRING(160),
        allowNull: false,
        unique: true,
        validate: { isEmail: true },
      },
      passwordHash: { type: DataTypes.STRING(255), allowNull: false },
      firstName: { type: DataTypes.STRING(80), allowNull: false },
      lastName: { type: DataTypes.STRING(80), allowNull: false },
      role: {
        type: DataTypes.ENUM(...Object.values(ROLES)),
        allowNull: false,
        defaultValue: ROLES.CUSTOMER,
      },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      lastLoginAt: { type: DataTypes.DATE, allowNull: true },
    },
    {
      tableName: "users",
      indexes: [{ fields: ["role"] }, { fields: ["is_active"] }],
      defaultScope: { attributes: { exclude: ["passwordHash"] } },
      scopes: { withPassword: { attributes: { include: ["passwordHash"] } } },
    }
  );

  User.prototype.fullName = function fullName() {
    return `${this.firstName} ${this.lastName}`;
  };

  return User;
};
