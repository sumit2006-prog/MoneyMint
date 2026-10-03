import mongoose from 'mongoose';
const importedStatementSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  filename: { type: String, required: true },
  fileHash: { type: String, required: true },
  rowCount: { type: Number, default: 0 },
  importedAt: { type: Date, default: Date.now },
}, { timestamps: true });
importedStatementSchema.index({ userId: 1, fileHash: 1 }, { unique: true });
export default mongoose.model('ImportedStatement', importedStatementSchema);
