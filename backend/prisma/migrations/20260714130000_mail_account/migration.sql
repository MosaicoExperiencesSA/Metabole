-- Casella di posta @metabole.eu dell'utente (password cifrata a riposo)
CREATE TABLE "mail_account" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "enc_password" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "mail_account_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "mail_account_user_id_key" ON "mail_account"("user_id");
ALTER TABLE "mail_account" ADD CONSTRAINT "mail_account_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
