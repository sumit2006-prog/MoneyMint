import { Router } from 'express';
import mongoose from 'mongoose';
import authenticate from '../middleware/auth.js';
import Category from '../models/Category.js';
const router = Router();
router.use(authenticate);
router.get('/', async (req, res, next) => {
  try { const categories = await Category.find({ userId: req.user._id }).sort({ type: 1, name: 1 }).lean(); res.json({ categories }); }
  catch (err) { next(err); }
});
router.post('/', async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name || name.length > 48) return res.status(400).json({ message: 'Enter a category name up to 48 characters.' });
    const type = req.body.type || 'expense';
    if (!['income', 'expense', 'both'].includes(type)) return res.status(400).json({ message: 'Choose income, expense, or both for this category.' });
    const category = await Category.create({ userId: req.user._id, name, type, color: /^#[\da-f]{6}$/i.test(req.body.color) ? req.body.color : '#12a878' });
    res.status(201).json({ category });
  } catch (err) { if (err.code === 11000) return res.status(409).json({ message: 'That category name already exists.' }); next(err); }
});
router.put('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Category not found.' });
    const updates = {};
    if (req.body.name !== undefined) { updates.name = String(req.body.name).trim(); if (!updates.name || updates.name.length > 48) return res.status(400).json({ message: 'Enter a category name up to 48 characters.' }); }
    if (req.body.type !== undefined) { if (!['income', 'expense', 'both'].includes(req.body.type)) return res.status(400).json({ message: 'Choose income, expense, or both for this category.' }); updates.type = req.body.type; }
    if (Array.isArray(req.body.rules)) updates.rules = [...new Set(req.body.rules.map((rule) => String(rule).trim().toUpperCase()).filter((rule) => rule && rule.length <= 60))].slice(0, 30);
    const category = await Category.findOneAndUpdate({ _id: req.params.id, userId: req.user._id }, updates, { new: true, runValidators: true });
    if (!category) return res.status(404).json({ message: 'Category not found.' });
    res.json({ category });
  } catch (err) { if (err.code === 11000) return res.status(409).json({ message: 'That category name already exists.' }); next(err); }
});
router.delete('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Category not found.' });
    const category = await Category.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!category) return res.status(404).json({ message: 'Category not found.' });
    res.json({ deleted: true });
  } catch (err) { next(err); }
});
export default router;
