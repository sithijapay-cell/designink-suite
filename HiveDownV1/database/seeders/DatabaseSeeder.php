<?php

namespace Database\Seeders;

// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\User;
use Spatie\Permission\Models\Role;
use App\Models\SystemConfiguration;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Create Roles
        $superAdminRole = Role::create(['name' => 'super_admin']);
        $adminRole = Role::create(['name' => 'admin']);
        $editorRole = Role::create(['name' => 'editor']);
        $userRole = Role::create(['name' => 'user']);

        // Create Admin User
        $adminEmail = env('DEFAULT_ADMIN_EMAIL', 'admin@example.com');
        $admin = User::firstOrCreate(
            ['email' => $adminEmail],
            [
                'name' => 'Super Admin',
                'password' => \Illuminate\Support\Facades\Hash::make(env('DEFAULT_ADMIN_PASSWORD', 'password')),
                'email_verified_at' => now(),
            ]
        );
        $admin->assignRole($superAdminRole);

        // Default System Config
        SystemConfiguration::set('site_name', 'Video Downloader');
        SystemConfiguration::set('premium_mode', true, 'boolean', 'billing'); // Default to premium mode
        SystemConfiguration::set('maintenance_mode', false, 'boolean', 'system');
    }
}
