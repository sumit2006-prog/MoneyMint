import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  currency: { type: String, default: 'INR', enum: ['INR', 'USD', 'EUR', 'GBP'] },
  theme: { type: String, default: 'light', enum: ['light', 'dark', 'system'] },
  dateFormat: { type: String, default: 'dd MMM yyyy' },
  defaultCategory: { type: String, default: 'Food' },
  paymentMethods: { type: [String], default: ['UPI', 'Cash', 'Debit Card', 'Credit Card', 'Bank transfer', 'Other'] },
  telegramChatId: { type: String, trim: true, maxlength: 40 },
  profileImage: { type: String, default: '' },
}, { timestamps: true });
userSchema.index({ telegramChatId: 1 }, { unique: true, partialFilterExpression: { telegramChatId: { $type: 'string', $gt: '' } } });

export default mongoose.model('User', userSchema);
