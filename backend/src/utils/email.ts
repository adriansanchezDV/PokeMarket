import { col, fn, where } from 'sequelize';

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const emailMatches = (email: string) =>
  where(fn('lower', fn('btrim', col('email'))), normalizeEmail(email));
