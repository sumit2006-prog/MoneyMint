import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 48 },
  type: { type: String, enum: ['income', 'expense', 'both'], default: 'expense' },
  icon: { type: String, default: 'circle' },
  color: { type: String, default: '#12a878' },
  rules: [{ type: String, trim: true, uppercase: true }],
}, { timestamps: true });
categorySchema.index({ userId: 1, name: 1 }, { unique: true });
export default mongoose.model('Category', categorySchema);
