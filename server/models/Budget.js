import mongoose from 'mongoose';

const budgetSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['daily', 'weekly', 'monthly', 'category'], required: true },
  limit: { type: Number, required: true, min: 0.01, max: 1_000_000_000, validate: { validator: (amount) => Math.abs(amount * 100 - Math.round(amount * 100)) <= 1e-6, message: 'Budget limits support up to two decimal places.' } },
  period: { type: String, enum: ['daily', 'weekly', 'monthly'], default: 'monthly' },
  category: { type: String, default: '' },
  alertThresholds: { type: [Number], default: [50, 75, 90, 100] },
}, { timestamps: true });
budgetSchema.index({ userId: 1, type: 1, category: 1 }, { unique: true });

export default mongoose.model('Budget', budgetSchema);
