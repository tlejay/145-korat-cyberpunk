import type { ErrorCode } from './codes.js';
import { NAME_MAX, NAME_MIN } from './name.js';

// Thai text for every API error code (CLAUDE.md §9: Thai only, say what to do next).
export const MESSAGES: Record<ErrorCode, string> = {
  BAD_REQUEST: 'ส่งข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง',
  BAD_TRACK: 'ไม่พบสนามนี้ กลับไปเลือกสนามใหม่',
  BAD_DEVICE: 'ข้อมูลเครื่องไม่ถูกต้อง ลองโหลดหน้าเกมใหม่',
  TOKEN_INVALID: 'รอบนี้บันทึกแต้มไม่ได้ เริ่มรอบใหม่แล้วลองอีกครั้ง',
  TOKEN_EXPIRED: 'รอบนี้ใช้เวลานานเกินไป เริ่มรอบใหม่เพื่อบันทึกแต้ม',
  TOKEN_MISMATCH: 'รอบนี้บันทึกแต้มไม่ได้ เริ่มรอบใหม่แล้วลองอีกครั้ง',
  RUN_USED: 'แต้มรอบนี้บันทึกไปแล้ว',
  RUN_TOO_FAST: 'เวลารอบนี้ผิดปกติ ระบบจึงไม่บันทึกแต้ม',
  RUN_IMPLAUSIBLE: 'ผลรอบนี้ผิดปกติ ระบบจึงไม่บันทึกแต้ม',
  RATE_LIMITED: 'ส่งบ่อยเกินไป พักสักครู่แล้วลองใหม่',
  NAME_TOO_SHORT: `ชื่อต้องยาวอย่างน้อย ${NAME_MIN} ตัวอักษร`,
  NAME_TOO_LONG: `ชื่อยาวได้ไม่เกิน ${NAME_MAX} ตัวอักษร`,
  NAME_BAD_CHARS: 'ใช้ได้เฉพาะตัวอักษรไทย อังกฤษ และตัวเลข',
  NAME_PROFANE: 'ชื่อนี้ใช้ไม่ได้ ลองตั้งชื่ออื่น',
  NO_SCORE: 'ยังไม่มีแต้มให้ตั้งชื่อ เล่นให้จบหนึ่งรอบก่อน',
  SERVER_ERROR: 'ระบบอันดับขัดข้องชั่วคราว ลองใหม่อีกครั้งภายหลัง',
  NETWORK: 'เชื่อมต่ออินเทอร์เน็ตไม่ได้ ตรวจสอบสัญญาณแล้วลองใหม่',
};

export function messageFor(code: ErrorCode): string {
  return MESSAGES[code] ?? MESSAGES.SERVER_ERROR;
}
