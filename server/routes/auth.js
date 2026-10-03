import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Category from '../models/Category.js';
import NotificationPreference from '../models/NotificationPreference.js';
import authenticate from '../middleware/auth.js';

const router = Router();
const publicUser = (user) => ({ id: user._id, name: user.name, email: user.email, currency: user.currency, theme: user.theme, dateFormat: user.dateFormat, defaultCategory: user.defaultCategory, paymentMethods: user.paymentMethods, telegramChatId: user.telegramChatId || '', profileImage: user.profileImage || '' });
const tokenFor = (user) => jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
const starterCategories = [
  ['Food', 'expense', 'salad', '#ef9e38'], ['Rent / Hostel', 'expense', 'house', '#849bdf'], ['Travel', 'expense', 'car', '#35b4a0'], ['Bills', 'expense', 'zap', '#e6b64b'],
  ['Shopping', 'expense', 'shopping-bag', '#cf83bb'], ['Entertainment', 'expense', 'film', '#9275df'], ['Education', 'expense', 'book-open', '#65a8d8'], ['Fitness', 'expense', 'dumbbell', '#53ad78'],
  ['Medical', 'expense', 'heart-pulse', '#e47575'], ['Other', 'expense', 'circle', '#92a49c'], ['Parents', 'income', 'users', '#55a978'], ['Salary', 'income', 'briefcase', '#668bd3'],
  ['Scholarship', 'income', 'graduation-cap', '#dba84f'], ['Freelancing', 'income', 'laptop', '#45a9a0'], ['Gift', 'income', 'gift', '#ca81b9']
];

router.post('/register', async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (name.length < 2 || name.length > 80) return res.status(400).json({ message: 'Enter your name (2–80 characters).' });
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ message: 'Enter a valid email address.' });
    if (password.length < 8) return res.status(400).json({ message: 'Use at least 8 characters for your password.' });
    if (Buffer.byteLength(password, 'utf8') > 72) return res.status(400).json({ message: 'Use a password of 72 UTF-8 bytes or fewer.' });
    if (await User.exists({ email })) return res.status(409).json({ message: 'An account with this email already exists.' });
    const passwordHash = await bcrypt.hash(password, 12);
    let user;
    try { user = await User.create({ name, email, passwordHash }); }
    catch (err) { if (err.code === 11000) return res.status(409).json({ message: 'An account with this email already exists.' }); throw err; }
    await Promise.all([
      Category.insertMany(starterCategories.map(([categoryName, type, icon, color]) => ({ userId: user._id, name: categoryName, type, icon, color }))),
      NotificationPreference.create({ userId: user._id })
    ]);
    res.status(201).json({ token: tokenFor(user), user: publicUser(user) });
  } catch (err) { next(err); }
});

router.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user || !(await bcrypt.compare(String(req.body.password || ''), user.passwordHash))) return res.status(401).json({ message: 'Email or password is incorrect.' });
    res.json({ token: tokenFor(user), user: publicUser(user) });
  } catch (err) { next(err); }
});

router.get('/me', authenticate, (req, res) => res.json({ user: publicUser(req.user) }));
router.put('/me', authenticate, async (req, res, next) => {
  try {
    const updates = {};
    for (const key of ['name', 'currency', 'theme', 'dateFormat', 'defaultCategory', 'telegramChatId']) if (req.body[key] !== undefined) updates[key] = req.body[key];
    if (Array.isArray(req.body.paymentMethods)) {
      const methods = [...new Set(req.body.paymentMethods.map((method) => String(method).trim()).filter((method) => method && method.length <= 40))];
      if (!methods.length || methods.length > 20) return res.status(400).json({ message: 'Keep between 1 and 20 payment methods.' });
      updates.paymentMethods = methods;
    }
    if (updates.name && (updates.name.length < 2 || updates.name.length > 80)) return res.status(400).json({ message: 'Name must be 2–80 characters.' });
    if (updates.currency && !['INR', 'USD', 'EUR', 'GBP'].includes(updates.currency)) return res.status(400).json({ message: 'Choose a supported currency.' });
    if (updates.theme && !['light', 'dark', 'system'].includes(updates.theme)) return res.status(400).json({ message: 'Choose a supported theme.' });
    if (updates.defaultCategory && String(updates.defaultCategory).length > 48) return res.status(400).json({ message: 'Default category must be 48 characters or fewer.' });
    if (updates.defaultCategory && !await Category.exists({ userId: req.user._id, name: String(updates.defaultCategory).trim(), type: { $in: ['expense', 'both'] } })) return res.status(400).json({ message: 'Choose an expense category from your account as the default.' });
    if (updates.telegramChatId !== undefined) {
      updates.telegramChatId = String(updates.telegramChatId).trim();
      if (updates.telegramChatId && !/^\d{1,20}$/.test(updates.telegramChatId)) return res.status(400).json({ message: 'Enter the numeric ID from your private Telegram chat.' });
    }
    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
    res.json({ user: publicUser(user) });
  } catch (err) { if (err.code === 11000) return res.status(409).json({ message: 'This Telegram chat is already connected to another account.' }); next(err); }
});

router.get('/preferences', authenticate, async (req, res, next) => {
  try {
    const pref = await NotificationPreference.findOneAndUpdate({ userId: req.user._id }, { $setOnInsert: { userId: req.user._id } }, { upsert: true, new: true });
    res.json({ preferences: pref });
  } catch (err) { next(err); }
});
router.put('/preferences', authenticate, async (req, res, next) => {
  try {
    const allowed = ['budgetAlerts', 'dailySummary', 'weeklySummary', 'monthlySummary', 'telegramNotifications'];
    const changes = Object.fromEntries(allowed.filter((key) => typeof req.body[key] === 'boolean').map((key) => [key, req.body[key]]));
    const preferences = await NotificationPreference.findOneAndUpdate({ userId: req.user._id }, { $set: changes, $setOnInsert: { userId: req.user._id } }, { upsert: true, new: true });
    res.json({ preferences });
  } catch (err) { next(err); }
});

export default router;
