<?php

namespace App\Filament\Resources;

use App\Filament\Resources\SubscriptionPlanResource\Pages;
use App\Models\SubscriptionPlan;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

class SubscriptionPlanResource extends Resource
{
    protected static ?string $model = SubscriptionPlan::class;

    protected static ?string $navigationIcon = 'heroicon-o-star';
    
    protected static ?string $navigationGroup = 'Payments';
    
    protected static ?int $navigationSort = 2;

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\Section::make('Plan Details')
                    ->schema([
                        Forms\Components\TextInput::make('name')
                            ->required()
                            ->maxLength(255),
                        
                        Forms\Components\Textarea::make('description')
                            ->rows(3)
                            ->columnSpanFull(),
                        
                        Forms\Components\TextInput::make('price')
                            ->required()
                            ->numeric()
                            ->prefix('৳'),
                        
                        Forms\Components\TextInput::make('duration_days')
                            ->required()
                            ->numeric()
                            ->suffix('days')
                            ->default(30),
                        
                        Forms\Components\Toggle::make('is_active')
                            ->label('Active')
                            ->default(true),
                    ])
                    ->columns(2),
                
                Forms\Components\Section::make('Download Limits')
                    ->schema([
                        Forms\Components\TextInput::make('daily_download_limit')
                            ->required()
                            ->numeric()
                            ->default(100)
                            ->suffix('per day'),
                        
                        Forms\Components\TextInput::make('monthly_download_limit')
                            ->required()
                            ->numeric()
                            ->default(3000)
                            ->suffix('per month'),
                    ])
                    ->columns(2),
                
                Forms\Components\Section::make('Features')
                    ->schema([
                        Forms\Components\Toggle::make('can_download_hd')
                            ->label('HD Download')
                            ->default(true),
                        
                        Forms\Components\Toggle::make('can_download_4k')
                            ->label('4K Download')
                            ->default(false),
                        
                        Forms\Components\Toggle::make('no_ads')
                            ->label('Ad-Free Experience')
                            ->default(false),
                        
                        Forms\Components\Toggle::make('priority_support')
                            ->label('Priority Support')
                            ->default(false),
                    ])
                    ->columns(4),
                
                Forms\Components\Section::make('Additional Features')
                    ->schema([
                        Forms\Components\KeyValue::make('features')
                            ->label('Custom Features')
                            ->columnSpanFull(),
                    ]),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('name')
                    ->searchable()
                    ->sortable(),
                
                Tables\Columns\TextColumn::make('price')
                    ->money('BDT')
                    ->sortable(),
                
                Tables\Columns\TextColumn::make('duration_days')
                    ->suffix(' days')
                    ->sortable(),
                
                Tables\Columns\TextColumn::make('daily_download_limit')
                    ->label('Daily Limit')
                    ->badge()
                    ->color('info'),
                
                Tables\Columns\IconColumn::make('can_download_4k')
                    ->label('4K')
                    ->boolean(),
                
                Tables\Columns\IconColumn::make('no_ads')
                    ->label('No Ads')
                    ->boolean(),
                
                Tables\Columns\IconColumn::make('is_active')
                    ->label('Active')
                    ->boolean(),
                
                Tables\Columns\TextColumn::make('created_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                Tables\Filters\TernaryFilter::make('is_active')
                    ->label('Active'),
            ])
            ->actions([
                Tables\Actions\EditAction::make(),
                Tables\Actions\DeleteAction::make(),
            ])
            ->bulkActions([
                Tables\Actions\BulkActionGroup::make([
                    Tables\Actions\DeleteBulkAction::make(),
                ]),
            ]);
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
            'index' => Pages\ListSubscriptionPlans::route('/'),
            'create' => Pages\CreateSubscriptionPlan::route('/create'),
            'edit' => Pages\EditSubscriptionPlan::route('/{record}/edit'),
        ];
    }
}
