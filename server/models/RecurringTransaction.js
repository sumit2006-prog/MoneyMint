import mongoose from 'mongoose';
const recurringSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  amount: { type: Number, required: true, min: 0.01, max: 1_000_000_000, validate: { validator: (amount) => Math.abs(amount * 100 - Math.round(amount * 100)) <= 1e-6, message: 'Recurring amounts support up to two decimal places.' } },
  type: { type: String, enum: ['income', 'expense'], required: true },
  category: { type: String, required: true },
  description: { type: String, default: '' },
  frequency: { type: String, enum: ['weekly', 'monthly', 'yearly'], default: 'monthly' },
  startDate: { type: Date, required: true },
  nextOccurrence: { type: Date, required: true },
  active: { type: Boolean, default: true },
}, { timestamps: true });
export default mongoose.model('RecurringTransaction', recurringSchema);
