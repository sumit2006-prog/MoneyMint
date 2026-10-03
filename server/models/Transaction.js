import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  amount: { type: Number, required: true, min: 0.01, max: 1_000_000_000, validate: { validator: (amount) => Math.abs(amount * 100 - Math.round(amount * 100)) <= 1e-6, message: 'Transaction amounts support up to two decimal places.' } },
  type: { type: String, enum: ['income', 'expense'], required: true, index: true },
  category: { type: String, required: true, trim: true, maxlength: 48 },
  description: { type: String, default: '', trim: true, maxlength: 160 },
  merchant: { type: String, default: '', trim: true, maxlength: 100 },
  date: { type: Date, required: true, index: true },
  paymentMethod: { type: String, default: 'UPI', trim: true },
  source: { type: String, enum: ['manual', 'telegram', 'bank statement'], default: 'manual' },
  notes: { type: String, default: '', maxlength: 500 },
  transactionId: { type: String, trim: true, maxlength: 100 },
  recurring: { type: Boolean, default: false },
}, { timestamps: true });
transactionSchema.index({ userId: 1, date: -1 });
transactionSchema.index({ userId: 1, amount: 1, description: 1, date: 1 });
transactionSchema.index({ userId: 1, transactionId: 1 }, { unique: true, partialFilterExpression: { transactionId: { $type: 'string', $gt: '' } } });

export default mongoose.model('Transaction', transactionSchema);
