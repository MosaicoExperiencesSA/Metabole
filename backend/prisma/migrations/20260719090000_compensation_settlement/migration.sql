-- Saldo provvigioni: data in cui il compenso del periodo (staff+mese) è stato pagato allo staff.
ALTER TABLE "staff_compensation" ADD COLUMN "settled_at" TIMESTAMP(3);
