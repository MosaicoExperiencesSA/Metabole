-- CreateTable
CREATE TABLE "role_page_permission" (
    "role" "Role" NOT NULL,
    "page_key" TEXT NOT NULL,
    "can_view" BOOLEAN NOT NULL DEFAULT false,
    "can_manage" BOOLEAN NOT NULL DEFAULT false,
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_page_permission_pkey" PRIMARY KEY ("role", "page_key")
);
