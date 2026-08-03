<x-dashboard-layout>
    <div class="dashboard-header">
        <h1>Checkout</h1>
        <p>Complete your subscription purchase</p>
    </div>
    
    <form method="POST" action="{{ route('dashboard.payment.submit') }}" style="display: grid; grid-template-columns: 1fr; gap: 2rem;">
        @csrf
        <input type="hidden" name="subscription_plan_id" value="{{ $plan->id }}">
        
        <div style="display: grid; grid-template-columns: 1fr; lg:grid-template-columns: 1fr 400px; gap: 2rem;">
        
        <!-- Payment Methods -->
        <div class="content-card">
            <div class="content-card-header">
                <h2 class="content-card-title">Select Payment Method</h2>
            </div>
            
            <div style="display: grid; gap: 1rem;" id="payment-methods">
                <!-- bKash -->
                <label style="display: flex; align-items: center; gap: 1rem; padding: 1.5rem; border: 2px solid #E5E7EB; border-radius: 0.75rem; cursor: pointer; transition: all 0.2s;" 
                       class="payment-option"
                       onclick="selectPayment('bkash', this)">
                    <input type="radio" name="payment_method" value="bkash" required style="width: 1.25rem; height: 1.25rem; cursor: pointer;">
                    <div style="flex: 1;">
                        <div style="font-weight: 600; font-size: 1.125rem; margin-bottom: 0.25rem;">bKash</div>
                        <div style="color: #6B7280; font-size: 0.875rem;">Pay with bKash mobile wallet</div>
                    </div>
                    <div style="width: 60px; height: 40px; background: #E2136E; border-radius: 0.5rem; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 0.75rem;">
                        bKash
                    </div>
                </label>
                
                <!-- Nagad -->
                <label style="display: flex; align-items: center; gap: 1rem; padding: 1.5rem; border: 2px solid #E5E7EB; border-radius: 0.75rem; cursor: pointer; transition: all 0.2s;"
                       class="payment-option"
                       onclick="selectPayment('nagad', this)">
                    <input type="radio" name="payment_method" value="nagad" required style="width: 1.25rem; height: 1.25rem; cursor: pointer;">
                    <div style="flex: 1;">
                        <div style="font-weight: 600; font-size: 1.125rem; margin-bottom: 0.25rem;">Nagad</div>
                        <div style="color: #6B7280; font-size: 0.875rem;">Pay with Nagad mobile wallet</div>
                    </div>
                    <div style="width: 60px; height: 40px; background: #ED1C24; border-radius: 0.5rem; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 0.75rem;">
                        Nagad
                    </div>
                </label>
                
                <!-- Rocket -->
                <label style="display: flex; align-items: center; gap: 1rem; padding: 1.5rem; border: 2px solid #E5E7EB; border-radius: 0.75rem; cursor: pointer; transition: all 0.2s;"
                       class="payment-option"
                       onclick="selectPayment('rocket', this)">
                    <input type="radio" name="payment_method" value="rocket" required style="width: 1.25rem; height: 1.25rem; cursor: pointer;">
                    <div style="flex: 1;">
                        <div style="font-weight: 600; font-size: 1.125rem; margin-bottom: 0.25rem;">Rocket</div>
                        <div style="color: #6B7280; font-size: 0.875rem;">Pay with Rocket mobile wallet</div>
                    </div>
                    <div style="width: 60px; height: 40px; background: #8E3E97; border-radius: 0.5rem; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 0.75rem;">
                        Rocket
                    </div>
                </label>
            </div>
            
            <!-- Payment Number Display -->
            <div id="payment-number-section" style="display: none; margin-top: 1.5rem; padding: 1.5rem; background: #F9FAFB; border-radius: 0.75rem; border: 2px solid #4F46E5;">
                <div style="font-weight: 600; margin-bottom: 1rem; color: #4F46E5;">Send Money To:</div>
                <div style="display: flex; align-items: center; gap: 1rem; background: white; padding: 1rem; border-radius: 0.5rem;">
                    <div style="flex: 1;">
                        <div style="font-size: 0.875rem; color: #6B7280; margin-bottom: 0.25rem;">Payment Number</div>
                        <div id="payment-number-display" style="font-size: 1.5rem; font-weight: 700; color: #111827;"></div>
                    </div>
                    <button type="button" onclick="copyNumber()" style="padding: 0.75rem 1.5rem; background: #4F46E5; color: white; border: none; border-radius: 0.5rem; cursor: pointer; font-weight: 600; transition: all 0.2s; display: flex; align-items: center; gap: 0.5rem;"
                            onmouseover="this.style.backgroundColor='#4338CA';"
                            onmouseout="this.style.backgroundColor='#4F46E5';">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 18px; height: 18px;">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                        </svg>
                        Copy
                    </button>
                </div>
                <div style="margin-top: 1rem; padding: 1rem; background: #FEF3C7; border-radius: 0.5rem; border-left: 4px solid #F59E0B; display: flex; gap: 0.75rem;">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 24px; height: 24px; color: #F59E0B; flex-shrink: 0;">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    <div>
                        <div style="font-weight: 600; color: #92400E; margin-bottom: 0.25rem;">Important</div>
                        <div style="font-size: 0.875rem; color: #78350F;">
                            Send exactly <strong>৳{{ number_format($plan->price, 2) }}</strong> to the number above and enter the transaction ID below.
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Sender Number Input -->
            <div style="margin-top: 1.5rem;">
                <label for="sender_number" style="display: block; font-size: 0.875rem; font-weight: 600; color: #374151; margin-bottom: 0.5rem;">
                    Your Mobile Number <span style="color: #DC2626;">*</span>
                </label>
                <input type="text" 
                       id="sender_number" 
                       name="sender_number" 
                       required
                       style="width: 100%; padding: 0.75rem 1rem; border: 1px solid #D1D5DB; border-radius: 0.5rem; font-size: 1rem; transition: all 0.2s;"
                       placeholder="01XXXXXXXXX"
                       onfocus="this.style.outline='none'; this.style.borderColor='#4F46E5'; this.style.boxShadow='0 0 0 3px rgba(79, 70, 229, 0.1)';"
                       onblur="this.style.borderColor='#D1D5DB'; this.style.boxShadow='none';">
                <div style="margin-top: 0.5rem; font-size: 0.875rem; color: #6B7280;">
                    Enter the mobile number you used to send money
                </div>
            </div>
            
            <!-- Transaction ID Input -->
            <div style="margin-top: 1.5rem;">
                <label for="transaction_id" style="display: block; font-size: 0.875rem; font-weight: 600; color: #374151; margin-bottom: 0.5rem;">
                    Transaction ID <span style="color: #DC2626;">*</span>
                </label>
                <input type="text" 
                       id="transaction_id" 
                       name="transaction_id" 
                       required
                       style="width: 100%; padding: 0.75rem 1rem; border: 1px solid #D1D5DB; border-radius: 0.5rem; font-size: 1rem; transition: all 0.2s;"
                       placeholder="Enter your transaction ID"
                       onfocus="this.style.outline='none'; this.style.borderColor='#4F46E5'; this.style.boxShadow='0 0 0 3px rgba(79, 70, 229, 0.1)';"
                       onblur="this.style.borderColor='#D1D5DB'; this.style.boxShadow='none';">
                <div style="margin-top: 0.5rem; font-size: 0.875rem; color: #6B7280;">
                    Enter the transaction ID you received after sending money
                </div>
            </div>
            
            <div style="margin-top: 2rem; padding-top: 2rem; border-top: 1px solid #E5E7EB;">
                <h3 style="font-weight: 600; margin-bottom: 1rem;">Payment Instructions</h3>
                <ol style="color: #6B7280; font-size: 0.875rem; padding-left: 1.5rem; line-height: 1.7;">
                    <li>Select your preferred payment method above</li>
                    <li>Copy the payment number</li>
                    <li>Send <strong>৳{{ number_format($plan->price, 2) }}</strong> to that number</li>
                    <li>Enter your mobile number (sender number)</li>
                    <li>Enter the transaction ID you received</li>
                    <li>Click "Submit Payment Request"</li>
                    <li>Your subscription will be activated after admin verification</li>
                </ol>
            </div>
        </div>
        
        <!-- Order Summary -->
        <div>
            <div class="content-card">
                <div class="content-card-header">
                    <h2 class="content-card-title">Order Summary</h2>
                </div>
                
                <div style="padding: 1.5rem 0; border-bottom: 1px solid #E5E7EB;">
                    <div style="font-weight: 600; font-size: 1.25rem; margin-bottom: 0.5rem;">{{ $plan->name }}</div>
                    @if($plan->description)
                    <div style="color: #6B7280; font-size: 0.875rem;">{{ $plan->description }}</div>
                    @endif
                </div>
                
                <div style="padding: 1.5rem 0; border-bottom: 1px solid #E5E7EB;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.75rem;">
                        <span style="color: #6B7280;">Duration</span>
                        <span style="font-weight: 600;">{{ $plan->duration_days }} days</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.75rem;">
                        <span style="color: #6B7280;">Daily Downloads</span>
                        <span style="font-weight: 600;">{{ $plan->daily_download_limit }}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #6B7280;">Monthly Downloads</span>
                        <span style="font-weight: 600;">{{ $plan->monthly_download_limit }}</span>
                    </div>
                </div>
                
                <div style="padding: 1.5rem 0;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 1.125rem; font-weight: 600;">Total</span>
                        <span style="font-size: 2rem; font-weight: 700; color: #4F46E5;">৳{{ number_format($plan->price, 2) }}</span>
                    </div>
                </div>
                
                <button type="submit" 
                        style="width: 100%; background-color: #4F46E5; color: white; font-weight: 600; padding: 1rem; border-radius: 0.5rem; border: none; cursor: pointer; transition: all 0.2s; font-size: 1rem;"
                        onmouseover="this.style.backgroundColor='#4338CA'; this.style.transform='scale(1.02)';"
                        onmouseout="this.style.backgroundColor='#4F46E5'; this.style.transform='scale(1)';">
                    Submit Payment Request
                </button>
                
                <div style="margin-top: 1rem; text-align: center;">
                    <a href="{{ route('dashboard.plans') }}" style="color: #6B7280; font-size: 0.875rem; text-decoration: none;"
                       onmouseover="this.style.color='#4F46E5';"
                       onmouseout="this.style.color='#6B7280';">
                        ← Back to Plans
                    </a>
                </div>
            </div>
        </div>
        </div>
    </form>
    
    <!-- Toast Container -->
    <div id="toast-container" style="position: fixed; top: 20px; right: 20px; z-index: 9999;"></div>
    
    <script>
        const paymentNumbers = {
            bkash: '{{ \App\Models\SystemConfiguration::get("bkash_number", "Not Set") }}',
            nagad: '{{ \App\Models\SystemConfiguration::get("nagad_number", "Not Set") }}',
            rocket: '{{ \App\Models\SystemConfiguration::get("rocket_number", "Not Set") }}'
        };
        
        function selectPayment(method, element) {
            // Remove active state from all options
            document.querySelectorAll('.payment-option').forEach(opt => {
                opt.style.borderColor = '#E5E7EB';
                opt.style.backgroundColor = 'white';
            });
            
            // Add active state to selected option
            element.style.borderColor = '#4F46E5';
            element.style.backgroundColor = '#F9FAFB';
            
            // Show payment number
            const numberSection = document.getElementById('payment-number-section');
            const numberDisplay = document.getElementById('payment-number-display');
            
            numberDisplay.textContent = paymentNumbers[method];
            numberSection.style.display = 'block';
        }
        
        function copyNumber() {
            const numberText = document.getElementById('payment-number-display').textContent;
            navigator.clipboard.writeText(numberText).then(() => {
                showToast('Payment number copied to clipboard!', 'success');
            }).catch(() => {
                showToast('Failed to copy number', 'error');
            });
        }
        
        function showToast(message, type = 'success') {
            const toast = document.createElement('div');
            const bgColor = type === 'success' ? '#059669' : '#DC2626';
            const icon = type === 'success' 
                ? '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 20px; height: 20px;"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>'
                : '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 20px; height: 20px;"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>';
            
            toast.innerHTML = `
                <div style="background: ${bgColor}; color: white; padding: 1rem 1.5rem; border-radius: 0.75rem; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3); display: flex; align-items: center; gap: 0.75rem; min-width: 300px; animation: slideIn 0.3s ease-out;">
                    ${icon}
                    <span style="font-weight: 500;">${message}</span>
                </div>
            `;
            
            document.getElementById('toast-container').appendChild(toast);
            
            setTimeout(() => {
                toast.style.animation = 'slideOut 0.3s ease-in';
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }
        
        // Add animation styles
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(400px);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            @keyframes slideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(400px);
                    opacity: 0;
                }
            }
            
            @media (min-width: 1024px) {
                form > div:first-of-type {
                    grid-template-columns: 1fr 400px !important;
                }
            }
        `;
        document.head.appendChild(style);
    </script>
</x-dashboard-layout>
