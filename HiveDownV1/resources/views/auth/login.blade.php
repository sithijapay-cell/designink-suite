<x-guest-layout>
    <!-- Session Status -->
    <x-auth-session-status class="mb-4" :status="session('status')" />

    <form method="POST" action="{{ route('login') }}" style="display: flex; flex-direction: column; gap: 1.5rem;">
        @csrf

        <!-- Email Address -->
        <div>
            <label for="email" style="display: block; font-size: 0.875rem; font-weight: 600; color: #374151; margin-bottom: 0.5rem;">
                Email Address
            </label>
            <input id="email" 
                   type="email" 
                   name="email" 
                   value="{{ old('email') }}" 
                   required 
                   autofocus 
                   autocomplete="username"
                   style="width: 100%; padding: 0.75rem 1rem; border: 1px solid #D1D5DB; border-radius: 0.5rem; font-size: 1rem; transition: all 0.2s;"
                   placeholder="you@example.com"
                   onfocus="this.style.outline='none'; this.style.borderColor='#4F46E5'; this.style.boxShadow='0 0 0 3px rgba(79, 70, 229, 0.1)';"
                   onblur="this.style.borderColor='#D1D5DB'; this.style.boxShadow='none';">
            <x-input-error :messages="$errors->get('email')" class="mt-2" />
        </div>

        <!-- Password -->
        <div>
            <label for="password" style="display: block; font-size: 0.875rem; font-weight: 600; color: #374151; margin-bottom: 0.5rem;">
                Password
            </label>
            <input id="password" 
                   type="password" 
                   name="password" 
                   required 
                   autocomplete="current-password"
                   style="width: 100%; padding: 0.75rem 1rem; border: 1px solid #D1D5DB; border-radius: 0.5rem; font-size: 1rem; transition: all 0.2s;"
                   placeholder="••••••••"
                   onfocus="this.style.outline='none'; this.style.borderColor='#4F46E5'; this.style.boxShadow='0 0 0 3px rgba(79, 70, 229, 0.1)';"
                   onblur="this.style.borderColor='#D1D5DB'; this.style.boxShadow='none';">
            <x-input-error :messages="$errors->get('password')" class="mt-2" />
        </div>

        <!-- Remember Me & Forgot Password -->
        <div style="display: flex; align-items: center; justify-content: space-between;">
            <label for="remember_me" style="display: inline-flex; align-items: center; cursor: pointer;">
                <input id="remember_me" 
                       type="checkbox" 
                       style="width: 1rem; height: 1rem; border-radius: 0.25rem; border: 1px solid #D1D5DB; cursor: pointer;" 
                       name="remember">
                <span style="margin-left: 0.5rem; font-size: 0.875rem; color: #6B7280;">Remember me</span>
            </label>

            @if (Route::has('password.request'))
                <a style="font-size: 0.875rem; font-weight: 500; color: #4F46E5; text-decoration: none; transition: color 0.2s;" 
                   href="{{ route('password.request') }}"
                   onmouseover="this.style.color='#4338CA';"
                   onmouseout="this.style.color='#4F46E5';">
                    Forgot password?
                </a>
            @endif
        </div>

        <!-- Submit Button -->
        <div>
            <button type="submit" 
                    style="width: 100%; background-color: #4F46E5; color: white; font-weight: 600; padding: 0.75rem 1rem; border-radius: 0.5rem; border: none; cursor: pointer; transition: all 0.2s; font-size: 1rem;"
                    onmouseover="this.style.backgroundColor='#4338CA'; this.style.transform='scale(1.02)';"
                    onmouseout="this.style.backgroundColor='#4F46E5'; this.style.transform='scale(1)';">
                Sign In
            </button>
        </div>
    </form>
</x-guest-layout>
