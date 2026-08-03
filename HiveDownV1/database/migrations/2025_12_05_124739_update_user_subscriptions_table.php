<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_subscriptions', function (Blueprint $table) {
            // Rename plan_id to subscription_plan_id
            $table->renameColumn('plan_id', 'subscription_plan_id');
            
            // Drop stripe_subscription_id if exists
            if (Schema::hasColumn('user_subscriptions', 'stripe_subscription_id')) {
                $table->dropColumn('stripe_subscription_id');
            }
            
            // Drop current_period_end if exists
            if (Schema::hasColumn('user_subscriptions', 'current_period_end')) {
                $table->dropColumn('current_period_end');
            }
            
            // Drop canceled_at if exists
            if (Schema::hasColumn('user_subscriptions', 'canceled_at')) {
                $table->dropColumn('canceled_at');
            }
            
            // Add new columns
            $table->timestamp('starts_at')->nullable()->after('status');
            $table->timestamp('ends_at')->nullable()->after('starts_at');
        });
    }

    public function down(): void
    {
        Schema::table('user_subscriptions', function (Blueprint $table) {
            $table->renameColumn('subscription_plan_id', 'plan_id');
            $table->string('stripe_subscription_id')->unique()->nullable();
            $table->timestamp('current_period_end')->nullable();
            $table->timestamp('canceled_at')->nullable();
            $table->dropColumn(['starts_at', 'ends_at']);
        });
    }
};
