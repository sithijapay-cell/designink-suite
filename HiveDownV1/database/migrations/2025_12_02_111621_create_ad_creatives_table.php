<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ad_creatives', function (Blueprint $table) {
            $table->id();
            $table->foreignId('zone_id')->constrained('ad_zones')->cascadeOnDelete();
            $table->text('html_content')->nullable(); // For JS snippets
            $table->string('image_path')->nullable();
            $table->string('target_url')->nullable();
            $table->integer('priority')->default(0);
            $table->unsignedBigInteger('impressions')->default(0);
            $table->unsignedBigInteger('clicks')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ad_creatives');
    }
};
