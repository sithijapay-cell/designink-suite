<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SystemConfiguration extends Model
{
    use HasFactory;

    protected $guarded = [];

    public static function get(string $key, $default = null)
    {
        $config = self::where('key', $key)->first();
        if (!$config) {
            return $default;
        }

        return match ($config->type) {
            'boolean' => filter_var($config->value, FILTER_VALIDATE_BOOLEAN),
            'integer' => (int) $config->value,
            'json' => json_decode($config->value, true),
            default => $config->value,
        };
    }

    public static function set(string $key, $value, string $type = 'string', string $group = 'general')
    {
        $val = $value;
        if ($type === 'json' && is_array($value)) {
            $val = json_encode($value);
        } elseif ($type === 'boolean') {
            $val = $value ? 'true' : 'false';
        }

        return self::updateOrCreate(
            ['key' => $key],
            [
                'value' => (string) $val,
                'type' => $type,
                'group' => $group,
            ]
        );
    }
}
