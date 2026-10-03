import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from './models/User.js';
import Category from './models/Category.js';
import Transaction from './models/Transaction.js';
import Budget from './models/Budget.js';
import NotificationPreference from './models/NotificationPreference.js';

if (process.env.NODE_ENV === 'production') throw new Error('The demo seed is disabled in production.');
if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI in .env before seeding.');
if (!process.env.DEMO_SEED_PASSWORD || process.env.DEMO_SEED_PASSWORD.length < 16 || Buffer.byteLength(process.env.DEMO_SEED_PASSWORD, 'utf8') > 72) throw new Error('Set DEMO_SEED_PASSWORD to a private passphrase of 16–72 UTF-8 bytes before seeding.');
await mongoose.connect(process.env.MONGODB_URI);
const email = 'demo@moneymint.local';
let user = await User.findOne({ email });
if (!user) user = await User.create({ name: 'Aarav Mehta', email, passwordHash: await bcrypt.hash(process.env.DEMO_SEED_PASSWORD, 12) });
if (!await Category.exists({ userId: user._id })) {
  const categories = [['Food','expense','#ef9e38'],['Rent / Hostel','expense','#849bdf'],['Travel','expense','#35b4a0'],['Bills','expense','#e6b64b'],['Shopping','expense','#cf83bb'],['Entertainment','expense','#9275df'],['Fitness','expense','#53ad78'],['Other','expense','#92a49c'],['Parents','income','#55a978'],['Freelancing','income','#45a9a0'],['Scholarship','income','#dba84f']];
  await Category.insertMany(categories.map(([name,type,color]) => ({ userId:user._id,name,type,color })));
}
if (!await Transaction.exists({ userId: user._id })) {
  const date = (dayOffset) => { const d = new Date(); d.setDate(d.getDate() + dayOffset); d.setHours(12, 0, 0, 0); return d; };
  const rows = [
    [5000,'income','Parents','Monthly allowance','Bank transfer',-2], [7000,'income','Freelancing','Website project','Bank transfer',-3], [3000,'income','Scholarship','Scholarship','Bank transfer',-8],
    [320,'expense','Food','Dinner on Zomato','Zomato',0], [80,'expense','Travel','Auto to campus','Auto',-1], [4000,'expense','Rent / Hostel','October hostel fee','Hostel',-4],
    [850,'expense','Travel','Metro card and rides','Metro',-3], [500,'expense','Entertainment','Monthly subscription','Netflix',-5], [300,'expense','Bills','Mobile recharge','Airtel',-7],
    [280,'expense','Food','Groceries','Market',-2], [2400,'expense','Food','September meals','Various',-22], [1100,'expense','Travel','September travel','Various',-18]
  ];
  await Transaction.insertMany(rows.map(([amount,type,category,description,merchant,ago]) => ({ userId:user._id,amount,type,category,description,merchant,date:date(ago),paymentMethod:type==='income'?'Bank transfer':'UPI',source:'manual' })));
}
if (!await Budget.exists({ userId: user._id })) await Budget.insertMany([
  { userId:user._id,type:'daily',limit:300,period:'daily' }, { userId:user._id,type:'weekly',limit:2000,period:'weekly' }, { userId:user._id,type:'monthly',limit:10000,period:'monthly' },
  ...[['Food',3000],['Travel',1500],['Entertainment',1000],['Shopping',1000]].map(([category,limit]) => ({ userId:user._id,type:'category',period:'monthly',category,limit }))
]);
await NotificationPreference.updateOne({ userId:user._id }, { $setOnInsert: { userId:user._id } }, { upsert:true });
console.log(`Demo account ready: ${email}. Use the private DEMO_SEED_PASSWORD from .env to sign in.`);
await mongoose.disconnect();
