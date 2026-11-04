# Appointment PMS

**Appointment** هو نظام لإدارة الفنادق والإقامات والمنتجعات، ويضم مخطط Gantt والحجوزات والاستقبال والفوترة والتدبير الفندقي والعمليات.

- [تطبيق الويب](https://connacri.github.io/Appointment/)
- [إصدارات Windows وAndroid](https://github.com/Connacri/Appointment/releases)
- [الدليل الكامل](./README.md)
- [دليل الفندق وأقفال proUSB](./docs/PROUSB_HOTEL_OPERATIONS_MANUAL.md)

## المنصات

- **الويب:** React 19 وTypeScript وVite.
- **Android:** Capacitor 8.
- **Windows Desktop:** Tauri 2 وRust وWebView2. التطبيق برنامج أصلي يستضيف الواجهة ولا يقوم بتشغيل Edge. يمكنه قراءة CardLock عبر نافذة اختيار الملفات الأصلية وتخزين سلسلة Neon في Windows Credential Manager.

## إنشاء الفندق

عند التشغيل الأول، أدخل بيانات المؤسسة ثم اختر:
1. استيراد قاعدة proUSB المسماة `CardLock.mdb`، أو
2. إنشاء المباني والطوابق والغرف يدوياً.

يستخدم توليد الغرف بادئة ونطاقاً رقمياً. مثال: البادئة `1` والنطاق `01–30` واستثناء `13` ينتج الغرف 101 إلى 130 باستثناء 113. استثناء الرقم 13 افتراضي ويمكن تغييره.

يفحص مستورد CardLock جميع الجداول ويعرض أسماءها وعدد الصفوف والأعمدة. لا تُحوّل تلقائياً إلا الجداول التي تم التحقق من معناها وربطها ببيانات الفندق.

## التطوير

المتطلبات: Node.js 22 وnpm. لبناء Windows الأصلي: Rust stable وMSVC وWebView2.

```bash
npm install --legacy-peer-deps
npm run dev
npm run lint
npm run test
npm run tauri:dev
```

المزامنة الثنائية الكاملة بين Supabase وNeon لم تُنفذ بعد. نجاح اختبار اتصال Neon يثبت اتصال PostgreSQL فقط ولا يثبت مزامنة البيانات. راجع [البنية التقنية](./docs/ARCHITECTURE.md) و[إصدار Windows](./docs/RELEASE.md).
