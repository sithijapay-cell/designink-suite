<x-dashboard-layout>
    <div class="dashboard-header">
        <h1>Profile Settings</h1>
        <p>Manage your account information</p>
    </div>
    
    <div class="content-card">
        <form method="POST" action="{{ route('profile.update') }}">
            @csrf
            @method('PATCH')
            
            <div style="margin-bottom: 1.5rem;">
                <label for="name" style="display: block; font-weight: 600; margin-bottom: 0.5rem;">Name</label>
                <input type="text" id="name" name="name" value="{{ auth()->user()->name }}" required 
                    style="width: 100%; padding: 0.75rem; border: 1px solid #E5E7EB; border-radius: 0.5rem; font-size: 1rem;">
                @error('name')
                <p style="color: #DC2626; font-size: 0.875rem; margin-top: 0.25rem;">{{ $message }}</p>
                @enderror
            </div>
            
            <div style="margin-bottom: 1.5rem;">
                <label for="email" style="display: block; font-weight: 600; margin-bottom: 0.5rem;">Email</label>
                <input type="email" id="email" name="email" value="{{ auth()->user()->email }}" required 
                    style="width: 100%; padding: 0.75rem; border: 1px solid #E5E7EB; border-radius: 0.5rem; font-size: 1rem;">
                @error('email')
                <p style="color: #DC2626; font-size: 0.875rem; margin-top: 0.25rem;">{{ $message }}</p>
                @enderror
            </div>
            
            <button type="submit" class="btn btn-primary" style="padding: 0.75rem 2rem;">
                Save Changes
            </button>
        </form>
    </div>
    
    <div class="content-card" style="margin-top: 2rem;">
        <h2 style="font-weight: 600; margin-bottom: 1.5rem;">Change Password</h2>
        
        <form method="POST" action="{{ route('password.update') }}">
            @csrf
            @method('PUT')
            
            <div style="margin-bottom: 1.5rem;">
                <label for="current_password" style="display: block; font-weight: 600; margin-bottom: 0.5rem;">Current Password</label>
                <input type="password" id="current_password" name="current_password" required 
                    style="width: 100%; padding: 0.75rem; border: 1px solid #E5E7EB; border-radius: 0.5rem; font-size: 1rem;">
                @error('current_password')
                <p style="color: #DC2626; font-size: 0.875rem; margin-top: 0.25rem;">{{ $message }}</p>
                @enderror
            </div>
            
            <div style="margin-bottom: 1.5rem;">
                <label for="password" style="display: block; font-weight: 600; margin-bottom: 0.5rem;">New Password</label>
                <input type="password" id="password" name="password" required 
                    style="width: 100%; padding: 0.75rem; border: 1px solid #E5E7EB; border-radius: 0.5rem; font-size: 1rem;">
                @error('password')
                <p style="color: #DC2626; font-size: 0.875rem; margin-top: 0.25rem;">{{ $message }}</p>
                @enderror
            </div>
            
            <div style="margin-bottom: 1.5rem;">
                <label for="password_confirmation" style="display: block; font-weight: 600; margin-bottom: 0.5rem;">Confirm Password</label>
                <input type="password" id="password_confirmation" name="password_confirmation" required 
                    style="width: 100%; padding: 0.75rem; border: 1px solid #E5E7EB; border-radius: 0.5rem; font-size: 1rem;">
            </div>
            
            <button type="submit" class="btn btn-primary" style="padding: 0.75rem 2rem;">
                Update Password
            </button>
        </form>
    </div>
</x-dashboard-layout>
