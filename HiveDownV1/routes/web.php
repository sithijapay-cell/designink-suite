<?php

use App\Http\Controllers\ProfileController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "web" middleware group. Make something great!
|
*/

Route::get('/', function () {
    return view('home');
})->name('home');

Route::get('/blog', [App\Http\Controllers\BlogController::class, 'index'])->name('blog.index');
Route::get('/blog/{slug}', [App\Http\Controllers\BlogController::class, 'show'])->name('blog.show');

// Download proxy for cross-origin videos
Route::get('/download/proxy', [App\Http\Controllers\DownloadProxyController::class, 'download'])->name('download.proxy');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('/dashboard', [App\Http\Controllers\DashboardController::class, 'index'])->name('dashboard');
    Route::get('/dashboard/downloads', [App\Http\Controllers\DashboardController::class, 'downloads'])->name('dashboard.downloads');
    Route::get('/dashboard/subscription', [App\Http\Controllers\DashboardController::class, 'subscription'])->name('dashboard.subscription');
    Route::get('/dashboard/plans', [App\Http\Controllers\DashboardController::class, 'plans'])->name('dashboard.plans');
    Route::get('/dashboard/checkout/{plan}', [App\Http\Controllers\DashboardController::class, 'checkout'])->name('dashboard.checkout');
    Route::post('/dashboard/payment/submit', [App\Http\Controllers\DashboardController::class, 'submitPayment'])->name('dashboard.payment.submit');
    Route::get('/dashboard/profile', [App\Http\Controllers\DashboardController::class, 'profile'])->name('dashboard.profile');
});

Route::middleware('auth')->group(function () {
    // Redirect old profile routes to dashboard profile
    Route::get('/profile', function () {
        return redirect()->route('dashboard.profile');
    })->name('profile.edit');
    
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

require __DIR__.'/auth.php';
