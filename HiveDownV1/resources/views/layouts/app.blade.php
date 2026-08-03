<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">

    @php
        $seoTitle = $title ?? \App\Models\SystemConfiguration::get('seo_title', config('app.name'));
        $seoDescription = $description ?? \App\Models\SystemConfiguration::get('seo_description');
        $seoKeywords = $keywords ?? \App\Models\SystemConfiguration::get('seo_keywords');
        $ogImage = $image ?? \App\Models\SystemConfiguration::get('og_image_url');
        $currentUrl = url()->current();
        $siteName = \App\Models\SystemConfiguration::get('site_name', config('app.name'));
        $siteLogo = \App\Models\SystemConfiguration::get('site_logo');
        $siteFavicon = \App\Models\SystemConfiguration::get('site_favicon');
        
        // Helper to get image URL (supports both URL and file path)
        $getImageUrl = function($path) {
            if (!$path) return null;
            if (filter_var($path, FILTER_VALIDATE_URL)) {
                return $path; // Already a URL
            }
            return asset('storage/' . $path); // File path
        };
        
        $logoUrl = $getImageUrl($siteLogo);
        $faviconUrl = $getImageUrl($siteFavicon);
    @endphp

    <title>{{ $seoTitle }}</title>
    <meta name="description" content="{{ $seoDescription }}">
    <meta name="keywords" content="{{ $seoKeywords }}">
    <link rel="canonical" href="{{ $currentUrl }}">
    
    <!-- Favicon -->
    @if($siteFavicon)
        <link rel="icon" type="image/png" href="{{ $siteFavicon }}">
    @endif

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="{{ $currentUrl }}">
    <meta property="og:title" content="{{ $seoTitle }}">
    <meta property="og:description" content="{{ $seoDescription }}">
    @if($ogImage)
        <meta property="og:image" content="{{ $ogImage }}">
    @endif
    <meta property="og:site_name" content="{{ $siteName }}">

    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image">
    <meta property="twitter:url" content="{{ $currentUrl }}">
    <meta property="twitter:title" content="{{ $seoTitle }}">
    <meta property="twitter:description" content="{{ $seoDescription }}">
    @if($ogImage)
        <meta property="twitter:image" content="{{ $ogImage }}">
    @endif

    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">

    <!-- Styles -->
    @vite(['resources/css/app.css', 'resources/js/app.js'])
    @livewireStyles
</head>
<body>
    <!-- Header -->
    <header class="site-header">
        <div class="container">
            <div class="header-left" style="display: flex; align-items: center; gap: 3rem;">
                <a href="{{ route('home') }}" class="logo" style="display: flex; align-items: center; gap: 0.75rem;">
                    @if($siteLogo)
                        <img src="{{ $siteLogo }}" alt="{{ $siteName }}" style="height: 40px; width: auto;">
                    @endif
                    <span>{{ $siteName }}</span>
                </a>
                
                <nav class="main-nav" style="display: flex; gap: 1.5rem;">
                    <a href="{{ route('home') }}" class="nav-link {{ request()->routeIs('home') ? 'active' : '' }}" style="{{ request()->routeIs('home') ? 'color: var(--primary-color);' : '' }}">Home</a>
                    <a href="{{ route('blog.index') }}" class="nav-link {{ request()->routeIs('blog.*') ? 'active' : '' }}" style="{{ request()->routeIs('blog.*') ? 'color: var(--primary-color);' : '' }}">Blog</a>
                </nav>
            </div>
            
            <div class="auth-links">
                @auth
                    <a href="{{ url('/dashboard') }}" class="btn btn-primary" style="padding: 0.5rem 1rem; font-size: 0.9rem;">Dashboard</a>
                    <form method="POST" action="{{ route('logout') }}" class="inline-form">
                        @csrf
                        <button type="submit" class="btn btn-link">Logout</button>
                    </form>
                @else
                    <a href="{{ route('login') }}" class="nav-link">Login</a>
                    <a href="{{ route('register') }}" class="btn btn-primary">Sign Up</a>
                @endauth
            </div>

            <!-- Mobile Menu Button -->
            <button class="mobile-menu-btn" onclick="document.querySelector('.mobile-menu').classList.toggle('active')">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 24px; height: 24px;">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
            </button>
        </div>

        <!-- Mobile Menu -->
        <div class="mobile-menu">
            <a href="{{ route('home') }}" class="nav-link">Home</a>
            <a href="{{ route('blog.index') }}" class="nav-link">Blog</a>
            @auth
                <a href="{{ url('/dashboard') }}" class="nav-link">Dashboard</a>
                <form method="POST" action="{{ route('logout') }}" class="inline-form" style="display: block;">
                    @csrf
                    <button type="submit" class="nav-link" style="width: 100%; text-align: left; background: none; border: none;">Logout</button>
                </form>
            @else
                <a href="{{ route('login') }}" class="nav-link">Login</a>
                <a href="{{ route('register') }}" class="nav-link">Sign Up</a>
            @endauth
        </div>
    </header>

    <!-- Main Content -->
    <main>
        {{ $slot }}
    </main>

    <!-- Footer -->
    <footer class="site-footer">
        <div class="container">
            <p>&copy; {{ date('Y') }} {{ $siteName }}. All rights reserved.</p>
            @php
                $legalNotice = \App\Models\SystemConfiguration::get('legal_notice');
            @endphp
            @if($legalNotice)
                <div class="legal-notice">
                    {{ $legalNotice }}
                </div>
            @endif
        </div>
    </footer>

    @livewireScripts
</body>
</html>
