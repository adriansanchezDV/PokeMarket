import bcrypt from 'bcrypt';
import type { Request, Response, NextFunction } from 'express';

import { User } from '../models/indexModel.js';
import {
  authenticateUser,
  generateAuthToken,
} from '../services/authService.js';

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { fullName, email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required',
      });
    }

    const existingUser = await User.findOne({
      where: { email },
    });

    if (existingUser) {
      return res.status(409).json({
        error: 'Email already registered',
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      fullName: fullName || null,
      email,
      password: passwordHash,
    });

    res.status(201).json({
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { email, password } = req.body;

    const user = await authenticateUser(email, password);

    if (!user) {
      return res.status(401).json({
        error: 'Invalid email or password',
      });
    }

    const token = generateAuthToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};