import mongoose from 'mongoose';
const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true, required: true },
  budgetAlerts: { type: Boolean, default: true }, dailySummary: { type: Boolean, default: false },
  weeklySummary: { type: Boolean, default: true }, monthlySummary: { type: Boolean, default: true },
  telegramNotifications: { type: Boolean, default: false },
}, { timestamps: true });
export default mongoose.model('NotificationPreference', notificationSchema);
