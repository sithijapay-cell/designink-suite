<?php

namespace App\Filament\Resources;

use App\Filament\Resources\PaymentRequestResource\Pages;
use App\Models\PaymentRequest;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Filament\Notifications\Notification;

class PaymentRequestResource extends Resource
{
    protected static ?string $model = PaymentRequest::class;

    protected static ?string $navigationIcon = 'heroicon-o-banknotes';
    
    protected static ?string $navigationGroup = 'Payments';
    
    protected static ?int $navigationSort = 1;
    
    protected static ?string $navigationLabel = 'Payment Requests';

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\Section::make('Payment Details')
                    ->schema([
                        Forms\Components\Select::make('user_id')
                            ->relationship('user', 'name')
                            ->required()
                            ->disabled(),
                        
                        Forms\Components\Select::make('subscription_plan_id')
                            ->relationship('subscriptionPlan', 'name')
                            ->required()
                            ->disabled(),
                        
                        Forms\Components\Select::make('payment_method')
                            ->options([
                                'bkash' => 'bKash',
                                'nagad' => 'Nagad',
                                'rocket' => 'Rocket',
                            ])
                            ->required()
                            ->disabled(),
                        
                        Forms\Components\TextInput::make('transaction_id')
                            ->required()
                            ->disabled(),
                        
                        Forms\Components\TextInput::make('sender_number')
                            ->tel()
                            ->required()
                            ->disabled(),
                        
                        Forms\Components\TextInput::make('amount')
                            ->numeric()
                            ->prefix('৳')
                            ->required()
                            ->disabled(),
                    ])
                    ->columns(2),
                
                Forms\Components\Section::make('Admin Review')
                    ->schema([
                        Forms\Components\Select::make('status')
                            ->options([
                                'pending' => 'Pending',
                                'approved' => 'Approved',
                                'rejected' => 'Rejected',
                            ])
                            ->required()
                            ->disabled(),
                        
                        Forms\Components\Textarea::make('admin_note')
                            ->rows(3)
                            ->columnSpanFull(),
                    ]),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('id')
                    ->label('ID')
                    ->sortable(),
                
                Tables\Columns\TextColumn::make('user.name')
                    ->label('User')
                    ->searchable()
                    ->sortable(),
                
                Tables\Columns\TextColumn::make('subscriptionPlan.name')
                    ->label('Plan')
                    ->sortable(),
                
                Tables\Columns\TextColumn::make('payment_method')
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'bkash' => 'danger',
                        'nagad' => 'warning',
                        'rocket' => 'info',
                    }),
                
                Tables\Columns\TextColumn::make('transaction_id')
                    ->searchable()
                    ->copyable(),
                
                Tables\Columns\TextColumn::make('sender_number')
                    ->searchable(),
                
                Tables\Columns\TextColumn::make('amount')
                    ->money('BDT')
                    ->sortable(),
                
                Tables\Columns\TextColumn::make('status')
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'pending' => 'warning',
                        'approved' => 'success',
                        'rejected' => 'danger',
                    }),
                
                Tables\Columns\TextColumn::make('created_at')
                    ->dateTime()
                    ->sortable(),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('status')
                    ->options([
                        'pending' => 'Pending',
                        'approved' => 'Approved',
                        'rejected' => 'Rejected',
                    ]),
                
                Tables\Filters\SelectFilter::make('payment_method')
                    ->options([
                        'bkash' => 'bKash',
                        'nagad' => 'Nagad',
                        'rocket' => 'Rocket',
                    ]),
            ])
            ->actions([
                Tables\Actions\Action::make('approve')
                    ->icon('heroicon-o-check-circle')
                    ->color('success')
                    ->requiresConfirmation()
                    ->form([
                        Forms\Components\Textarea::make('admin_note')
                            ->label('Note (Optional)')
                            ->rows(3),
                    ])
                    ->action(function (PaymentRequest $record, array $data) {
                        $record->approve(auth()->id(), $data['admin_note'] ?? null);
                        
                        Notification::make()
                            ->success()
                            ->title('Payment Approved')
                            ->body('User subscription has been activated.')
                            ->send();
                    })
                    ->visible(fn (PaymentRequest $record) => $record->status === 'pending'),
                
                Tables\Actions\Action::make('reject')
                    ->icon('heroicon-o-x-circle')
                    ->color('danger')
                    ->requiresConfirmation()
                    ->form([
                        Forms\Components\Textarea::make('admin_note')
                            ->label('Rejection Reason')
                            ->required()
                            ->rows(3),
                    ])
                    ->action(function (PaymentRequest $record, array $data) {
                        $record->reject(auth()->id(), $data['admin_note']);
                        
                        Notification::make()
                            ->success()
                            ->title('Payment Rejected')
                            ->body('User has been notified.')
                            ->send();
                    })
                    ->visible(fn (PaymentRequest $record) => $record->status === 'pending'),
                
                Tables\Actions\ViewAction::make(),
            ])
            ->bulkActions([
                //
            ])
            ->defaultSort('created_at', 'desc');
    }
    
    public static function getRelations(): array
    {
        return [
            //
        ];
    }
    
    public static function getPages(): array
    {
        return [
            'index' => Pages\ListPaymentRequests::route('/'),
            'view' => Pages\ViewPaymentRequest::route('/{record}'),
        ];
    }
    
    public static function getNavigationBadge(): ?string
    {
        return static::getModel()::where('status', 'pending')->count();
    }
    
    public static function getNavigationBadgeColor(): ?string
    {
        return 'warning';
    }
}
