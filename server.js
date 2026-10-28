require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");

const CAP = parseInt(process.env.CAP || "3", 10);
const app = express();
app.use(express.json({ limit: "10kb" }));
app.use(express.static(path.join(__dirname, "public")));

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("متصل بالمونجو"))
  .catch((e) => console.error("فشل الاتصال:", e.message));

const Row = mongoose.model(
  "Row",
  new mongoose.Schema({
    id: { type: String, unique: true, index: true },
    name: String,
    day: Number,
    ts: Number,
  })
);

// جلب التسجيلات (بدون كشف المعرفات؛ نعلّم تسجيلك فقط)
app.get("/api/rows", async (req, res) => {
  try {
    const me = String(req.query.me || "");
    const rows = await Row.find({}).sort({ ts: 1 }).lean();
    res.json(
      rows.map((r) => ({ name: r.name, day: r.day, ts: r.ts, mine: r.id === me }))
    );
  } catch (e) {
    res.status(500).json({ error: "خطأ بالسيرفر" });
  }
});

// تسجيل أو نقل
app.post("/api/rows", async (req, res) => {
  try {
    const id = String(req.body.id || "").slice(0, 40);
    const name = String(req.body.name || "").trim().slice(0, 30);
    const day = Number(req.body.day);
    if (!id || !name || !Number.isInteger(day) || day < 0 || day > 4) {
      return res.status(400).json({ error: "بيانات غير صحيحة" });
    }
    const all = await Row.find({}).lean();
    const dup = all.some(
      (r) => r.id !== id && r.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (dup) return res.status(409).json({ error: "هذا الاسم مسجّل مسبقًا. أضف حرفًا من اسم الأب للتمييز." });
    const inDay = all.filter((r) => r.day === day && r.id !== id).length;
    if (inDay >= CAP) return res.status(409).json({ error: "اكتمل هذا اليوم." });
    await Row.findOneAndUpdate({ id }, { id, name, day, ts: Date.now() }, { upsert: true });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "خطأ بالسيرفر" });
  }
});

// إلغاء تسجيلك فقط
app.delete("/api/rows", async (req, res) => {
  try {
    const id = String(req.body.id || "");
    if (!id) return res.status(400).json({ error: "بيانات غير صحيحة" });
    await Row.deleteOne({ id });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "خطأ بالسيرفر" });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("يشتغل على المنفذ " + port));
