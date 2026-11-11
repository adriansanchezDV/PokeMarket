import type { Request, Response, NextFunction } from 'express';

import { User } from '../models/indexModel.js';
import { Op } from 'sequelize';
import { emailMatches, normalizeEmail } from '../utils/email.js';

export const getMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await User.findByPk(req.user!.id, {
      attributes: {
        exclude: ['password'],
      },
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
      });
    }

    res.json(user);
  } catch (error) {
    next(error);
  }
};

export const updateMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await User.findByPk(req.user!.id);

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
      });
    }

    const { fullName, email } = req.body;

    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({
        error: 'Invalid request body',
      });
    }

    const allowedFields = ['fullName', 'email'];
    const receivedFields = Object.keys(req.body);

    const hasInvalidFields = receivedFields.some((field) => !allowedFields.includes(field));

    if (hasInvalidFields) {
      return res.status(400).json({
        error: 'Fields not allowed',
      });
    }

    // 2. Debe existir al menos un campo para actualizar.
    if (receivedFields.length === 0) {
      return res.status(400).json({
        error: 'At least one field is required',
      });
    }

    // 3. Validar el nombre si se ha enviado.
    if (fullName !== undefined) {
      if (typeof fullName !== 'string' || fullName.trim().length === 0) {
        return res.status(400).json({
          error: 'Invalid fullName',
        });
      }

      user.fullName = fullName.trim();
    }

    // 4. Validar el email si se ha enviado.
    if (email !== undefined) {
      if (
        typeof email !== 'string' ||
        email.trim().length === 0 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
      ) {
        return res.status(400).json({
          error: 'Invalid email',
        });
      }

      const normalizedEmail = normalizeEmail(email);

      const existingUser = await User.findOne({
        where: { [Op.and]: [emailMatches(normalizedEmail), { id: { [Op.ne]: user.id } }] },
      });

      if (existingUser) {
        return res.status(409).json({
          error: 'Email already registered',
        });
      }

      user.email = normalizedEmail;
    }

    // 5. Guardar los cambios.
    await user.save();

    return res.json({
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  } catch (error) {
    next(error);
  }
};
