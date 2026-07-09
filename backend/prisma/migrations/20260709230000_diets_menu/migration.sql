-- CreateEnum
CREATE TYPE "DietStatus" AS ENUM ('draft', 'in_review', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "MealSlot" AS ENUM ('breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner');

-- CreateTable
CREATE TABLE "diet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "regime" "Regime" NOT NULL,
    "style" "DietStyle" NOT NULL,
    "meals_per_day" INTEGER NOT NULL,
    "levels" JSONB,
    "options" JSONB,
    "author_id" TEXT,
    "status" "DietStatus" NOT NULL DEFAULT 'draft',
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "regime" "Regime" NOT NULL,
    "meal_slot" "MealSlot" NOT NULL,
    "kcal" INTEGER NOT NULL,
    "ingredients" JSONB NOT NULL,
    "cooking_methods" JSONB,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "macros" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diet_day_template" (
    "id" TEXT NOT NULL,
    "diet_id" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "day_index" INTEGER NOT NULL,
    "meals" JSONB NOT NULL,

    CONSTRAINT "diet_day_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_day" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "diet_id" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "meals" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "visible_from" DATE NOT NULL,
    "source_rule_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menu_day_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_rating" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "recipe_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "stars" INTEGER NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipe_rating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shopping_list" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "date_from" DATE NOT NULL,
    "date_to" DATE NOT NULL,
    "items" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shopping_list_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "diet_status_idx" ON "diet"("status");

-- CreateIndex
CREATE INDEX "diet_regime_meals_per_day_status_idx" ON "diet"("regime", "meals_per_day", "status");

-- CreateIndex
CREATE INDEX "recipe_regime_meal_slot_active_idx" ON "recipe"("regime", "meal_slot", "active");

-- CreateIndex
CREATE UNIQUE INDEX "diet_day_template_diet_id_level_day_index_key" ON "diet_day_template"("diet_id", "level", "day_index");

-- CreateIndex
CREATE UNIQUE INDEX "menu_day_client_id_date_key" ON "menu_day"("client_id", "date");

-- CreateIndex
CREATE INDEX "menu_day_client_id_date_idx" ON "menu_day"("client_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_rating_client_id_recipe_id_date_key" ON "recipe_rating"("client_id", "recipe_id", "date");

-- CreateIndex
CREATE INDEX "recipe_rating_recipe_id_idx" ON "recipe_rating"("recipe_id");

-- CreateIndex
CREATE UNIQUE INDEX "shopping_list_client_id_date_from_date_to_key" ON "shopping_list"("client_id", "date_from", "date_to");

-- AddForeignKey
ALTER TABLE "diet" ADD CONSTRAINT "diet_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diet" ADD CONSTRAINT "diet_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diet_day_template" ADD CONSTRAINT "diet_day_template_diet_id_fkey" FOREIGN KEY ("diet_id") REFERENCES "diet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_day" ADD CONSTRAINT "menu_day_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_day" ADD CONSTRAINT "menu_day_diet_id_fkey" FOREIGN KEY ("diet_id") REFERENCES "diet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_rating" ADD CONSTRAINT "recipe_rating_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_rating" ADD CONSTRAINT "recipe_rating_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopping_list" ADD CONSTRAINT "shopping_list_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
