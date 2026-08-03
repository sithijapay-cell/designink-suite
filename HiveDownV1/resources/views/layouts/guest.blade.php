<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="{{ csrf_token() }}">

        <title>{{ config('app.name', 'Laravel') }}</title>

        <!-- Fonts -->
        <link rel="preconnect" href="https://fonts.bunny.net">
        <link href="https://fonts.bunny.net/css?family=inter:400,500,600,700,800&display=swap" rel="stylesheet" />

        <!-- Scripts -->
        @vite(['resources/css/app.css', 'resources/js/app.js'])
        
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
            }
            
            .auth-container {
                min-height: 100vh;
                display: flex;
            }
            
            .auth-left {
                display: none;
                width: 50%;
                background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 50%, #4F46E5 100%);
                position: relative;
                overflow: hidden;
            }
            
            @media (min-width: 1024px) {
                .auth-left {
                    display: flex;
                }
            }
            
            .auth-left::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: rgba(0, 0, 0, 0.1);
            }
            
            .auth-left::after {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-image: url('data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="0.05"%3E%3Cpath d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E');
            }
            
            .auth-left-content {
                position: relative;
                z-index: 10;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                width: 100%;
                padding: 0 3rem;
                color: white;
            }
            
            .auth-left-inner {
                max-width: 28rem;
            }
            
            .play-icon {
                width: 4rem;
                height: 4rem;
                margin-bottom: 1rem;
                fill: white;
            }
            
            .auth-title {
                font-size: 2.25rem;
                font-weight: 800;
                margin-bottom: 1.5rem;
                color: white;
            }
            
            .auth-description {
                font-size: 1.125rem;
                margin-bottom: 2rem;
                color: rgba(255, 255, 255, 0.9);
                line-height: 1.7;
            }
            
            .feature-list {
                display: flex;
                flex-direction: column;
                gap: 1rem;
            }
            
            .feature-item {
                display: flex;
                align-items: center;
            }
            
            .feature-icon {
                width: 1.5rem;
                height: 1.5rem;
                margin-right: 0.75rem;
                flex-shrink: 0;
                stroke: white;
            }
            
            .feature-text {
                color: white;
            }
            
            .auth-right {
                width: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 3rem 1.5rem;
                background-color: #F9FAFB;
            }
            
            @media (min-width: 1024px) {
                .auth-right {
                    width: 50%;
                }
            }
            
            .auth-form-container {
                width: 100%;
                max-width: 28rem;
            }
            
            .logo-section {
                text-align: center;
                margin-bottom: 2rem;
            }
            
            .logo-link {
                display: inline-block;
                text-decoration: none;
            }
            
            .logo-title {
                font-size: 1.875rem;
                font-weight: 700;
                color: #4F46E5;
            }
            
            .logo-subtitle {
                margin-top: 0.5rem;
                color: #6B7280;
            }
            
            .form-card {
                background: white;
                border-radius: 1rem;
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                padding: 2rem;
            }
            
            .register-link {
                margin-top: 1.5rem;
                text-align: center;
                font-size: 0.875rem;
                color: #6B7280;
            }
            
            .register-link a {
                font-weight: 600;
                color: #4F46E5;
                text-decoration: none;
                transition: color 0.2s;
            }
            
            .register-link a:hover {
                color: #4338CA;
            }
        </style>
    </head>
    <body>
        <div class="auth-container">
            <!-- Left Side - Gradient Background -->
            <div class="auth-left">
                <div class="auth-left-content">
                    <div class="auth-left-inner">
                        <div style="margin-bottom: 2rem;">
                            <svg class="play-icon" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z"/>
                            </svg>
                        </div>
                        <h1 class="auth-title">Welcome Back!</h1>
                        <p class="auth-description">
                            Download videos from any platform - fast, free, and easy. No registration required for basic features.
                        </p>
                        <div class="feature-list">
                            <div class="feature-item">
                                <svg class="feature-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                                </svg>
                                <span class="feature-text">Lightning fast downloads</span>
                            </div>
                            <div class="feature-item">
                                <svg class="feature-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                                </svg>
                                <span class="feature-text">Support for 40+ platforms</span>
                            </div>
                            <div class="feature-item">
                                <svg class="feature-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                                </svg>
                                <span class="feature-text">HD & 4K quality available</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Right Side - Login Form -->
            <div class="auth-right">
                <div class="auth-form-container">
                    <!-- Logo -->
                    <div class="logo-section">
                        <a href="/" class="logo-link">
                            <h2 class="logo-title">Video Downloader</h2>
                        </a>
                        <p class="logo-subtitle">Sign in to your account</p>
                    </div>

                    <!-- Login Form Card -->
                    <div class="form-card">
                        {{ $slot }}
                    </div>

                    <!-- Register Link -->
                    <p class="register-link">
                        Don't have an account?
                        <a href="{{ route('register') }}">
                            Sign up for free
                        </a>
                    </p>
                </div>
            </div>
        </div>
    </body>
</html>
