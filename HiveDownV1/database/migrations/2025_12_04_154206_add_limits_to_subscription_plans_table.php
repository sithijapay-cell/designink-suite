<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('subscription_plans', function (Blueprint $table) {
            $table->integer('daily_download_limit')->default(100)->after('price');
            $table->integer('monthly_download_limit')->default(3000)->after('daily_download_limit');
            $table->boolean('can_download_hd')->default(true)->after('monthly_download_limit');
            $table->boolean('can_download_4k')->default(false)->after('can_download_hd');
            $table->boolean('no_ads')->default(false)->after('can_download_4k');
            $table->boolean('priority_support')->default(false)->after('no_ads');
        });
    }

    public function down(): void
    {
        Schema::table('subscription_plans', function (Blueprint $table) {
            $table->dropColumn([
                'daily_download_limit',
                'monthly_download_limit',
                'can_download_hd',
                'can_download_4k',
                'no_ads',
                'priority_support'
            ]);
        });
    }
};
