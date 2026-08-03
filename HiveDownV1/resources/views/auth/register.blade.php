<x-guest-layout>
    <form method="POST" action="{{ route('register') }}" style="display: flex; flex-direction: column; gap: 1.5rem;">
        @csrf

        <!-- Name -->
        <div>
            <label for="name" style="display: block; font-size: 0.875rem; font-weight: 600; color: #374151; margin-bottom: 0.5rem;">
                Full Name
            </label>
            <input id="name" 
                   type="text" 
                   name="name" 
                   value="{{ old('name') }}" 
                   required 
                   autofocus 
                   autocomplete="name"
                   style="width: 100%; padding: 0.75rem 1rem; border: 1px solid #D1D5DB; border-radius: 0.5rem; font-size: 1rem; transition: all 0.2s;"
                   placeholder="John Doe"
                   onfocus="this.style.outline='none'; this.style.borderColor='#4F46E5'; this.style.boxShadow='0 0 0 3px rgba(79, 70, 229, 0.1)';"
                   onblur="this.style.borderColor='#D1D5DB'; this.style.boxShadow='none';">
            <x-input-error :messages="$errors->get('name')" class="mt-2" />
        </div>

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
                   autocomplete="new-password"
                   style="width: 100%; padding: 0.75rem 1rem; border: 1px solid #D1D5DB; border-radius: 0.5rem; font-size: 1rem; transition: all 0.2s;"
                   placeholder="••••••••"
                   onfocus="this.style.outline='none'; this.style.borderColor='#4F46E5'; this.style.boxShadow='0 0 0 3px rgba(79, 70, 229, 0.1)';"
                   onblur="this.style.borderColor='#D1D5DB'; this.style.boxShadow='none';">
            <x-input-error :messages="$errors->get('password')" class="mt-2" />
        </div>

        <!-- Confirm Password -->
        <div>
            <label for="password_confirmation" style="display: block; font-size: 0.875rem; font-weight: 600; color: #374151; margin-bottom: 0.5rem;">
                Confirm Password
            </label>
            <input id="password_confirmation" 
                   type="password" 
                   name="password_confirmation" 
                   required 
                   autocomplete="new-password"
                   style="width: 100%; padding: 0.75rem 1rem; border: 1px solid #D1D5DB; border-radius: 0.5rem; font-size: 1rem; transition: all 0.2s;"
                   placeholder="••••••••"
                   onfocus="this.style.outline='none'; this.style.borderColor='#4F46E5'; this.style.boxShadow='0 0 0 3px rgba(79, 70, 229, 0.1)';"
                   onblur="this.style.borderColor='#D1D5DB'; this.style.boxShadow='none';">
            <x-input-error :messages="$errors->get('password_confirmation')" class="mt-2" />
        </div>

        <!-- Submit Button -->
        <div>
            <button type="submit" 
                    style="width: 100%; background-color: #4F46E5; color: white; font-weight: 600; padding: 0.75rem 1rem; border-radius: 0.5rem; border: none; cursor: pointer; transition: all 0.2s; font-size: 1rem;"
                    onmouseover="this.style.backgroundColor='#4338CA'; this.style.transform='scale(1.02)';"
                    onmouseout="this.style.backgroundColor='#4F46E5'; this.style.transform='scale(1)';">
                Create Account
            </button>
        </div>

        <!-- Login Link -->
        <div style="text-align: center;">
            <p style="font-size: 0.875rem; color: #6B7280;">
                Already have an account?
                <a href="{{ route('login') }}" 
                   style="font-weight: 600; color: #4F46E5; text-decoration: none; transition: color 0.2s;"
                   onmouseover="this.style.color='#4338CA';"
                   onmouseout="this.style.color='#4F46E5';">
                    Sign in
                </a>
            </p>
        </div>
    </form>
</x-guest-layout>
