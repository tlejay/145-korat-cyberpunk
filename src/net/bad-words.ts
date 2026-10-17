// Profanity filter lists (Thai + English). Matching is done on a "skeleton"
// (lowercase, de-leeted, Thai tone/upper/lower vowel marks removed, repeats collapsed)
// — see name.ts. Add words here; keep them lowercase.

// Matched anywhere inside the name.
export const BAD_WORDS: readonly string[] = [
  // Thai
  'ควย', 'เหี้ย', 'เหี้ยม', 'สันดาน', 'ระยำ', 'ชาติหมา', 'ไอ้สัตว์', 'อีสัตว์', 'แม่ง', 'แม่มึง', 'พ่อมึง',
  'เย็ด', 'เย็ดแม่', 'จัญไร', 'ตอแหล', 'กะหรี่', 'อีดอก', 'อีตัว', 'ส้นตีน', 'ตีนตุ๊ก', 'หน้าหี', 'หน้าส้นตีน',
  'ไอ้เวร', 'อีเวร', 'ไอ้ควาย', 'อีควาย', 'ชิบหาย', 'ฉิบหาย', 'โคตรพ่อ', 'โคตรแม่', 'ดอกทอง', 'แตด', 'จู๋', 'จิ๋ม',
  // English
  'fuck', 'fuk', 'fck', 'shit', 'bitch', 'cunt', 'dick', 'cock', 'pussy', 'whore', 'slut', 'bastard', 'nigger',
  'nigga', 'faggot', 'retard', 'motherf', 'asshole', 'wanker', 'penis', 'vagina', 'porn', 'rape', 'hitler', 'nazi',
];

// Matched only as a whole word (too short to match as a substring without false positives).
export const BAD_TOKENS: readonly string[] = [
  'หี', 'สัส', 'สัด', 'เชี่ย', 'มึง', 'กู', 'ห่า', 'เวร', 'ควาย', 'ass', 'fag', 'cum', 'tit', 'tits', 'sex', 'xxx', 'kuy', 'hee', 'sus',
];
