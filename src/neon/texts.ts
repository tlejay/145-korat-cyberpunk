// Made-up Korat shop names for the neon signs (no real brands — BRIEF-visuals §3).
// Rendered on canvas with Noto Sans Thai; imagegen never writes Thai.

// Horizontal shop-front neon boxes (anchors.neon) — 2 columns × 7 rows in the atlas.
export const NEON_TEXTS = [
  'ผัดหมี่โคราช', 'ข้าวมันไก่', 'หมูยอโคราช', 'ซ่อมมือถือ',
  'ก๋วยเตี๋ยวเรือ', 'ข้าวต้มโต้รุ่ง', 'นวดแผนไทย', 'ส้มตำไก่ย่าง',
  'ชาไข่มุก', 'คาราโอเกะ', 'ห้องพักรายวัน', 'ร้านกาแฟ',
  'ขนมจีนโคราช', 'เกมเซ็นเตอร์',
] as const;

// Vertical blade signs (anchors.blade) — the word is rotated 90° (reads bottom → top).
export const BLADE_TEXTS = [
  'โรงแรม', 'นวด', 'ร้านยา', 'กาแฟ', 'ซ่อมมือถือ', 'ข้าวมันไก่', 'หมูยอ', 'คาราโอเกะ',
  'ห้องพัก', 'ผัดหมี่', 'ก๋วยเตี๋ยว', 'ชาไข่มุก', 'ไก่ย่าง', 'เกม', 'ตัดผม', 'ร้านทอง',
] as const;

// Rooftop billboards (anchors.billboard): headline + small line. Fictional cyber products.
export const BILLBOARD_TEXTS = [
  { head: 'ก๋วยเตี๋ยวหุ่นยนต์', sub: 'เสิร์ฟใน 30 วินาที' },
  { head: 'ผัดหมี่โคราช นีออน', sub: 'เผ็ดถึงใจ ทั้งคืน' },
  { head: 'หมูยอไซเบอร์', sub: 'ของฝากจากเมืองย่าโม' },
  { head: 'ผ้าไหมเรืองแสง', sub: 'ทอมือ ส่องได้ในความมืด' },
  { head: 'ชาร์จไว 5 นาที', sub: 'แบตเตอรี่รถไฟฟ้าโคราช' },
] as const;

// Neon tube colours (linear-ish sRGB hex). Index stored per sign so lights on the wet road match.
export const NEON_COLORS = ['#22e6ff', '#ff2fa8', '#b44dff', '#7dff6a', '#ffb030', '#ff4040', '#d8f0ff'] as const;
